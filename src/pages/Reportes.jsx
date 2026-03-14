import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import './Reportes.css';

export default function Reportes() {
    const [reportes, setReportes] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [usuarioActual, setUsuarioActual] = useState(null);
    const [feriados, setFeriados] = useState([]);

    const [resumen, setResumen] = useState({
        totalSemana: 0,
        abiertos: 0,
        atendidos: 0,
        asignacionTarde: 0,
        tiempoInsuficiente: 0,
        promedioCierre: 0
    });

    // 1. FUNCIÓN EXACTA DE CÁLCULO (Evita las 5 horas de zona horaria)
    const calcularHorasLaborables = (fechaInicioStr, fechaFinStr, listaFeriados = []) => {
        if (!fechaInicioStr || !fechaFinStr) return 0;

        const limpiarFecha = (fecha) => {
            const str = String(fecha).replace(' ', 'T');
            return str.substring(0, 16);
        };

        const inicio = new Date(limpiarFecha(fechaInicioStr));
        const fin = new Date(limpiarFecha(fechaFinStr));

        if (isNaN(inicio.getTime()) || isNaN(fin.getTime()) || inicio >= fin) return 0;

        const feriadosSet = new Set(listaFeriados.map(f => {
            if (!f.fecha) return f; // Por si viene como string plano
            const [year, month, day] = f.fecha.split('T')[0].split('-');
            return `${year}-${month}-${day}`;
        }));

        let minutosLaborables = 0;
        let actual = new Date(inicio.getTime());

        while (actual < fin) {
            const dia = actual.getDay();
            const hora = actual.getHours();

            const yyyy = actual.getFullYear();
            const mm = String(actual.getMonth() + 1).padStart(2, '0');
            const dd = String(actual.getDate()).padStart(2, '0');
            const fechaLocalStr = `${yyyy}-${mm}-${dd}`;

            if (dia >= 1 && dia <= 5 && hora >= 9 && hora < 18 && !feriadosSet.has(fechaLocalStr)) {
                minutosLaborables++;
            }

            actual.setMinutes(actual.getMinutes() + 1);
        }

        return minutosLaborables / 60;
    };

    useEffect(() => {
        const cargarDatos = async () => {
            setCargando(true);
            try {
                const sesion = localStorage.getItem('usuario_sesion');
                const usuario = sesion ? JSON.parse(sesion) : null;
                setUsuarioActual(usuario);

                if (!usuario) {
                    setCargando(false);
                    return;
                }

                // Cargamos los feriados para el cálculo
                const { data: dataFeriados } = await supabase.from('feriados').select('fecha');
                const feriadosList = dataFeriados ? dataFeriados.map(f => f.fecha) : [];
                setFeriados(feriadosList);

                // Cargamos los reportes
                let query = supabase
                    .from('vista_reportes_kpi')
                    .select('*')
                    .order('fecha_creacion_sd', { ascending: false });

                if (usuario.rol !== 'Administrador') {
                    query = query.eq('responsable_id', usuario.id);
                }

                const { data, error } = await query;
                if (error) throw error;

                // 2. RECALCULAMOS LOS KPI EN TIEMPO REAL PARA LA TABLA
                const datosCorregidos = (data || []).map(ticket => {
                    // KPI Asignación: Creación SD vs Asignación (> 8h)
                    let kpiAsig = ticket.asignacion_fuera_tiempo;
                    if (ticket.fecha_creacion_sd && ticket.fecha_asignacion) {
                        const horasAsig = calcularHorasLaborables(ticket.fecha_creacion_sd, ticket.fecha_asignacion, feriadosList);
                        kpiAsig = horasAsig > 8;
                    }

                    // KPI Tiempo Insuficiente: Asignación vs Máxima Atención (< 16h)
                    let kpiInsuficiente = ticket.tiempo_insuficiente;
                    if (ticket.fecha_asignacion && ticket.fecha_maxima_atencion) {
                        const horasMax = calcularHorasLaborables(ticket.fecha_asignacion, ticket.fecha_maxima_atencion, feriadosList);
                        kpiInsuficiente = horasMax < 16;
                    }

                    return {
                        ...ticket,
                        asignacion_fuera_tiempo: kpiAsig,
                        tiempo_insuficiente: kpiInsuficiente
                    };
                });

                setReportes(datosCorregidos);
                calcularResumenSemanal(datosCorregidos);

            } catch (error) {
                console.error("Error cargando reportes:", error.message);
            } finally {
                setCargando(false);
            }
        };

        cargarDatos();
    }, []);

    const calcularResumenSemanal = (datos) => {
        if (!datos.length) return;

        const hoy = new Date();
        const diaSemana = hoy.getDay() === 0 ? 7 : hoy.getDay();
        const inicioSemana = new Date(hoy);
        inicioSemana.setDate(hoy.getDate() - diaSemana + 1);
        inicioSemana.setHours(0, 0, 0, 0);

        const ticketsSemana = datos.filter(d => {
            if (!d.fecha_creacion_sd) return false;
            return new Date(d.fecha_creacion_sd) >= inicioSemana;
        });

        const totalSemana = ticketsSemana.length;

        const atendidos = ticketsSemana.filter(d =>
            ['Cerrado', 'Atendido'].includes(d.estado_actual)
        ).length;

        const abiertos = totalSemana - atendidos;

        const asignacionTarde = ticketsSemana.filter(d => d.asignacion_fuera_tiempo).length;
        const tiempoInsuficiente = ticketsSemana.filter(d => d.tiempo_insuficiente).length;

        const conCierre = ticketsSemana.filter(d => d.diferencia_cierre !== null);
        const sumaCierre = conCierre.reduce((acc, curr) => acc + parseFloat(curr.diferencia_cierre), 0);
        const promedioCierre = conCierre.length > 0 ? (sumaCierre / conCierre.length).toFixed(1) : 0;

        setResumen({ totalSemana, abiertos, atendidos, asignacionTarde, tiempoInsuficiente, promedioCierre });
    };

    const formatearFecha = (fechaIso) => {
        if (!fechaIso) return '-';
        return new Date(fechaIso).toLocaleString('es-PE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    if (cargando) {
        return (
            <div className="spinner-container">
                <div className="spinner"></div>
                <span className="spinner-text">Calculando métricas semanales...</span>
            </div>
        );
    }

    const esAdmin = usuarioActual?.rol === 'Administrador';

    return (
        <div className="reportes-container">
            <div className="rep-header">
                <div>
                    <h1 className="rep-title">Análisis de Nivel de Servicio (SLA)</h1>
                    <p className="rep-subtitle">
                        {esAdmin
                            ? "Vista Global: Monitoreo de todo el equipo."
                            : `Mis Métricas: Rendimiento de ${usuarioActual?.nombre || 'Agente'}`}
                    </p>
                </div>
                <div className="rep-actions">
                    <button className="btn-outline" onClick={() => window.location.reload()}>
                        <span className="material-symbols-outlined">refresh</span> Actualizar
                    </button>
                    <button className="btn-primary">
                        <span className="material-symbols-outlined">download</span> Exportar
                    </button>
                </div>
            </div>

            <h2 className="section-title" style={{ marginBottom: '16px' }}>Resumen de esta semana</h2>

            <div className="kpi-grid">
                <div className="kpi-card">
                    <div className="kpi-icon icon-blue"><span className="material-symbols-outlined">tag</span></div>
                    <div className="kpi-info">
                        <h3>{resumen.totalSemana}</h3>
                        <p>Total Creados</p>
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-icon icon-orange" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>
                        <span className="material-symbols-outlined">pending_actions</span>
                    </div>
                    <div className="kpi-info">
                        <h3>{resumen.abiertos}</h3>
                        <p>Tickets Abiertos</p>
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-icon icon-green">
                        <span className="material-symbols-outlined">task_alt</span>
                    </div>
                    <div className="kpi-info">
                        <h3>{resumen.atendidos}</h3>
                        <p>Tickets Atendidos</p>
                    </div>
                </div>

                <div className="kpi-card">
                    <div className={`kpi-icon ${resumen.asignacionTarde > 0 ? 'icon-red' : 'icon-green'}`}>
                        <span className="material-symbols-outlined">assignment_late</span>
                    </div>
                    <div className="kpi-info">
                        <h3 style={{ color: resumen.asignacionTarde > 0 ? '#dc2626' : 'inherit' }}>{resumen.asignacionTarde}</h3>
                        <p>Asignaciones &gt; 8h</p>
                    </div>
                </div>

                <div className="kpi-card">
                    <div className={`kpi-icon ${resumen.tiempoInsuficiente > 0 ? 'icon-orange' : 'icon-green'}`}>
                        <span className="material-symbols-outlined">timer_off</span>
                    </div>
                    <div className="kpi-info">
                        <h3 style={{ color: resumen.tiempoInsuficiente > 0 ? '#ea580c' : 'inherit' }}>{resumen.tiempoInsuficiente}</h3>
                        <p>Tiempos SLA &lt; 16h</p>
                    </div>
                </div>

                <div className="kpi-card">
                    <div className={`kpi-icon ${resumen.promedioCierre > 0 ? 'icon-red' : 'icon-green'}`}>
                        <span className="material-symbols-outlined">moving</span>
                    </div>
                    <div className="kpi-info">
                        <h3>{Number(resumen.promedioCierre).toFixed(2)}h</h3>
                        <p>Promedio Desviación</p>
                    </div>
                </div>
            </div>

            <div className="rep-content">
                <div className="section-header">
                    <h2 className="section-title">Histórico General de Tickets</h2>
                </div>

                <div className="table-container">
                    <table className="ticket-table">
                        <thead>
                            <tr>
                                <th>Ticket</th>
                                <th>Tipo</th>
                                <th>Prioridad</th>
                                {esAdmin && <th>Responsable</th>}
                                <th>Aplicación</th>
                                <th>Creación SD</th>
                                <th className="text-center">Asignación (8h)</th>
                                <th className="text-center">Tiempo Límite (16h)</th>
                                <th className="text-center">Desviación Cierre</th>
                                <th>Estado Actual</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportes.length === 0 ? (
                                <tr>
                                    <td colSpan={esAdmin ? 10 : 9} className="text-center">No hay datos registrados.</td>
                                </tr>
                            ) : (
                                reportes.map((rep) => (
                                    <tr key={rep.ticket_id}>
                                        <td className="t-id font-bold">{rep.codigo_ticket}</td>

                                        <td>{rep.tipo_sd || '-'}</td>
                                        <td>
                                            <span className={`kpi-badge ${rep.prioridad === 'Alta' ? 'badge-red' : 'badge-orange'}`} style={{ backgroundColor: 'transparent', border: '1px solid currentColor' }}>
                                                {rep.prioridad || '-'}
                                            </span>
                                        </td>

                                        {esAdmin && (
                                            <td className="t-assigned">{rep.responsable_nombre || 'Sin asignar'}</td>
                                        )}

                                        <td>{rep.aplicacion || '-'}</td>

                                        <td className="t-date">{formatearFecha(rep.fecha_creacion_sd)}</td>

                                        {/* KPIs Dinámicos */}
                                        <td className="text-center">
                                            {rep.asignacion_fuera_tiempo === null ? <span style={{ color: '#94a3b8' }}>-</span> :
                                                rep.asignacion_fuera_tiempo ? <span className="kpi-badge badge-red">F. Tiempo</span> : <span className="kpi-badge badge-green">OK</span>}
                                        </td>

                                        <td className="text-center">
                                            {rep.tiempo_insuficiente === null ? <span style={{ color: '#94a3b8' }}>-</span> :
                                                rep.tiempo_insuficiente ? <span className="kpi-badge badge-orange">Insuficiente</span> : <span className="kpi-badge badge-green">OK</span>}
                                        </td>

                                        <td className="text-center font-bold">
                                            {rep.diferencia_cierre !== null ? (
                                                <span style={{ color: rep.diferencia_cierre > 0 ? '#dc2626' : '#16a34a' }}>
                                                    {rep.diferencia_cierre > 0 ? '+' : ''}{Number(rep.diferencia_cierre).toFixed(2)}h
                                                </span>
                                            ) : <span style={{ color: '#94a3b8' }}>En proceso</span>}
                                        </td>

                                        <td>
                                            <span className={`status-pill ${['Cerrado', 'Atendido', 'Resuelto'].includes(rep.estado_actual) ? 'status-resolved' : 'status-open'}`}>
                                                {rep.estado_actual}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
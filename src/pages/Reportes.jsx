import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import './Reportes.css';

export default function Reportes() {
    const [todosLosTickets, setTodosLosTickets] = useState([]);
    const [reportes, setReportes] = useState([]); 
    const [cargando, setCargando] = useState(true);
    const [usuarioActual, setUsuarioActual] = useState(null);

    const [filtroTipo, setFiltroTipo] = useState('todos'); 
    const [filtroMes, setFiltroMes] = useState(''); 
    const [filtroInicio, setFiltroInicio] = useState('');
    const [filtroFin, setFiltroFin] = useState('');

    const [resumen, setResumen] = useState({
        totalTickets: 0, abiertos: 0, atendidos: 0,
        fueraSlaAsignacion: 0, fueraSlaAtencion: 0,     
        promedioDiasAsignacion: 0, promedioDiasAtencion: 0    
    });

    const calcularDiasLaborables = (fechaInicioStr, fechaFinStr, listaFeriados = []) => {
        if (!fechaInicioStr || !fechaFinStr) return 0;
        const limpiarFecha = (fecha) => String(fecha).replace(' ', 'T').substring(0, 16);
        const inicio = new Date(limpiarFecha(fechaInicioStr));
        const fin = new Date(limpiarFecha(fechaFinStr));

        if (isNaN(inicio.getTime()) || isNaN(fin.getTime()) || inicio >= fin) return 0;

        const feriadosSet = new Set(listaFeriados.map(f => {
            if (!f) return '';
            const partes = String(f).split('T')[0].split('-');
            if (partes.length === 3) return `${partes[0]}-${partes[1]}-${partes[2]}`;
            return f;
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
        return minutosLaborables / 540; 
    };

    useEffect(() => {
        const cargarDatos = async () => {
            setCargando(true);
            try {
                const sesion = localStorage.getItem('usuario_sesion');
                const usuario = sesion ? JSON.parse(sesion) : null;
                setUsuarioActual(usuario);

                if (!usuario) return;

                const { data: dataFeriados } = await supabase.from('feriados').select('fecha');
                const feriadosList = dataFeriados ? dataFeriados.map(f => f.fecha) : [];

                let query = supabase.from('vista_tickets_completos').select('*').order('fecha_creacion_sd', { ascending: false });

                if (usuario.rol !== 'Administrador') {
                    query = query.eq('responsable_id', usuario.id);
                }

                const { data, error } = await query;
                if (error) throw error;

                const datosCorregidos = (data || []).map(ticket => {
                    const estadoTicket = ticket.estado || ''; 
                    let diasAsignacion = null, asigFueraTiempo = false;
                    
                    if (ticket.fecha_creacion_sd && ticket.fecha_asignacion) {
                        diasAsignacion = calcularDiasLaborables(ticket.fecha_creacion_sd, ticket.fecha_asignacion, feriadosList);
                        asigFueraTiempo = diasAsignacion > 1; 
                    }

                    let diasAtencion = null, atencionFueraTiempo = false;
                    const esCerrado = ['Cerrado', 'Atendido', 'Resuelto'].includes(estadoTicket);

                    if (ticket.fecha_asignacion && esCerrado) {
                        const fechaCierre = ticket.fecha_atencion || ticket.fecha_actualizacion || new Date().toISOString(); 
                        diasAtencion = calcularDiasLaborables(ticket.fecha_asignacion, fechaCierre, feriadosList);
                        if (ticket.fecha_maxima_atencion) {
                            const limiteCalculado = calcularDiasLaborables(ticket.fecha_asignacion, ticket.fecha_maxima_atencion, feriadosList);
                            atencionFueraTiempo = diasAtencion > limiteCalculado;
                        }
                    }

                    let diasRetraso = 0;
                    if (ticket.fecha_maxima_atencion && !esCerrado) {
                        const hoyStr = new Date().toISOString();
                        const diasAtraso = calcularDiasLaborables(ticket.fecha_maxima_atencion, hoyStr, feriadosList);
                        if (diasAtraso > 0) diasRetraso = diasAtraso;
                    }

                    return { ...ticket, dias_asignacion_real: diasAsignacion, asignacion_fuera_tiempo: asigFueraTiempo, dias_atencion_real: diasAtencion, atencion_fuera_tiempo: atencionFueraTiempo, dias_retraso_actual: diasRetraso };
                });

                setTodosLosTickets(datosCorregidos);
            } catch (error) {
                console.error("Error cargando reportes:", error.message);
            } finally {
                setCargando(false);
            }
        };
        cargarDatos();
    }, []);

    useEffect(() => {
        if (!todosLosTickets.length) return;
        let filtrados = [...todosLosTickets];

        if (filtroTipo === 'mes' && filtroMes) {
            const [year, month] = filtroMes.split('-');
            filtrados = filtrados.filter(t => {
                if (!t.fecha_creacion_sd) return false;
                const date = new Date(t.fecha_creacion_sd);
                return date.getFullYear() === parseInt(year) && (date.getMonth() + 1) === parseInt(month);
            });
        } else if (filtroTipo === 'rango' && (filtroInicio || filtroFin)) {
            filtrados = filtrados.filter(t => {
                if (!t.fecha_creacion_sd) return false;
                const date = new Date(t.fecha_creacion_sd).getTime();
                const start = filtroInicio ? new Date(filtroInicio + 'T00:00:00').getTime() : 0;
                const end = filtroFin ? new Date(filtroFin + 'T23:59:59').getTime() : Infinity;
                return date >= start && date <= end;
            });
        }
        setReportes(filtrados);
        calcularResumen(filtrados);
    }, [filtroTipo, filtroMes, filtroInicio, filtroFin, todosLosTickets]);

    const calcularResumen = (datos) => {
        const total = datos.length;
        const atendidos = datos.filter(d => ['Cerrado', 'Atendido', 'Resuelto'].includes(d.estado)).length;
        const abiertos = total - atendidos;
        const fueraSlaAsignacion = datos.filter(d => d.asignacion_fuera_tiempo).length;
        const fueraSlaAtencion = datos.filter(d => d.atencion_fuera_tiempo || d.dias_retraso_actual > 0).length;

        const tAsig = datos.filter(d => d.dias_asignacion_real !== null);
        const promAsig = tAsig.length > 0 ? (tAsig.reduce((acc, curr) => acc + curr.dias_asignacion_real, 0) / tAsig.length) : 0;

        const tAten = datos.filter(d => d.dias_atencion_real !== null);
        const promAten = tAten.length > 0 ? (tAten.reduce((acc, curr) => acc + curr.dias_atencion_real, 0) / tAten.length) : 0;

        setResumen({ totalTickets: total, abiertos, atendidos, fueraSlaAsignacion, fueraSlaAtencion, promedioDiasAsignacion: promAsig, promedioDiasAtencion: promAten });
    };

    const formatearFecha = (fechaIso) => {
        if (!fechaIso) return '-';
        return new Date(fechaIso).toLocaleString('es-PE', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    // --- NUEVO: EXPORTAR A EXCEL ORDENADO (.xlsx) ---
    const exportarExcel = () => {
        if (!reportes.length) return alert("No hay datos para exportar.");

        // Creamos la estructura visual para Excel (Filas vacías para separar)
        const datosExcel = [
            ["REPORTE DE NIVEL DE SERVICIO (SLA)"],
            [], // Fila vacía
            ["RESUMEN DEL PERIODO"],
            ["Total Creados", "Abiertos", "Resueltos", "Prom. Asignación (días)", "Prom. Resolución (días)", "Fuera de SLA"],
            [
                resumen.totalTickets, resumen.abiertos, resumen.atendidos, 
                resumen.promedioDiasAsignacion.toFixed(2), resumen.promedioDiasAtencion.toFixed(2), 
                resumen.fueraSlaAsignacion + resumen.fueraSlaAtencion
            ],
            [], // Fila vacía
            ["DETALLE DE TICKETS"],
            ["Ticket", "Prioridad", "Responsable", "Fecha Creación", "T. Asignación Real (días)", "SLA Atención Máxima", "T. Resolución Real (días)", "Retraso (días)", "Estado"]
        ];

        // Agregamos los tickets al Excel
        reportes.forEach(rep => {
            datosExcel.push([
                rep.codigo_ticket,
                rep.prioridad || 'Normal',
                rep.responsable || 'Sin asignar',
                formatearFecha(rep.fecha_creacion_sd),
                rep.dias_asignacion_real !== null ? Number(rep.dias_asignacion_real.toFixed(2)) : 'Pendiente',
                formatearFecha(rep.fecha_maxima_atencion),
                rep.dias_atencion_real !== null ? Number(rep.dias_atencion_real.toFixed(2)) : 'En proceso',
                rep.dias_retraso_actual > 0 ? Number(rep.dias_retraso_actual.toFixed(2)) : 0,
                rep.estado || 'Abierto'
            ]);
        });

        // Crear el archivo real
        const hoja = XLSX.utils.aoa_to_sheet(datosExcel);
        const libro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(libro, hoja, "Reporte SLA");
        
        const fechaHoy = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(libro, `Reporte_SLA_${fechaHoy}.xlsx`);
    };

    // --- NUEVO: GENERAR PDF PROFESIONAL ---
    const descargarPDF = () => {
        if (!reportes.length) return alert("No hay datos para exportar.");

        const doc = new jsPDF('landscape'); // Formato horizontal para que quepa la tabla
        const fechaHoy = new Date().toISOString().slice(0, 10);

        // Título principal
        doc.setFontSize(18);
        doc.text("Reporte de Nivel de Servicio (SLA)", 14, 20);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Generado el: ${fechaHoy}`, 14, 28);

        // Tabla 1: Resumen (Promedios y Totales)
        doc.autoTable({
            startY: 35,
            head: [["Total Creados", "Abiertos", "Resueltos", "Prom. Asignación (días)", "Prom. Resolución (días)", "Fuera de SLA"]],
            body: [[
                resumen.totalTickets, 
                resumen.abiertos, 
                resumen.atendidos, 
                `${resumen.promedioDiasAsignacion.toFixed(2)} d`, 
                `${resumen.promedioDiasAtencion.toFixed(2)} d`, 
                resumen.fueraSlaAsignacion + resumen.fueraSlaAtencion
            ]],
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246] } // Color azul
        });

        // Tabla 2: Detalle de Tickets
        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 15, // Empieza debajo de la anterior
            head: [["Ticket", "Prioridad", "Responsable", "Fecha Creación", "T. Asignación", "SLA Máximo", "T. Resolución", "Retraso", "Estado"]],
            body: reportes.map(rep => [
                rep.codigo_ticket,
                rep.prioridad || '-',
                rep.responsable || 'Sin asignar',
                formatearFecha(rep.fecha_creacion_sd),
                rep.dias_asignacion_real !== null ? `${rep.dias_asignacion_real.toFixed(2)} d` : 'Pendiente',
                formatearFecha(rep.fecha_maxima_atencion),
                rep.dias_atencion_real !== null ? `${rep.dias_atencion_real.toFixed(2)} d` : 'En proceso',
                rep.dias_retraso_actual > 0 ? `+${rep.dias_retraso_actual.toFixed(2)} d` : '0',
                rep.estado || 'Abierto'
            ]),
            theme: 'striped',
            headStyles: { fillColor: [51, 65, 85] }, // Color gris oscuro
            styles: { fontSize: 8 } // Letra pequeña para que entren todas las columnas
        });

        doc.save(`Reporte_SLA_${fechaHoy}.pdf`);
    };

    if (cargando) {
        return (
            <div className="spinner-container">
                <div className="spinner"></div>
                <span className="spinner-text">Calculando métricas...</span>
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
                            ? "Vista Global: Monitoreo de tiempos de todo el equipo."
                            : `Mis Métricas: Rendimiento de ${usuarioActual?.nombre || 'Agente'}`}
                    </p>
                </div>
                <div className="rep-actions">
                    <button className="btn-outline" onClick={() => window.location.reload()}>
                        <span className="material-symbols-outlined">refresh</span>
                    </button>
                    {/* BOTÓN PDF ACTUALIZADO */}
                    <button className="btn-outline" onClick={descargarPDF} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span className="material-symbols-outlined">picture_as_pdf</span> Descargar PDF
                    </button>
                    {/* BOTÓN EXCEL ACTUALIZADO */}
                    <button className="btn-primary" onClick={exportarExcel} style={{ display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: '#10b981', borderColor: '#10b981', color: 'white' }}>
                        <span className="material-symbols-outlined">table_view</span> Descargar Excel
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', backgroundColor: '#fff', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-outlined" style={{ color: '#64748b' }}>filter_alt</span>
                    <span style={{ fontWeight: '600', color: '#334155' }}>Periodo:</span>
                </div>
                
                <select 
                    value={filtroTipo} 
                    onChange={(e) => {
                        setFiltroTipo(e.target.value);
                        setFiltroMes(''); setFiltroInicio(''); setFiltroFin('');
                    }}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', cursor: 'pointer' }}
                >
                    <option value="todos">Todo el Histórico</option>
                    <option value="mes">Mes en Específico</option>
                    <option value="rango">Rango de Fechas</option>
                </select>

                {filtroTipo === 'mes' && (
                    <input type="month" value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }} />
                )}

                {filtroTipo === 'rango' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input type="date" value={filtroInicio} onChange={(e) => setFiltroInicio(e.target.value)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }} />
                        <span style={{ color: '#64748b', fontSize: '14px' }}>hasta</span>
                        <input type="date" value={filtroFin} onChange={(e) => setFiltroFin(e.target.value)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }} />
                    </div>
                )}
            </div>

            <h2 className="section-title" style={{ marginBottom: '16px' }}>
                {filtroTipo === 'todos' ? 'Resumen Histórico General' : 
                 filtroTipo === 'mes' ? 'Resumen del Mes' : 'Resumen por Rango de Fechas'}
            </h2>

            <div className="kpi-grid">
                <div className="kpi-card">
                    <div className="kpi-icon icon-blue"><span className="material-symbols-outlined">tag</span></div>
                    <div className="kpi-info"><h3>{resumen.totalTickets}</h3><p>Total Creados</p></div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-icon icon-orange" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}><span className="material-symbols-outlined">pending_actions</span></div>
                    <div className="kpi-info"><h3>{resumen.abiertos}</h3><p>Tickets Abiertos</p></div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-icon icon-green"><span className="material-symbols-outlined">task_alt</span></div>
                    <div className="kpi-info"><h3>{resumen.atendidos}</h3><p>Tickets Resueltos</p></div>
                </div>
                <div className="kpi-card">
                    <div className={`kpi-icon ${resumen.promedioDiasAsignacion > 1 ? 'icon-red' : 'icon-blue'}`}><span className="material-symbols-outlined">person_add</span></div>
                    <div className="kpi-info"><h3 style={{ color: resumen.promedioDiasAsignacion > 1 ? '#dc2626' : 'inherit' }}>{resumen.promedioDiasAsignacion.toFixed(1)} <span style={{fontSize:'12px'}}>días</span></h3><p>Promedio Asignación</p></div>
                </div>
                <div className="kpi-card">
                    <div className="kpi-icon icon-blue"><span className="material-symbols-outlined">timer</span></div>
                    <div className="kpi-info"><h3>{resumen.promedioDiasAtencion.toFixed(1)} <span style={{fontSize:'12px'}}>días</span></h3><p>Promedio Resolución</p></div>
                </div>
                <div className="kpi-card">
                    <div className={`kpi-icon ${(resumen.fueraSlaAsignacion > 0 || resumen.fueraSlaAtencion > 0) ? 'icon-red' : 'icon-green'}`}><span className="material-symbols-outlined">assignment_late</span></div>
                    <div className="kpi-info"><h3 style={{ color: (resumen.fueraSlaAsignacion > 0 || resumen.fueraSlaAtencion > 0) ? '#dc2626' : 'inherit' }}>{resumen.fueraSlaAsignacion + resumen.fueraSlaAtencion}</h3><p>Tickets fuera de SLA</p></div>
                </div>
            </div>

            <div className="rep-content">
                <div className="section-header">
                    <h2 className="section-title">Detalle de Tickets</h2>
                </div>
                <div className="table-container">
                    <table className="ticket-table">
                        <thead>
                            <tr>
                                <th>Ticket</th>
                                <th>Prioridad</th>
                                {esAdmin && <th>Responsable</th>}
                                <th>Creación SD</th>
                                <th className="text-center">T. Asignación</th>
                                <th className="text-center">SLA Atención</th>
                                <th className="text-center">T. Resolución Real</th>
                                <th className="text-center">Retraso</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportes.length === 0 ? (
                                <tr><td colSpan={esAdmin ? 9 : 8} className="text-center">No se encontraron tickets en este periodo.</td></tr>
                            ) : (
                                reportes.map((rep) => (
                                    <tr key={rep.id || rep.ticket_id}>
                                        <td className="t-id font-bold">{rep.codigo_ticket}</td>
                                        <td><span className={`kpi-badge ${rep.prioridad === 'Alta' || rep.prioridad === 'Critica' ? 'badge-red' : 'badge-orange'}`} style={{ backgroundColor: 'transparent', border: '1px solid currentColor' }}>{rep.prioridad || '-'}</span></td>
                                        {esAdmin && <td className="t-assigned">{rep.responsable || 'Sin asignar'}</td>}
                                        <td className="t-date">{formatearFecha(rep.fecha_creacion_sd)}</td>
                                        <td className="text-center font-bold">
                                            {rep.dias_asignacion_real === null ? <span style={{ color: '#94a3b8' }}>Pendiente</span> : <span style={{ color: rep.asignacion_fuera_tiempo ? '#dc2626' : '#16a34a' }}>{rep.dias_asignacion_real.toFixed(1)} d</span>}
                                        </td>
                                        <td className="text-center t-date" style={{ fontSize: '12px' }}>{formatearFecha(rep.fecha_maxima_atencion) || '-'}</td>
                                        <td className="text-center font-bold">
                                            {rep.dias_atencion_real === null ? <span style={{ color: '#94a3b8' }}>En proceso</span> : <span style={{ color: rep.atencion_fuera_tiempo ? '#dc2626' : '#16a34a' }}>{rep.dias_atencion_real.toFixed(1)} d</span>}
                                        </td>
                                        <td className="text-center font-bold">
                                             {rep.dias_retraso_actual > 0 ? <span style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>+{rep.dias_retraso_actual.toFixed(1)} d</span> : <span style={{ color: '#94a3b8' }}>-</span>}
                                        </td>
                                        <td>
                                            <span className={`status-pill ${['Cerrado', 'Atendido', 'Resuelto'].includes(rep.estado) ? 'status-resolved' : 'status-open'}`}>{rep.estado || 'Abierto'}</span>
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
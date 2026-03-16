import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import TicketModal from '../components/TicketModal';
import Swal from 'sweetalert2';
import RetrasosModal from '../components/RetrasosModal';
import './Dashboard.css';

export default function Dashboard() {
    const [alarmas, setAlarmas] = useState([]);
    const [ticketsRecientes, setTicketsRecientes] = useState([]);
    const [cargando, setCargando] = useState(true);

    const [modalAbierto, setModalAbierto] = useState(false);
    const [ticketSeleccionado, setTicketSeleccionado] = useState(null);
    const [modalRetrasosAbierto, setModalRetrasosAbierto] = useState(false);
    const [feriados, setFeriados] = useState([]);

    const [filtros, setFiltros] = useState({
        estado: '', codigo_ticket: '', descripcion: '', aplicacion: '', responsable: ''
    });
    const [ordenConfig, setOrdenConfig] = useState({ columna: null, direccion: 'asc' });

    const calcularHorasLaborables = (fechaInicioStr, fechaFinStr, listaFeriados = []) => {
        if (!fechaInicioStr || !fechaFinStr) return 0;
        const limpiarFecha = (fecha) => String(fecha).replace(' ', 'T').substring(0, 16);
        
        let inicio = new Date(limpiarFecha(fechaInicioStr));
        let fin = new Date(limpiarFecha(fechaFinStr));
        if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) return 0;

        const feriadosSet = new Set(listaFeriados.map(f => {
            if(!f.fecha) return f;
            const [year, month, day] = f.fecha.split('T')[0].split('-');
            return `${year}-${month}-${day}`;
        }));

        let esNegativo = false;
        if (inicio > fin) {
            const temp = inicio;
            inicio = fin;
            fin = temp;
            esNegativo = true;
        }

        let minutosLaborables = 0;
        let actual = new Date(inicio.getTime());

        while (actual < fin) {
            const dia = actual.getDay();
            const hora = actual.getHours();
            const fechaLocalStr = `${actual.getFullYear()}-${String(actual.getMonth() + 1).padStart(2, '0')}-${String(actual.getDate()).padStart(2, '0')}`;
            
            if (dia >= 1 && dia <= 5 && hora >= 9 && hora < 18 && !feriadosSet.has(fechaLocalStr)) {
                minutosLaborables++;
            }
            actual.setMinutes(actual.getMinutes() + 1);
        }
        
        const horas = minutosLaborables / 60;
        return esNegativo ? -horas : horas;
    };

    useEffect(() => {
        cargarDatosDashboard();
    }, []);

    const cargarDatosDashboard = async () => {
        try {
            setCargando(true);
            
            const { data: dataFeriados } = await supabase.from('feriados').select('fecha');
            const feriadosList = dataFeriados ? dataFeriados.map(f => f.fecha) : [];
            setFeriados(feriadosList);

            const { data: dataAlarmas, error: errorAlarmas } = await supabase
                .from('vista_tickets_completos')
                .select('*')
                .neq('estado', 'Cerrado')
                .neq('estado', 'Atendido')
                .gt('dias_retraso', 0)
                .order('dias_retraso', { ascending: false })
                .limit(3);

            if (errorAlarmas) throw errorAlarmas;
            setAlarmas(dataAlarmas || []);

            const { data: dataTickets, error: errorTickets } = await supabase
                .from('vista_tickets_completos')
                .select('*')
                .limit(100);

            if (errorTickets) throw errorTickets;
            setTicketsRecientes(dataTickets || []);

        } catch (error) {
            console.error("Error cargando el dashboard:", error.message);
        } finally {
            setCargando(false);
        }
    };

    const obtenerClaseEstado = (estado) => {
        switch (estado) {
            case 'Pendiente': return 'status-open';
            case 'En proceso': return 'status-progress';
            case 'Atendido':
            case 'Cerrado':
            case 'Resuelto': return 'status-resolved';
            default: return 'status-open';
        }
    };

    const formatearFecha = (fechaIso) => {
        if (!fechaIso) return '-';
        const fecha = new Date(fechaIso);
        return fecha.toLocaleString('es-PE', {
            timeZone: 'UTC',
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const abrirModal = (numeroTicket) => {
        setTicketSeleccionado(numeroTicket);
        setModalAbierto(true);
    };

    const handleFiltroChange = (e) => {
        const { name, value } = e.target;
        setFiltros(prev => ({ ...prev, [name]: value }));
    };

    const manejarOrdenClick = (columna) => {
        setOrdenConfig(prev => ({
            columna,
            direccion: prev.columna === columna && prev.direccion === 'asc' ? 'desc' : 'asc'
        }));
    };

    const obtenerPesoEstado = (estado) => {
        const est = (estado || '').toLowerCase();
        if (est.includes('pendiente')) return 1;
        if (est.includes('proceso')) return 2;
        return 3;
    };

    const opcionesEstado = [...new Set(ticketsRecientes.map(t => t.estado).filter(Boolean))].sort();
    const opcionesApp = [...new Set(ticketsRecientes.map(t => t.aplicacion).filter(Boolean))].sort();
    const opcionesResponsable = [...new Set(ticketsRecientes.map(t => t.responsable).filter(Boolean))].sort();

    let ticketsProcesados = ticketsRecientes.filter(ticket => {
        const matchEstado = filtros.estado === '' || ticket.estado === filtros.estado;
        const matchApp = filtros.aplicacion === '' || ticket.aplicacion === filtros.aplicacion;
        const matchResp = filtros.responsable === '' || ticket.responsable === filtros.responsable;
        
        const matchId = (ticket.codigo_ticket || '').toLowerCase().includes(filtros.codigo_ticket.toLowerCase());
        const matchDesc = (ticket.descripcion || '').toLowerCase().includes(filtros.descripcion.toLowerCase());

        return matchEstado && matchApp && matchResp && matchId && matchDesc;
    });

    ticketsProcesados.sort((a, b) => {
        if (ordenConfig.columna) {
            let valA = a[ordenConfig.columna] || '';
            let valB = b[ordenConfig.columna] || '';
            
            if (valA < valB) return ordenConfig.direccion === 'asc' ? -1 : 1;
            if (valA > valB) return ordenConfig.direccion === 'asc' ? 1 : -1;
            return 0;
        } else {
            const pesoA = obtenerPesoEstado(a.estado);
            const pesoB = obtenerPesoEstado(b.estado);
            
            if (pesoA !== pesoB) {
                return pesoA - pesoB;
            }
            
            const fechaA = a.fecha_creacion_sd ? new Date(a.fecha_creacion_sd).getTime() : 0;
            const fechaB = b.fecha_creacion_sd ? new Date(b.fecha_creacion_sd).getTime() : 0;
            return fechaB - fechaA; 
        }
    });

    // --- ESTILOS MODERNOS PARA LOS ENCABEZADOS DE FILTRO ---
    const contenedorFiltro = {
        display: 'flex',
        alignItems: 'center',
        backgroundColor: '#f8fafc', // Fondo gris muy suave
        border: '1px solid #e2e8f0', // Borde sutil
        borderRadius: '6px',
        padding: '2px 6px',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.01)',
        transition: 'border-color 0.2s'
    };

    const inputFiltro = {
        flex: 1,
        width: '100%',
        minWidth: '0', 
        padding: '6px 4px',
        fontSize: '13px',
        fontWeight: '600',
        color: '#334155',
        backgroundColor: 'transparent',
        border: 'none',
        outline: 'none',
        cursor: 'pointer',
        textOverflow: 'ellipsis'
    };

    const btnOrdenar = {
        background: 'transparent',
        border: 'none',
        color: '#64748b',
        cursor: 'pointer',
        padding: '4px',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '4px'
    };

    // Helper para mostrar el ícono de orden correcto
    const obtenerIconoOrden = (columna) => {
        if (ordenConfig.columna === columna) {
            return ordenConfig.direccion === 'asc' ? '↑' : '↓';
        }
        return '⇅';
    };

    if (cargando) {
        return (
            <div className="spinner-container">
                <div className="spinner"></div>
                <span className="spinner-text">Cargando tu información...</span>
            </div>
        );
    }
    
    return (
        <div className="dashboard-container">
            <div className="dash-header">
                <div>
                    <h1 className="dash-title">Vista de Dashboard</h1>
                </div>
                <button className="btn-primary" onClick={() => abrirModal(null)}>
                    <span className="material-symbols-outlined">add</span> Nuevo Ticket
                </button>
            </div>

            <div className="dash-content">
                <section>
                    <div className="section-header">
                        <h2 className="section-title">
                            <span className="material-symbols-outlined alert-icon">notifications_active</span>
                            Alarma de Pendientes
                        </h2>
                        <button className="btn-link" onClick={() => setModalRetrasosAbierto(true)} style={{ cursor: 'pointer' }}>
                            Ver todos los retrasos
                        </button>
                    </div>

                    <div className="alarm-grid">
                        {alarmas.length === 0 ? (
                            <p style={{ color: '#047857', fontWeight: 'bold' }}>No hay tickets atrasados hoy</p>
                        ) : (
                            alarmas.map((ticket) => {
                                const esCritico = ticket.dias_retraso > 5;
                                const claseBorde = esCritico ? 'border-red' : 'border-orange';
                                const claseBadge = esCritico ? 'badge-red' : 'badge-orange';

                                return (
                                    <div key={ticket.ticket_id} className={`alarm-card ${claseBorde}`}>
                                        <div className="card-top">
                                            <span className="ticket-id">{ticket.codigo_ticket}</span>
                                            <span className={`badge ${claseBadge}`}>{ticket.dias_retraso} DÍAS DE RETRASO</span>
                                        </div>
                                        <p className="ticket-desc">{ticket.descripcion}</p>
                                        <div className="card-bottom">
                                            <span className="ticket-assigned">Designado: <strong>{ticket.responsable || 'Sin asignar'}</strong></span>
                                            <button className="btn-manage" onClick={() => abrirModal(ticket.numero_ticket)}>Gestionar →</button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </section>

                <section>
                    <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 className="section-title">Resumen de Tickets Recientes</h2>
                        <span style={{ fontSize: '13px', color: '#64748b' }}>
                            Mostrando {ticketsProcesados.length} tickets
                        </span>
                    </div>

                    <div className="table-container">
                        <table className="ticket-table">
                            <thead>
                                <tr>
                                    {/* COLUMNAS CON FILTRO INTEGRADO ELEGANTE */}
                                    <th style={{ minWidth: '130px', padding: '8px' }}>
                                        <div style={contenedorFiltro}>
                                            <select name="estado" value={filtros.estado} onChange={handleFiltroChange} style={inputFiltro}>
                                                <option value="">Estado</option>
                                                {opcionesEstado.map(est => <option key={est} value={est}>{est}</option>)}
                                            </select>
                                            <button onClick={() => manejarOrdenClick('estado')} style={btnOrdenar} title="Ordenar">
                                                {obtenerIconoOrden('estado')}
                                            </button>
                                        </div>
                                    </th>

                                    <th style={{ minWidth: '130px', padding: '8px' }}>
                                        <div style={contenedorFiltro}>
                                            <input type="text" name="codigo_ticket" placeholder="Ticket ID" value={filtros.codigo_ticket} onChange={handleFiltroChange} style={{...inputFiltro, cursor: 'text'}}/>
                                            <button onClick={() => manejarOrdenClick('codigo_ticket')} style={btnOrdenar} title="Ordenar">
                                                {obtenerIconoOrden('codigo_ticket')}
                                            </button>
                                        </div>
                                    </th>

                                    <th style={{ padding: '8px' }}>
                                        <div style={contenedorFiltro}>
                                            <input type="text" name="descripcion" placeholder="Buscar Descripción..." value={filtros.descripcion} onChange={handleFiltroChange} style={{...inputFiltro, cursor: 'text', fontWeight: 'normal'}}/>
                                        </div>
                                    </th>

                                    <th style={{ minWidth: '150px', padding: '8px' }}>
                                        <div style={contenedorFiltro}>
                                            <select name="aplicacion" value={filtros.aplicacion} onChange={handleFiltroChange} style={inputFiltro}>
                                                <option value="">App / Módulo</option>
                                                {opcionesApp.map(app => <option key={app} value={app}>{app}</option>)}
                                            </select>
                                            <button onClick={() => manejarOrdenClick('aplicacion')} style={btnOrdenar} title="Ordenar">
                                                {obtenerIconoOrden('aplicacion')}
                                            </button>
                                        </div>
                                    </th>

                                    {/* COLUMNAS SIMPLES DE ORDENAMIENTO */}
                                    <th onClick={() => manejarOrdenClick('fecha_creacion_sd')} style={{cursor: 'pointer', whiteSpace: 'nowrap', color: '#334155', fontWeight: '600', padding: '12px 8px'}}>
                                        Creación SD <span style={{color: '#64748b', fontSize: '14px', marginLeft:'4px'}}>{obtenerIconoOrden('fecha_creacion_sd')}</span>
                                    </th>

                                    <th className="text-center" style={{ whiteSpace: 'nowrap', color: '#334155', fontWeight: '600' }}>T. Asignación</th>
                                    <th className="text-center" style={{ whiteSpace: 'nowrap', color: '#334155', fontWeight: '600' }}>T. Límite SLA</th>
                                    <th className="text-center" style={{ color: '#334155', fontWeight: '600' }}>Resolución</th>

                                    <th style={{ minWidth: '140px', padding: '8px' }}>
                                        <div style={contenedorFiltro}>
                                            <select name="responsable" value={filtros.responsable} onChange={handleFiltroChange} style={inputFiltro}>
                                                <option value="">Designado</option>
                                                {opcionesResponsable.map(resp => <option key={resp} value={resp}>{resp}</option>)}
                                            </select>
                                            <button onClick={() => manejarOrdenClick('responsable')} style={btnOrdenar} title="Ordenar">
                                                {obtenerIconoOrden('responsable')}
                                            </button>
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {ticketsProcesados.length === 0 ? (
                                    <tr><td colSpan="9" className="text-center" style={{ padding: '30px', color: '#64748b' }}>No se encontraron tickets.</td></tr>
                                ) : (
                                    ticketsProcesados.map((ticket) => {
                                        
                                        let tAsignacion = '-';
                                        if (ticket.fecha_creacion_sd && ticket.fecha_asignacion) {
                                            const horasAsig = calcularHorasLaborables(ticket.fecha_creacion_sd, ticket.fecha_asignacion, feriados);
                                            tAsignacion = `${horasAsig.toFixed(1)}h`;
                                        }

                                        let tLimite = '-';
                                        if (ticket.fecha_asignacion && ticket.fecha_maxima_atencion) {
                                            const horasLim = calcularHorasLaborables(ticket.fecha_asignacion, ticket.fecha_maxima_atencion, feriados);
                                            tLimite = `${horasLim.toFixed(1)}h`;
                                        }

                                        let resolucionJSX = <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>En proceso</span>;
                                        if (['Cerrado', 'Atendido', 'Resuelto'].includes(ticket.estado)) {
                                            if (ticket.fecha_maxima_atencion && ticket.fecha_atencion) {
                                                const horasRes = calcularHorasLaborables(ticket.fecha_maxima_atencion, ticket.fecha_atencion, feriados);
                                                
                                                if (horasRes > 0) {
                                                    resolucionJSX = <span style={{ color: '#dc2626', fontWeight: 'bold' }}>+{horasRes.toFixed(1)}h</span>;
                                                } else {
                                                    resolucionJSX = <span style={{ color: '#16a34a', fontWeight: 'bold' }}>{horasRes.toFixed(1)}h</span>;
                                                }
                                            } else {
                                                resolucionJSX = '-';
                                            }
                                        }

                                        return (
                                            <tr key={ticket.ticket_id} onClick={() => abrirModal(ticket.numero_ticket)} style={{ cursor: 'pointer' }}>
                                                <td className="text-center">
                                                    <span className={`status-pill ${obtenerClaseEstado(ticket.estado)}`}>{ticket.estado}</span>
                                                </td>
                                                <td className="t-id">{ticket.codigo_ticket}</td>
                                                <td className="t-desc">{ticket.descripcion}</td>
                                                <td className="t-app">{ticket.aplicacion || 'N/A'}</td>
                                                <td className="t-date">{formatearFecha(ticket.fecha_creacion_sd)}</td>
                                                <td className="text-center font-bold">{tAsignacion}</td>
                                                <td className="text-center font-bold">{tLimite}</td>
                                                <td className="text-center">{resolucionJSX}</td>
                                                <td className="t-assigned">{ticket.responsable || 'Sin asignar'}</td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

            <TicketModal isOpen={modalAbierto} onClose={() => setModalAbierto(false)} numeroTicket={ticketSeleccionado} />
            <RetrasosModal isOpen={modalRetrasosAbierto} onClose={() => setModalRetrasosAbierto(false)} />
        </div>
    );
}
import React, { useState, useEffect, useRef } from 'react';
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
        fecha_asignacion_desde: '', fecha_asignacion_hasta: '', fecha_asignacion_vacia: false,
        fecha_creacion_sd_desde: '', fecha_creacion_sd_hasta: '', fecha_creacion_sd_vacia: false,
        estado: '', codigo_ticket: '', descripcion: '', aplicacion: '', responsable: ''
    });
    const [ordenConfig, setOrdenConfig] = useState({ columna: null, direccion: 'asc' });
    const [filtroActivo, setFiltroActivo] = useState(null);

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
                .limit(200);

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
        const { name, value, type, checked } = e.target;
        setFiltros(prev => ({ 
            ...prev, 
            [name]: type === 'checkbox' ? checked : value 
        }));
    };

    const manejarOrdenClick = (columna, e) => {
        e.stopPropagation(); 
        setOrdenConfig(prev => ({
            columna,
            direccion: prev.columna === columna && prev.direccion === 'asc' ? 'desc' : 'asc'
        }));
    };

    const toggleFiltroMenu = (columna) => {
        setFiltroActivo(prev => prev === columna ? null : columna);
    };

    const limpiarFiltroColumna = (campos) => {
        const nuevosFiltros = { ...filtros };
        campos.forEach(campo => nuevosFiltros[campo] = typeof filtros[campo] === 'boolean' ? false : '');
        setFiltros(nuevosFiltros);
        setFiltroActivo(null);
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

    // --- LÓGICA DE FILTRADO: OCULTA VACÍOS POR DEFECTO ---
    let ticketsProcesados = ticketsRecientes.filter(ticket => {
        const matchEstado = filtros.estado === '' || ticket.estado === filtros.estado;
        const matchApp = filtros.aplicacion === '' || ticket.aplicacion === filtros.aplicacion;
        const matchResp = filtros.responsable === '' || ticket.responsable === filtros.responsable;
        const matchId = (ticket.codigo_ticket || '').toLowerCase().includes(filtros.codigo_ticket.toLowerCase());
        const matchDesc = (ticket.descripcion || '').toLowerCase().includes(filtros.descripcion.toLowerCase());

        let matchFechaAsignacion = true;
        if (filtros.fecha_asignacion_vacia) {
            matchFechaAsignacion = !ticket.fecha_asignacion; // Solo muestra vacíos si se marca el check
        } else {
            if (!ticket.fecha_asignacion) {
                matchFechaAsignacion = false; // DE PRIMERAS OCULTA LOS VACÍOS
            } else {
                matchFechaAsignacion = true;
                if (filtros.fecha_asignacion_desde) {
                    matchFechaAsignacion = matchFechaAsignacion && (ticket.fecha_asignacion >= filtros.fecha_asignacion_desde);
                }
                if (filtros.fecha_asignacion_hasta) {
                    const hasta = new Date(filtros.fecha_asignacion_hasta);
                    hasta.setHours(23, 59, 59, 999);
                    const ticketDate = new Date(ticket.fecha_asignacion);
                    matchFechaAsignacion = matchFechaAsignacion && (ticketDate <= hasta);
                }
            }
        }

        let matchFechaCreacion = true;
        if (filtros.fecha_creacion_sd_vacia) {
            matchFechaCreacion = !ticket.fecha_creacion_sd;
        } else {
            if (!ticket.fecha_creacion_sd) {
                matchFechaCreacion = false; // DE PRIMERAS OCULTA LOS VACÍOS
            } else {
                matchFechaCreacion = true;
                if (filtros.fecha_creacion_sd_desde) {
                    matchFechaCreacion = matchFechaCreacion && (ticket.fecha_creacion_sd >= filtros.fecha_creacion_sd_desde);
                }
                if (filtros.fecha_creacion_sd_hasta) {
                    const hasta = new Date(filtros.fecha_creacion_sd_hasta);
                    hasta.setHours(23, 59, 59, 999);
                    const ticketDate = new Date(ticket.fecha_creacion_sd);
                    matchFechaCreacion = matchFechaCreacion && (ticketDate <= hasta);
                }
            }
        }

        return matchEstado && matchApp && matchResp && matchId && matchDesc && matchFechaAsignacion && matchFechaCreacion;
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
            if (pesoA !== pesoB) return pesoA - pesoB;
            
            const fechaA = a.fecha_creacion_sd ? new Date(a.fecha_creacion_sd).getTime() : 0;
            const fechaB = b.fecha_creacion_sd ? new Date(b.fecha_creacion_sd).getTime() : 0;
            return fechaB - fechaA; 
        }
    });

    // --- ESTILOS DE UI ---
    const headerStyle = {
        position: 'relative', 
        padding: '12px 10px', 
        verticalAlign: 'middle',
        cursor: 'pointer',
        userSelect: 'none',
        backgroundColor: '#f8fafc',
        borderBottom: '2px solid #e2e8f0',
        minWidth: '130px'
    };

    const headerContentStyle = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        color: '#475569',
        fontSize: '13px',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
    };

    const iconBtnStyle = {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: '#94a3b8',
        padding: '2px',
        display: 'flex',
        alignItems: 'center',
        borderRadius: '4px',
    };

    const popoverStyle = {
        position: 'absolute',
        top: '100%',
        left: '0',
        marginTop: '4px',
        backgroundColor: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        padding: '12px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        zIndex: 50,
        minWidth: '220px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        cursor: 'default' 
    };

    const inputPopoverStyle = {
        width: '100%',
        padding: '6px 8px',
        border: '1px solid #cbd5e1',
        borderRadius: '4px',
        fontSize: '13px',
        color: '#334155',
        outline: 'none',
        boxSizing: 'border-box'
    };

    const tieneFiltroActivo = (campos) => campos.some(campo => filtros[campo] !== '' && filtros[campo] !== false);

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
                        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>
                            Mostrando {ticketsProcesados.length} tickets
                        </span>
                    </div>

                    <div className="table-container" style={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <table className="ticket-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    {/* 1. FECHA DE ASIGNACIÓN */}
                                    <th style={headerStyle} onClick={() => toggleFiltroMenu('fecha_asignacion')}>
                                        <div style={headerContentStyle}>
                                            <span>F. Asignación</span>
                                            <div style={{display: 'flex', gap: '4px'}}>
                                                <button onClick={(e) => manejarOrdenClick('fecha_asignacion', e)} style={iconBtnStyle}>
                                                    {ordenConfig.columna === 'fecha_asignacion' ? (ordenConfig.direccion === 'asc' ? '↑' : '↓') : '⇅'}
                                                </button>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: tieneFiltroActivo(['fecha_asignacion_desde', 'fecha_asignacion_hasta', 'fecha_asignacion_vacia']) ? '#2563eb' : '#94a3b8' }}>filter_alt</span>
                                            </div>
                                        </div>
                                        {filtroActivo === 'fecha_asignacion' && (
                                            <div style={popoverStyle} onClick={e => e.stopPropagation()}>
                                                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Desde:</label>
                                                <input type="date" name="fecha_asignacion_desde" value={filtros.fecha_asignacion_desde} onChange={handleFiltroChange} style={inputPopoverStyle} disabled={filtros.fecha_asignacion_vacia} />
                                                
                                                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', marginTop: '4px' }}>Hasta:</label>
                                                <input type="date" name="fecha_asignacion_hasta" value={filtros.fecha_asignacion_hasta} onChange={handleFiltroChange} style={inputPopoverStyle} disabled={filtros.fecha_asignacion_vacia} />
                                                
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569', marginTop: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
                                                    <input type="checkbox" name="fecha_asignacion_vacia" checked={filtros.fecha_asignacion_vacia} onChange={handleFiltroChange} style={{ cursor: 'pointer' }} />
                                                    Mostrar tickets sin asignar (vacíos)
                                                </label>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                                                    <button onClick={() => limpiarFiltroColumna(['fecha_asignacion_desde', 'fecha_asignacion_hasta', 'fecha_asignacion_vacia'])} style={{...iconBtnStyle, color: '#dc2626', fontSize: '12px', fontWeight: 'bold'}}>Limpiar</button>
                                                    <button onClick={() => setFiltroActivo(null)} className="btn-primary" style={{ padding: '6px 10px', fontSize: '12px' }}>Aceptar</button>
                                                </div>
                                            </div>
                                        )}
                                    </th>

                                    {/* 2. CREACIÓN SD */}
                                    <th style={headerStyle} onClick={() => toggleFiltroMenu('fecha_creacion_sd')}>
                                        <div style={headerContentStyle}>
                                            <span>Creación SD</span>
                                            <div style={{display: 'flex', gap: '4px'}}>
                                                <button onClick={(e) => manejarOrdenClick('fecha_creacion_sd', e)} style={iconBtnStyle}>
                                                    {ordenConfig.columna === 'fecha_creacion_sd' ? (ordenConfig.direccion === 'asc' ? '↑' : '↓') : '⇅'}
                                                </button>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: tieneFiltroActivo(['fecha_creacion_sd_desde', 'fecha_creacion_sd_hasta', 'fecha_creacion_sd_vacia']) ? '#2563eb' : '#94a3b8' }}>filter_alt</span>
                                            </div>
                                        </div>
                                        {filtroActivo === 'fecha_creacion_sd' && (
                                            <div style={popoverStyle} onClick={e => e.stopPropagation()}>
                                                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Desde:</label>
                                                <input type="date" name="fecha_creacion_sd_desde" value={filtros.fecha_creacion_sd_desde} onChange={handleFiltroChange} style={inputPopoverStyle} disabled={filtros.fecha_creacion_sd_vacia} />
                                                
                                                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', marginTop: '4px' }}>Hasta:</label>
                                                <input type="date" name="fecha_creacion_sd_hasta" value={filtros.fecha_creacion_sd_hasta} onChange={handleFiltroChange} style={inputPopoverStyle} disabled={filtros.fecha_creacion_sd_vacia} />

                                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569', marginTop: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
                                                    <input type="checkbox" name="fecha_creacion_sd_vacia" checked={filtros.fecha_creacion_sd_vacia} onChange={handleFiltroChange} style={{ cursor: 'pointer' }} />
                                                    Mostrar tickets sin fecha SD (vacíos)
                                                </label>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                                                    <button onClick={() => limpiarFiltroColumna(['fecha_creacion_sd_desde', 'fecha_creacion_sd_hasta', 'fecha_creacion_sd_vacia'])} style={{...iconBtnStyle, color: '#dc2626', fontSize: '12px', fontWeight: 'bold'}}>Limpiar</button>
                                                    <button onClick={() => setFiltroActivo(null)} className="btn-primary" style={{ padding: '6px 10px', fontSize: '12px' }}>Aceptar</button>
                                                </div>
                                            </div>
                                        )}
                                    </th>

                                    {/* 3. ESTADO */}
                                    <th style={headerStyle} onClick={() => toggleFiltroMenu('estado')}>
                                        <div style={headerContentStyle}>
                                            <span>Estado</span>
                                            <div style={{display: 'flex', gap: '4px'}}>
                                                <button onClick={(e) => manejarOrdenClick('estado', e)} style={iconBtnStyle}>
                                                    {ordenConfig.columna === 'estado' ? (ordenConfig.direccion === 'asc' ? '↑' : '↓') : '⇅'}
                                                </button>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: tieneFiltroActivo(['estado']) ? '#2563eb' : '#94a3b8' }}>filter_alt</span>
                                            </div>
                                        </div>
                                        {filtroActivo === 'estado' && (
                                            <div style={popoverStyle} onClick={e => e.stopPropagation()}>
                                                <select name="estado" value={filtros.estado} onChange={handleFiltroChange} style={inputPopoverStyle}>
                                                    <option value="">Todos los estados</option>
                                                    {opcionesEstado.map(est => <option key={est} value={est}>{est}</option>)}
                                                </select>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                                                    <button onClick={() => limpiarFiltroColumna(['estado'])} style={{...iconBtnStyle, color: '#dc2626', fontSize: '12px', fontWeight: 'bold'}}>Limpiar</button>
                                                    <button onClick={() => setFiltroActivo(null)} className="btn-primary" style={{ padding: '6px 10px', fontSize: '12px' }}>Aceptar</button>
                                                </div>
                                            </div>
                                        )}
                                    </th>

                                    {/* 4. TICKET ID */}
                                    <th style={headerStyle} onClick={() => toggleFiltroMenu('codigo_ticket')}>
                                        <div style={headerContentStyle}>
                                            <span>Ticket ID</span>
                                            <div style={{display: 'flex', gap: '4px'}}>
                                                <button onClick={(e) => manejarOrdenClick('codigo_ticket', e)} style={iconBtnStyle}>
                                                    {ordenConfig.columna === 'codigo_ticket' ? (ordenConfig.direccion === 'asc' ? '↑' : '↓') : '⇅'}
                                                </button>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: tieneFiltroActivo(['codigo_ticket']) ? '#2563eb' : '#94a3b8' }}>filter_alt</span>
                                            </div>
                                        </div>
                                        {filtroActivo === 'codigo_ticket' && (
                                            <div style={popoverStyle} onClick={e => e.stopPropagation()}>
                                                <input type="text" name="codigo_ticket" placeholder="Buscar ID..." value={filtros.codigo_ticket} onChange={handleFiltroChange} style={inputPopoverStyle} autoFocus />
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                                                    <button onClick={() => limpiarFiltroColumna(['codigo_ticket'])} style={{...iconBtnStyle, color: '#dc2626', fontSize: '12px', fontWeight: 'bold'}}>Limpiar</button>
                                                    <button onClick={() => setFiltroActivo(null)} className="btn-primary" style={{ padding: '6px 10px', fontSize: '12px' }}>Aceptar</button>
                                                </div>
                                            </div>
                                        )}
                                    </th>

                                    {/* 5. DESCRIPCIÓN */}
                                    <th style={{...headerStyle, minWidth: '180px'}} onClick={() => toggleFiltroMenu('descripcion')}>
                                        <div style={headerContentStyle}>
                                            <span>Descripción</span>
                                            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: tieneFiltroActivo(['descripcion']) ? '#2563eb' : '#94a3b8' }}>filter_alt</span>
                                        </div>
                                        {filtroActivo === 'descripcion' && (
                                            <div style={popoverStyle} onClick={e => e.stopPropagation()}>
                                                <input type="text" name="descripcion" placeholder="Palabra clave..." value={filtros.descripcion} onChange={handleFiltroChange} style={inputPopoverStyle} autoFocus />
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                                                    <button onClick={() => limpiarFiltroColumna(['descripcion'])} style={{...iconBtnStyle, color: '#dc2626', fontSize: '12px', fontWeight: 'bold'}}>Limpiar</button>
                                                    <button onClick={() => setFiltroActivo(null)} className="btn-primary" style={{ padding: '6px 10px', fontSize: '12px' }}>Aceptar</button>
                                                </div>
                                            </div>
                                        )}
                                    </th>

                                    {/* 6. APLICACIÓN */}
                                    <th style={headerStyle} onClick={() => toggleFiltroMenu('aplicacion')}>
                                        <div style={headerContentStyle}>
                                            <span>Aplicación</span>
                                            <div style={{display: 'flex', gap: '4px'}}>
                                                <button onClick={(e) => manejarOrdenClick('aplicacion', e)} style={iconBtnStyle}>
                                                    {ordenConfig.columna === 'aplicacion' ? (ordenConfig.direccion === 'asc' ? '↑' : '↓') : '⇅'}
                                                </button>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: tieneFiltroActivo(['aplicacion']) ? '#2563eb' : '#94a3b8' }}>filter_alt</span>
                                            </div>
                                        </div>
                                        {filtroActivo === 'aplicacion' && (
                                            <div style={popoverStyle} onClick={e => e.stopPropagation()}>
                                                <select name="aplicacion" value={filtros.aplicacion} onChange={handleFiltroChange} style={inputPopoverStyle}>
                                                    <option value="">Todas las aplicaciones</option>
                                                    {opcionesApp.map(app => <option key={app} value={app}>{app}</option>)}
                                                </select>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                                                    <button onClick={() => limpiarFiltroColumna(['aplicacion'])} style={{...iconBtnStyle, color: '#dc2626', fontSize: '12px', fontWeight: 'bold'}}>Limpiar</button>
                                                    <button onClick={() => setFiltroActivo(null)} className="btn-primary" style={{ padding: '6px 10px', fontSize: '12px' }}>Aceptar</button>
                                                </div>
                                            </div>
                                        )}
                                    </th>

                                    {/* 7, 8, 9 KPIs */}
                                    <th className="text-center" style={{ ...headerStyle, cursor: 'default' }}><div style={{...headerContentStyle, justifyContent: 'center'}}>T. Asig</div></th>
                                    <th className="text-center" style={{ ...headerStyle, cursor: 'default' }}><div style={{...headerContentStyle, justifyContent: 'center'}}>T. Límite</div></th>
                                    <th className="text-center" style={{ ...headerStyle, cursor: 'default' }}><div style={{...headerContentStyle, justifyContent: 'center'}}>Resolución</div></th>

                                    {/* 10. RESPONSABLE */}
                                    <th style={headerStyle} onClick={() => toggleFiltroMenu('responsable')}>
                                        <div style={headerContentStyle}>
                                            <span>Designado a</span>
                                            <div style={{display: 'flex', gap: '4px'}}>
                                                <button onClick={(e) => manejarOrdenClick('responsable', e)} style={iconBtnStyle}>
                                                    {ordenConfig.columna === 'responsable' ? (ordenConfig.direccion === 'asc' ? '↑' : '↓') : '⇅'}
                                                </button>
                                                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: tieneFiltroActivo(['responsable']) ? '#2563eb' : '#94a3b8' }}>filter_alt</span>
                                            </div>
                                        </div>
                                        {filtroActivo === 'responsable' && (
                                            <div style={popoverStyle} onClick={e => e.stopPropagation()}>
                                                <select name="responsable" value={filtros.responsable} onChange={handleFiltroChange} style={inputPopoverStyle}>
                                                    <option value="">Todos los responsables</option>
                                                    {opcionesResponsable.map(resp => <option key={resp} value={resp}>{resp}</option>)}
                                                </select>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                                                    <button onClick={() => limpiarFiltroColumna(['responsable'])} style={{...iconBtnStyle, color: '#dc2626', fontSize: '12px', fontWeight: 'bold'}}>Limpiar</button>
                                                    <button onClick={() => setFiltroActivo(null)} className="btn-primary" style={{ padding: '6px 10px', fontSize: '12px' }}>Aceptar</button>
                                                </div>
                                            </div>
                                        )}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {ticketsProcesados.length === 0 ? (
                                    <tr><td colSpan="10" className="text-center" style={{ padding: '40px', color: '#64748b', fontSize: '15px' }}>No se encontraron tickets con los filtros actuales.</td></tr>
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
                                            <tr key={ticket.ticket_id} onClick={() => abrirModal(ticket.numero_ticket)} style={{ cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>
                                                <td className="t-date" style={{ whiteSpace: 'nowrap', padding: '12px 10px' }}>{formatearFecha(ticket.fecha_asignacion)}</td>
                                                <td className="t-date" style={{ whiteSpace: 'nowrap', padding: '12px 10px' }}>{formatearFecha(ticket.fecha_creacion_sd)}</td>
                                                <td className="text-center" style={{ padding: '12px 10px' }}>
                                                    <span className={`status-pill ${obtenerClaseEstado(ticket.estado)}`}>{ticket.estado}</span>
                                                </td>
                                                <td className="t-id" style={{ padding: '12px 10px', fontWeight: '600' }}>{ticket.codigo_ticket}</td>
                                                <td className="t-desc" style={{ padding: '12px 10px' }}>{ticket.descripcion}</td>
                                                <td className="t-app" style={{ padding: '12px 10px' }}>{ticket.aplicacion || 'N/A'}</td>
                                                <td className="text-center font-bold" style={{ padding: '12px 10px' }}>{tAsignacion}</td>
                                                <td className="text-center font-bold" style={{ padding: '12px 10px' }}>{tLimite}</td>
                                                <td className="text-center" style={{ padding: '12px 10px' }}>{resolucionJSX}</td>
                                                <td className="t-assigned" style={{ padding: '12px 10px' }}>{ticket.responsable || 'Sin asignar'}</td>
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
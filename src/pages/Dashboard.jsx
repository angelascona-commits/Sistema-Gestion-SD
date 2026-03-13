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

    const [productos, setProductos] = useState([]);
    const [modalRetrasosAbierto, setModalRetrasosAbierto] = useState(false);
    const [feriados, setFeriados] = useState([]);

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

        // Soporte para fechas invertidas (ej. cierre antes de fecha máxima = negativo)
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
                .order('fecha_registro', { ascending: false })
                .limit(10);

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
            case 'Cerrado': return 'status-resolved';
            default: return 'status-open';
        }
    };

    const formatearFecha = (fechaIso) => {
        if (!fechaIso) return 'N/A';
        const fecha = new Date(fechaIso);
        return fecha.toLocaleString('es-PE', {
            timeZone: 'UTC',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const abrirModal = (numeroTicket) => {
        setTicketSeleccionado(numeroTicket);
        setModalAbierto(true);
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
                        <button 
                            className="btn-link" 
                            onClick={() => setModalRetrasosAbierto(true)}
                            style={{ cursor: 'pointer' }}
                        >
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
                    <div className="section-header">
                        <h2 className="section-title">Resumen de Tickets Recientes</h2>
                    </div>

                    <div className="table-container">
                        <table className="ticket-table">
                            <thead>
                                <tr>
                                    <th>Ticket ID</th>
                                    <th>Descripción</th>
                                    <th>App / Módulo</th>
                                    <th className="text-center">T. Asignación</th>
                                    <th className="text-center">T. Límite SLA</th>
                                    <th className="text-center">Resolución</th>
                                    <th className="text-center">Estado</th>
                                    <th>Designado</th>
                                    <th>Creado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ticketsRecientes.length === 0 ? (
                                    <tr><td colSpan="9" className="text-center">No hay tickets registrados aún.</td></tr>
                                ) : (
                                    ticketsRecientes.map((ticket) => {
                                        
                                        // 1. T. Asignación = Fecha Asignación - Fecha Creación SD
                                        let tAsignacion = '-';
                                        if (ticket.fecha_creacion_sd && ticket.fecha_asignacion) {
                                            const horasAsig = calcularHorasLaborables(ticket.fecha_creacion_sd, ticket.fecha_asignacion, feriados);
                                            tAsignacion = `${horasAsig.toFixed(1)}h`;
                                        }

                                        // 2. T. Límite SLA = Fecha Máxima de Atención - Fecha Asignación
                                        let tLimite = '-';
                                        if (ticket.fecha_asignacion && ticket.fecha_maxima_atencion) {
                                            const horasLim = calcularHorasLaborables(ticket.fecha_asignacion, ticket.fecha_maxima_atencion, feriados);
                                            tLimite = `${horasLim.toFixed(1)}h`;
                                        }

                                        // 3. Resolución = Fecha Atención (Cierre) - Fecha Máxima
                                        let resolucionJSX = <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>En proceso</span>;
                                        if (['Cerrado', 'Atendido', 'Resuelto'].includes(ticket.estado)) {
                                            if (ticket.fecha_maxima_atencion && ticket.fecha_atencion) {
                                                const horasRes = calcularHorasLaborables(ticket.fecha_maxima_atencion, ticket.fecha_atencion, feriados);
                                                
                                                if (horasRes > 0) {
                                                    // Cerró DESPUÉS del límite (Retraso)
                                                    resolucionJSX = <span style={{ color: '#dc2626', fontWeight: 'bold' }}>+{horasRes.toFixed(1)}h</span>;
                                                } else {
                                                    // Cerró ANTES o EXACTO al límite (A tiempo)
                                                    resolucionJSX = <span style={{ color: '#16a34a', fontWeight: 'bold' }}>{horasRes.toFixed(1)}h</span>;
                                                }
                                            } else {
                                                resolucionJSX = '-';
                                            }
                                        }

                                        return (
                                            <tr key={ticket.ticket_id} onClick={() => abrirModal(ticket.numero_ticket)} style={{ cursor: 'pointer' }}>
                                                <td className="t-id">{ticket.codigo_ticket}</td>
                                                <td className="t-desc">{ticket.descripcion}</td>
                                                <td className="t-app">{ticket.aplicacion || 'N/A'}</td>
                                                <td className="text-center font-bold">{tAsignacion}</td>
                                                <td className="text-center font-bold">{tLimite}</td>
                                                <td className="text-center">{resolucionJSX}</td>
                                                <td className="text-center">
                                                    <span className={`status-pill ${obtenerClaseEstado(ticket.estado)}`}>{ticket.estado}</span>
                                                </td>
                                                <td className="t-assigned">{ticket.responsable || 'Sin asignar'}</td>
                                                <td className="t-date">{formatearFecha(ticket.fecha_registro)}</td>
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
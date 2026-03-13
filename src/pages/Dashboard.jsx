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

    useEffect(() => {
        cargarDatosDashboard();
    }, []);

    const cargarDatosDashboard = async () => {
        try {
            setCargando(true);
            
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
        return <div className="spinner-container">
            <div className="spinner"></div>
            <span className="spinner-text">Cargando tu información...</span>
        </div>
    }
    const renderIndicadorHoras = (fechaInicio, fechaFin, limiteHoras) => {
        if (!fechaInicio) return <span style={{ color: '#aaa' }}>N/A</span>;

        const fin = fechaFin ? new Date(fechaFin) : new Date();
        const inicio = new Date(fechaInicio);

        const diffMs = fin - inicio;
        if (diffMs < 0) return <span style={{ color: '#aaa' }}>-</span>; 

        const totalMinutos = Math.floor(diffMs / 60000);
        const horas = Math.floor(totalMinutos / 60);
        const minutos = totalMinutos % 60;

        const tiempoFormateado = `${horas}:${minutos.toString().padStart(2, '0')}`;
        
        const cumpleSLA = horas < limiteHoras || (horas === limiteHoras && minutos === 0);

        const badgeStyle = {
            backgroundColor: cumpleSLA ? '#d1fae5' : '#fee2e2', 
            color: cumpleSLA ? '#065f46' : '#991b1b',           
            padding: '4px 8px',
            borderRadius: '12px',
            fontWeight: '600',
            fontSize: '0.85rem',
            display: 'inline-block',
            minWidth: '55px',
            textAlign: 'center'
        };

        return <span style={badgeStyle}>{tiempoFormateado}</span>;
    };
    return (
        <div className="dashboard-container">
            <div className="dash-header">
                <div>
                    <h1 className="dash-title">Vista de Dashboard</h1>
                </div>
                <button className="btn-primary" onClick={() => abrirModal(null)}>
                    <span className="material-symbols-outlined">add</span>  Nuevo Ticket
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
                                            <span className="ticket-assigned">Asignado: <strong>{ticket.responsable || 'Sin asignar'}</strong></span>
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
                                    <th className="text-center">Estado</th>
                                    <th>Asignado</th>
                                    <th>Creado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ticketsRecientes.length === 0 ? (
                                    <tr><td colSpan="6" className="text-center">No hay tickets registrados aún.</td></tr>
                                ) : (
                                    ticketsRecientes.map((ticket) => (
                                        <tr key={ticket.ticket_id} onClick={() => abrirModal(ticket.numero_ticket)} style={{ cursor: 'pointer' }}>
                                            <td className="t-id">{ticket.codigo_ticket}</td>
                                            <td className="t-desc">{ticket.descripcion}</td>
                                            <td className="t-app">{ticket.aplicacion || 'N/A'}</td>
                                            <td className="text-center">
                                                <span className={`status-pill ${obtenerClaseEstado(ticket.estado)}`}>{ticket.estado}</span>
                                            </td>
                                            <td className="t-assigned">{ticket.responsable || 'Sin asignar'}</td>
                                            <td className="t-date">{formatearFecha(ticket.fecha_registro)}</td>
                                        </tr>
                                    ))
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
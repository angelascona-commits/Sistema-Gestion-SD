import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import TicketModal from '../components/TicketModal';
import './Tickets.css';

export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [ticketsFiltrados, setTicketsFiltrados] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [estadosBD, setEstadosBD] = useState([]);
  const [prioridadesBD, setPrioridadesBD] = useState([]);
  const [aplicacionesBD, setAplicacionesBD] = useState([]);

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('All');
  const [filtroPrioridad, setFiltroPrioridad] = useState('All');
  const [filtroTipoSD, setFiltroTipoSD] = useState('All'); 
  const [filtroAplicacion, setFiltroAplicacion] = useState('All');

  const [modalAbierto, setModalAbierto] = useState(false);
  const [ticketSeleccionado, setTicketSeleccionado] = useState(null);

  useEffect(() => {
    cargarDatosCompletos();
  }, []);

  const cargarDatosCompletos = async () => {
    setCargando(true);
    try {
      const peticionTickets = supabase.from('vista_tickets_completos').select('*').order('fecha_registro', { ascending: false });
      const peticionEstados = supabase.from('estado').select('id, nombre').order('id', { ascending: true });
      const peticionPrioridades = supabase.from('prioridad').select('id, nombre').order('id', { ascending: true });
      const peticionAplicaciones = supabase.from('aplicacion').select('id, nombre').order('nombre', { ascending: true });

      const [resTickets, resEstados, resPrioridades, resAplicaciones] = await Promise.all([
        peticionTickets,
        peticionEstados,
        peticionPrioridades,
        peticionAplicaciones
      ]);

      if (resTickets.error) throw resTickets.error;

      setTickets(resTickets.data || []);
      setTicketsFiltrados(resTickets.data || []);

      if (!resEstados.error) setEstadosBD(resEstados.data || []);
      if (!resPrioridades.error) setPrioridadesBD(resPrioridades.data || []);
      if (!resAplicaciones.error) setAplicacionesBD(resAplicaciones.data || []);

    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setCargando(false);
    }
  };

  const formatearFechaExacta = (fechaTexto) => {
    if (!fechaTexto) return 'Sin fecha';

    const fecha = new Date(fechaTexto);
    return fecha.toLocaleString('es-PE', {
      timeZone: 'UTC',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false 
    });
  };

  useEffect(() => {
    let resultado = tickets;

    if (busqueda) {
      const b = busqueda.toLowerCase();
      resultado = resultado.filter(t =>
        (t.codigo_ticket && t.codigo_ticket.toLowerCase().includes(b)) ||
        (t.descripcion && t.descripcion.toLowerCase().includes(b)) ||
        (t.dni && t.dni.toLowerCase().includes(b)) ||
        (t.responsable && t.responsable.toLowerCase().includes(b))
      );
    }

    if (filtroEstado !== 'All') {
      resultado = resultado.filter(t => t.estado === filtroEstado);
    }

    if (filtroPrioridad !== 'All') {
      resultado = resultado.filter(t => t.prioridad === filtroPrioridad);
    }

    if (filtroTipoSD !== 'All') {
      resultado = resultado.filter(t => t.tipo_sd === filtroTipoSD);
    }

    if (filtroAplicacion !== 'All') {
      resultado = resultado.filter(t => t.aplicacion === filtroAplicacion);
    }

    setTicketsFiltrados(resultado);
  }, [busqueda, filtroEstado, filtroPrioridad, filtroTipoSD, filtroAplicacion, tickets]);

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroEstado('All');
    setFiltroPrioridad('All');
    setFiltroTipoSD('All'); 
    setFiltroAplicacion('All');
  };

  const abrirModal = (numero) => {
    setTicketSeleccionado(numero);
    setModalAbierto(true);
  };

  const getPriorityClass = (prioridad) => {
    switch (prioridad) {
      case 'Crítica': return 'badge-critical';
      case 'Alta': return 'badge-alta';
      case 'Media': return 'badge-media';
      case 'Baja': return 'badge-baja';
      default: return 'badge-default';
    }
  };

  const getStatusClass = (estado) => {
    switch (estado) {
      case 'Pendiente': return 'badge-pendiente';
      case 'En proceso': return 'badge-proceso';
      case 'Atendido':
      case 'Cerrado':
      case 'Resuelto': return 'badge-resuelto';
      default: return 'badge-default';
    }
  };

  return (
    <div className="tickets-page">
      <div className="tickets-content">

        <div className="tickets-header">
          <div>
            <h1 className="page-title">Tickets</h1>
          </div>
          <button className="btn-new-ticket" onClick={() => abrirModal(null)}>
            <span className="material-symbols-outlined">add</span>
            Nuevo ticket
          </button>
        </div>

        <div className="filters-bar">
          <div className="search-box">
            <span className="material-symbols-outlined" style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>search</span>
            <input
              type="text"
              placeholder="Buscar tickets, DNI..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <select className="filter-select" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value="All">Estado: Todos</option>
            {estadosBD.map((estado) => (
              <option key={estado.id} value={estado.nombre}>{estado.nombre}</option>
            ))}
          </select>

          <select className="filter-select" value={filtroPrioridad} onChange={(e) => setFiltroPrioridad(e.target.value)}>
            <option value="All">Prioridad: Todas</option>
            {prioridadesBD.map((prioridad) => (
              <option key={prioridad.id} value={prioridad.nombre}>{prioridad.nombre}</option>
            ))}
          </select>

          <select className="filter-select" value={filtroTipoSD} onChange={(e) => setFiltroTipoSD(e.target.value)}>
            <option value="All">Tipo SD: Todos</option>
            <option value="Solicitud">Solicitud</option>
            <option value="Incidente">Incidente</option>
          </select>

          <select className="filter-select" value={filtroAplicacion} onChange={(e) => setFiltroAplicacion(e.target.value)}>
            <option value="All">Aplicación: Todas</option>
            {aplicacionesBD.map((app) => (
              <option key={app.id} value={app.nombre}>{app.nombre}</option>
            ))}
          </select>

          <div className="filter-divider"></div>

          <button className="btn-clear-filters" onClick={limpiarFiltros}>
            <span className="material-symbols-outlined">filter_alt_off</span>
            Limpiar
          </button>
        </div>

        <div className="table-card">
          <table className="tickets-table">
            <thead>
              <tr>
                <th style={{ width: '100px' }}>ID</th>
                <th style={{ width: '100px' }}>Tipo SD</th> 
                <th>Detalle</th>
                <th style={{ textAlign: 'center', width: '100px' }}>Prioridad</th>
                <th style={{ textAlign: 'center', width: '120px' }}>Estado</th>
                <th>Asignado a</th>
                <th style={{ textAlign: 'center', width: '120px' }}>Alarma SLA</th>
                <th>Creación SD</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan="8">
                    <div className="spinner-container">
                      <div className="spinner"></div>
                      <span className="spinner-text">Cargando tickets...</span>
                    </div>
                  </td>
                </tr>
              ) : ticketsFiltrados.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>No se encontraron tickets con estos filtros.</td></tr>
              ) : (
                ticketsFiltrados.map((ticket) => (
                  <tr key={ticket.ticket_id} className="ticket-row" onClick={() => abrirModal(ticket.numero_ticket)}>

                    <td className="ticket-id">{ticket.codigo_ticket}</td>

                    <td>
                      {ticket.tipo_sd ? (
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          backgroundColor: ticket.tipo_sd === 'Incidente' ? '#fee2e2' : '#e0e7ff',
                          color: ticket.tipo_sd === 'Incidente' ? '#dc2626' : '#4f46e5'
                        }}>
                          {ticket.tipo_sd}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.80rem', color: '#94a3b8', fontStyle: 'italic' }}>
                          N/A
                        </span>
                      )}
                    </td>

                    <td>
                      <span className="ticket-subject-title">
                        {ticket.descripcion?.length > 60 ? ticket.descripcion.substring(0, 60) + '...' : ticket.descripcion}
                      </span>
                      <span className="ticket-subject-meta">
                        App: {ticket.aplicacion || 'N/A'} {ticket.dni && `• DNI: ${ticket.dni}`}
                      </span>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${getPriorityClass(ticket.prioridad)}`}>
                        {ticket.prioridad || 'No def.'}
                      </span>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${getStatusClass(ticket.estado)}`}>
                        {ticket.estado || 'No def.'}
                      </span>
                    </td>

                    <td>
                      {ticket.responsable ? (
                        <div className="assignee-cell">
                          <div className="avatar-circle">
                            {ticket.responsable.substring(0, 2).toUpperCase()}
                          </div>
                          <span style={{ fontSize: '0.875rem' }}>{ticket.responsable}</span>
                        </div>
                      ) : (
                        <span className="unassigned-text">Sin asignar</span>
                      )}
                    </td>

                    <td style={{ textAlign: 'center' }}>
                       {['Cerrado', 'Atendido', 'Resuelto'].includes(ticket.estado) ? (
                          <span style={{ color: '#16a34a', fontSize: '0.8rem', fontWeight: '600' }}>✓ Resuelto</span>
                       ) : ticket.dias_retraso > 0 ? (
                          <span style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                            ⚠️ {ticket.dias_retraso} {ticket.dias_retraso === 1 ? 'día' : 'días'} venc.
                          </span>
                       ) : (
                          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>En tiempo</span>
                       )}
                    </td>

                    <td style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      {formatearFechaExacta(ticket.fecha_creacion_sd)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="table-footer">
            <span>Mostrando {ticketsFiltrados.length} tickets</span>
          </div>
        </div>

      </div>

      <TicketModal
        isOpen={modalAbierto}
        onClose={() => {
          setModalAbierto(false);
          cargarDatosCompletos(); 
        }}
        numeroTicket={ticketSeleccionado}
      />
    </div>
  );
}
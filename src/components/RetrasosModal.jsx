import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import './RetrasosModal.css'; 
export default function RetrasosModal({ isOpen, onClose }) {
  const [retrasos, setRetrasos] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (isOpen) { cargarRetrasos(); }
  }, [isOpen]);

  const cargarRetrasos = async () => {
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from('vista_tickets_completos')
        .select('*')
        .gt('dias_retraso', 0)
        .order('dias_retraso', { ascending: false });

      if (error) throw error;
      const activosRetrasados = (data || []).filter(t => !['Cerrado', 'Atendido', 'Resuelto'].includes(t.estado));
      setRetrasos(activosRetrasados);
    } catch (error) {
      console.error('Error cargando retrasos:', error);
    } finally {
      setCargando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="retrasos-overlay" onClick={onClose}>
      <div className="retrasos-content" onClick={(e) => e.stopPropagation()}>
        <div className="retrasos-header">
          <h2>Tickets Vencidos</h2>
          <button className="btn-close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="retrasos-body">
          {cargando ? (
            <div className="spinner-container">
              <div className="spinner"></div>
              <span className="spinner-text">Buscando tickets retrasados...</span>
            </div>
          ) : retrasos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#16a34a' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>check_circle</span>
              <h3>¡Todo al día!</h3>
              <p>No hay tickets pendientes con retraso.</p>
            </div>
          ) : (
            <table className="retrasos-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Asunto</th>
                  <th>Responsable</th>
                  <th style={{ textAlign: 'center' }}>Retraso</th>
                </tr>
              </thead>
              <tbody>
                {retrasos.map(ticket => (
                  <tr key={ticket.ticket_id}>
                    <td className="rm-ticket-id">{ticket.codigo_ticket}</td>
                    <td>
                      <div className="rm-ticket-desc">{ticket.descripcion?.substring(0, 50)}...</div>
                      <div className="rm-ticket-app">App: {ticket.aplicacion || 'N/A'}</div>
                    </td>
                    <td>{ticket.responsable || 'Sin asignar'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="rm-badge-retraso">
                        {ticket.dias_retraso} {ticket.dias_retraso === 1 ? 'día' : 'días'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        <div className="retrasos-footer">
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
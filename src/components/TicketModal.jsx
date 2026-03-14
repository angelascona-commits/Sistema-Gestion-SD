import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import Swal from 'sweetalert2';
import './TicketModal.css';

export default function TicketModal({ isOpen, onClose, numeroTicket }) {
  const isEditing = Boolean(numeroTicket);

  const [ticket, setTicket] = useState(null);
  const [historial, setHistorial] = useState([]);

  const [responsables, setResponsables] = useState([]);
  const [estados, setEstados] = useState([]);
  const [aplicaciones, setAplicaciones] = useState([]);
  const [estadosJira, setEstadosJira] = useState([]);
  const [prioridades, setPrioridades] = useState([]);
  const [productos, setProductos] = useState([]);
  const [feriados, setFeriados] = useState([]);

  const [cargando, setCargando] = useState(false);

  const getFechaLocalActual = () => {
    const ahora = new Date();
    return new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

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
      const [year, month, day] = f.split('T')[0].split('-');
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

  const calcularDiferenciaRealHoras = (fechaLimite, fechaCierre) => {
    if (!fechaLimite || !fechaCierre) return null;
    const limite = new Date(fechaLimite);
    const cierre = new Date(fechaCierre);
    return ((cierre - limite) / (1000 * 60 * 60)).toFixed(2);
  };

  const [formData, setFormData] = useState({
    numero_ticket: '',
    tipo_sd: '',
    descripcion: '',
    dni: '',
    poliza: '',
    prioridad_id: '',
    producto_id: '',
    responsable_id: '',
    estado_id: '',
    aplicacion_id: '',
    estado_jira_id: '',
    horas_invertidas: 0,
    observaciones: '',
    horario_laboral: '',
    fecha_registro: getFechaLocalActual(),
    fecha_creacion_sd: '',
    fecha_asignacion: '',
    fecha_delegacion: '',
    fecha_estimada: '',
    fecha_maxima_atencion: '',
    fecha_atencion: ''
  });

  useEffect(() => {
    if (isOpen) {
      cargarDatosCompletos();
    }
  }, [isOpen, numeroTicket]);

  useEffect(() => {
    if (isEditing && ticket) {
      setFormData({
        numero_ticket: ticket.numero_ticket || '',
        tipo_sd: ticket.tipo_sd || '',
        producto_id: ticket.producto_id || '',
        descripcion: ticket.descripcion || '',
        dni: ticket.dni || '',
        poliza: ticket.poliza || '',
        prioridad_id: ticket.prioridad_id || '',
        responsable_id: ticket.responsable_id || '',
        estado_id: ticket.estado_id || '',
        aplicacion_id: ticket.aplicacion_id || '',
        estado_jira_id: ticket.estado_jira_id || '',
        horas_invertidas: ticket.horas_invertidas || 0,
        observaciones: ticket.observaciones || '',
        horario_laboral: ticket.horario_laboral || '',
        fecha_registro: ticket.fecha_registro || '',
        fecha_creacion_sd: ticket.fecha_creacion_sd || '',
        fecha_asignacion: ticket.fecha_asignacion || '',
        fecha_delegacion: ticket.fecha_delegacion || '',
        fecha_estimada: ticket.fecha_estimada || '',
        fecha_maxima_atencion: ticket.fecha_maxima_atencion || '',
        fecha_atencion: ticket.fecha_atencion || ''
      });
    } else if (!isEditing && isOpen) {
      setFormData(prev => ({
        ...prev,
        numero_ticket: '', descripcion: '', dni: '', poliza: '', prioridad_id: '', producto_id: '',
        responsable_id: '', estado_id: '', aplicacion_id: '', estado_jira_id: '',
        horas_invertidas: 0, observaciones: '', horario_laboral: '',
        fecha_registro: getFechaLocalActual(),
        fecha_creacion_sd: '', fecha_asignacion: '', fecha_delegacion: '', fecha_estimada: '',
        fecha_maxima_atencion: '', fecha_atencion: ''
      }));
      setHistorial([]);
      setTicket(null);
    }
  }, [ticket, isEditing, isOpen]);

  const cargarDatosCompletos = async () => {
    setCargando(true);
    try {
      const [resResp, resEst, resApp, resJira, resPrio, resFeriados, resProd] = await Promise.all([
        supabase.from('usuarios').select('id, nombre, horario_laboral').eq('activo', true),
        supabase.from('estado').select('id, nombre'),
        supabase.from('aplicacion').select('id, nombre'),
        supabase.from('estado_jira').select('id, nombre'),
        supabase.from('prioridad').select('id, nombre'),
        supabase.from('feriados').select('fecha'),
        supabase.from('producto').select('id, nombre').order('nombre')
      ]);

      setResponsables(resResp.data || []);
      setEstados(resEst.data || []);
      setAplicaciones(resApp.data || []);
      setEstadosJira(resJira.data || []);
      setPrioridades(resPrio.data || []);
      setProductos(resProd.data || []);
      const fechasFeriados = resFeriados.data ? resFeriados.data.map(f => f.fecha) : [];
      setFeriados(fechasFeriados);

      if (isEditing) {
        const { data: ticketData, error: errorTicket } = await supabase
          .from('tickets')
          .select('*, estado:estado_id (nombre)')
          .eq('numero_ticket', numeroTicket)
          .single();

        if (errorTicket) throw errorTicket;
        setTicket(ticketData);

        const { data: historialData } = await supabase
          .from('historial_tickets')
          .select('*')
          .eq('ticket_id', ticketData.id)
          .order('fecha_registro', { ascending: true });

        setHistorial(historialData || []);
      }
    } catch (error) {
      console.error("Error cargando modal:", error);
    } finally {
      setCargando(false);
    }
  };

  const getIconConfig = (tipo) => {
    switch (tipo) {
      case 'CREACION': return { icon: 'add', class: 'icon-creacion' };
      case 'ASIGNACION': return { icon: 'person', class: 'icon-asignacion' };
      case 'ESTADO': return { icon: 'healing', class: 'icon-estado' };
      case 'COMENTARIO': return { icon: 'comment', class: 'icon-comentario' };
      default: return { icon: 'info', class: 'icon-comentario' };
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let newFormData = { ...formData, [name]: value };

    if (name === 'responsable_id') {
      if (value !== '') {
        newFormData.fecha_delegacion = getFechaLocalActual();
        const respSeleccionado = responsables.find(r => r.id.toString() === value);
        if (respSeleccionado && respSeleccionado.horario_laboral) {
          newFormData.horario_laboral = respSeleccionado.horario_laboral;
        } else {
          newFormData.horario_laboral = '09:00 - 18:00';
        }
      } else {
        newFormData.fecha_delegacion = '';
        newFormData.horario_laboral = '';
      }
    }
    setFormData(newFormData);
  };

  const handleGuardarCambios = async () => {
    if (!isEditing && !formData.numero_ticket) {
      Swal.fire({ icon: 'warning', title: 'Campo incompleto', text: 'El Número de Ticket es obligatorio.', confirmButtonColor: '#ea580c' });
      return;
    }
    if (!formData.descripcion || formData.descripcion.trim() === '') {
      Swal.fire({ icon: 'warning', title: 'Campo incompleto', text: 'La Descripción es obligatoria.', confirmButtonColor: '#ea580c' });
      return;
    }
    if (!isEditing && !formData.tipo_sd) {
      Swal.fire({ icon: 'warning', title: 'Campo incompleto', text: 'Debes seleccionar si es una Solicitud o un Incidente.', confirmButtonColor: '#ea580c' });
      return;
    }

    const confirmacion = await Swal.fire({
      title: isEditing ? '¿Guardar cambios?' : '¿Crear nuevo ticket?',
      text: isEditing
        ? "Se actualizará la información de este ticket en la base de datos."
        : "Se registrará este nuevo ticket y aparecerá en el Dashboard.",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#ea580c',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, guardar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    });

    if (!confirmacion.isConfirmed) return;

    try {
      const sesion = localStorage.getItem('usuario_sesion');
      const usuarioActual = sesion ? JSON.parse(sesion) : null;
      const usuarioId = usuarioActual ? usuarioActual.id : null;
      const usuarioNombre = usuarioActual ? usuarioActual.nombre : 'Sistema';

      const payload = {
        tipo_sd: formData.tipo_sd || null,
        descripcion: formData.descripcion,
        dni: formData.dni || null,
        poliza: formData.poliza || null,
        prioridad_id: formData.prioridad_id ? parseInt(formData.prioridad_id) : null,
        responsable_id: formData.responsable_id ? parseInt(formData.responsable_id) : null,
        producto_id: formData.producto_id ? parseInt(formData.producto_id) : null,
        estado_id: formData.estado_id ? parseInt(formData.estado_id) : null,
        aplicacion_id: formData.aplicacion_id ? parseInt(formData.aplicacion_id) : null,
        estado_jira_id: formData.estado_jira_id ? parseInt(formData.estado_jira_id) : null,
        horas_invertidas: formData.horas_invertidas ? parseFloat(formData.horas_invertidas) : 0,
        observaciones: formData.observaciones || '',
        horario_laboral: formData.horario_laboral || null,
        fecha_registro: formData.fecha_registro || null,
        fecha_creacion_sd: formData.fecha_creacion_sd || null,
        fecha_asignacion: formData.fecha_asignacion || null,
        fecha_delegacion: formData.fecha_delegacion || null,
        fecha_estimada: formData.fecha_estimada || null,
        fecha_maxima_atencion: formData.fecha_maxima_atencion || null,
        fecha_atencion: formData.fecha_atencion || null,
      };

      let ticketProcesadoId = null;

      if (isEditing) {
        const { error } = await supabase.from('tickets').update(payload).eq('id', ticket.id).select();
        if (error) throw error;
        ticketProcesadoId = ticket.id;
      } else {
        payload.numero_ticket = parseInt(formData.numero_ticket);
        payload.creador_id = usuarioId;

        const { data, error } = await supabase.from('tickets').insert([payload]).select();
        if (error) {
          if (error.code === '23505') {
            Swal.fire({ icon: 'error', title: 'Ticket Duplicado', text: `El ticket SD-${formData.numero_ticket} ya existe en el sistema.`, confirmButtonColor: '#ea580c' });
            return;
          }
          throw error;
        }
        ticketProcesadoId = data[0].id;
      }

      const inicioAsigKPI = formData.fecha_creacion_sd || formData.fecha_registro;
      const finAsigKPI = formData.fecha_asignacion;
      const horasAsignacion = calcularHorasLaborables(inicioAsigKPI, finAsigKPI, feriados);
      const kpi_asignacion_fuera_tiempo = (inicioAsigKPI && finAsigKPI) ? horasAsignacion > 8 : false;

      const horasAtencionLimite = calcularHorasLaborables(formData.fecha_asignacion, formData.fecha_maxima_atencion, feriados);
      const kpi_tiempo_insuficiente = (formData.fecha_asignacion && formData.fecha_maxima_atencion) ? horasAtencionLimite < 16 : false;

      // MODIFICACIÓN APLICADA: Calculamos la diferencia guardando negativo si es a favor
      let kpi_diferencia_cierre = null;
      if (formData.fecha_maxima_atencion && formData.fecha_atencion) {
        const limite = new Date(formData.fecha_maxima_atencion);
        const cierre = new Date(formData.fecha_atencion);

        if (cierre > limite) {
          // Se cerró tarde (horas en contra, guardamos como positivo)
          kpi_diferencia_cierre = calcularHorasLaborables(formData.fecha_maxima_atencion, formData.fecha_atencion, feriados);
        } else {
          // Se cerró temprano (horas a favor, guardamos como negativo)
          const horasAFavor = calcularHorasLaborables(formData.fecha_atencion, formData.fecha_maxima_atencion, feriados);
          kpi_diferencia_cierre = -Math.abs(horasAFavor);
        }
      }

      const payloadKpi = {
        ticket_id: ticketProcesadoId,
        asignacion_fuera_tiempo: kpi_asignacion_fuera_tiempo,
        tiempo_insuficiente: kpi_tiempo_insuficiente,
        diferencia_cierre: (kpi_diferencia_cierre !== null && kpi_diferencia_cierre !== undefined && !isNaN(kpi_diferencia_cierre)) ? parseFloat(kpi_diferencia_cierre) : null
      };

      const { error: kpiError } = await supabase.from('ticket_kpis').upsert(payloadKpi, { onConflict: 'ticket_id' });
      if (kpiError) throw kpiError;

      await supabase.from('historial_tickets').insert([{
        ticket_id: ticketProcesadoId,
        usuario_id: usuarioId,
        tipo_accion: isEditing ? 'EDICION' : 'CREACION',
        descripcion: isEditing ? 'Actualización de datos del ticket' : 'Ticket Registrado',
        detalle_extra: formData.observaciones || '',
        usuario: usuarioNombre
      }]);

      Swal.fire({
        icon: 'success',
        title: isEditing ? '¡Actualizado!' : '¡Creado!',
        text: isEditing ? 'El ticket se guardó correctamente.' : 'Ticket creado con éxito.',
        confirmButtonColor: '#ea580c',
        timer: 2000,
        showConfirmButton: false
      }).then(() => {
        onClose();
        window.location.reload();
      });

    } catch (error) {
      console.error('Error:', error);
      Swal.fire({ 
        icon: 'error', 
        title: 'Error al guardar', 
        text: error.message || 'Hubo un error inesperado en la base de datos.', 
        confirmButtonColor: '#ea580c' 
      });
    }
  }

  if (!isOpen) return null;

  const formatearParaInput = (fecha) => {
    if (!fecha) return "";
    try {
      const fechaStr = String(fecha).replace(' ', 'T');
      return fechaStr.substring(0, 16);
    } catch (e) {
      return "";
    }
  };


  const uiHorasAsignacion = calcularHorasLaborables(formData.fecha_creacion_sd, formData.fecha_asignacion, feriados);
  const excedeAsignacion = (formData.fecha_creacion_sd && formData.fecha_asignacion) && (uiHorasAsignacion > 8);

  const uiHorasMaxima = calcularHorasLaborables(formData.fecha_asignacion, formData.fecha_maxima_atencion, feriados);
  const tiempoInsuficiente = (formData.fecha_asignacion && formData.fecha_maxima_atencion) && (uiHorasMaxima < 16);

  // MODIFICACIÓN APLICADA: Calculamos la diferencia de cierre para la interfaz
  let superaCierre = false;
  let difCierreMensaje = "";
  if (formData.fecha_atencion && formData.fecha_maxima_atencion) {
    const limite = new Date(formData.fecha_maxima_atencion);
    const cierre = new Date(formData.fecha_atencion);
    
    if (cierre > limite) {
      superaCierre = true;
      const difHrs = calcularHorasLaborables(formData.fecha_maxima_atencion, formData.fecha_atencion, feriados);
      difCierreMensaje = `Vencido: El cierre superó el límite por ${difHrs.toFixed(1)} horas.`;
    } else {
      superaCierre = false;
      const difHrs = calcularHorasLaborables(formData.fecha_atencion, formData.fecha_maxima_atencion, feriados);
      difCierreMensaje = `A tiempo: Resuelto con ${difHrs.toFixed(1)}h a favor.`;
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {cargando ? (
          <div className="spinner-container">
            <div className="spinner"></div>
            <span className="spinner-text">Cargando datos del ticket...</span>
          </div>
        ) : (
          <>
            <div className="modal-header">
              <div className="modal-title-group">
                <h2 className="modal-title">
                  {isEditing ? `Edición de Ticket: SD-${numeroTicket}` : 'Crear Nuevo Ticket'}
                </h2>
                {isEditing && (
                  <span className={`status-pill status-${ticket?.estado?.nombre === 'Pendiente' ? 'open' : 'progress'}`}>
                    {ticket?.estado?.nombre || 'Sin Estado'}
                  </span>
                )}
              </div>
              <button className="btn-close" onClick={onClose}><span className="material-symbols-outlined">close</span></button>
            </div>

            <div className="modal-body">
              <div className="modal-form">

                {!isEditing && (
                  <div className="form-group">
                    <label>Número de Ticket (Obligatorio)</label>
                    <input type="number" className="form-control" name="numero_ticket" value={formData.numero_ticket} onChange={handleChange} />
                  </div>
                )}

                <div className="form-group">
                  <label>Descripción del Problema</label>
                  <textarea className="form-control" rows="2" name="descripcion" value={formData.descripcion} onChange={handleChange} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>Tipo de SD {!isEditing && <span style={{ color: 'red' }}>*</span>}</label>
                    <select name="tipo_sd" value={formData.tipo_sd || ''} onChange={handleChange} className="form-control">
                      <option value="">-- Seleccionar --</option>
                      <option value="Solicitud">Solicitud</option>
                      <option value="Incidente">Incidente</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', backgroundColor: 'var(--slate-50)', padding: '12px', borderRadius: '8px', border: '1px solid var(--slate-200)', marginBottom: '20px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>DNI Cliente</label>
                    <input type="text" className="form-control" name="dni" placeholder="Opcional" value={formData.dni} onChange={handleChange} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Póliza</label>
                    <input type="text" className="form-control" name="poliza" placeholder="Opcional" value={formData.poliza} onChange={handleChange} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Prioridad</label>
                    <select className="form-control" name="prioridad_id" value={formData.prioridad_id} onChange={handleChange}>
                      <option value="">-- Seleccionar --</option>
                      {prioridades.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>Asignado a</label>
                    <select className="form-control" name="responsable_id" value={formData.responsable_id} onChange={handleChange}>
                      <option value="">-- Sin asignar --</option>
                      {responsables.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                    </select>
                    {formData.horario_laboral && (
                      <small style={{ color: '#0369a1', fontSize: '11px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>schedule</span>
                        Horario del agente: {formData.horario_laboral}
                      </small>
                    )}
                  </div>
                  <div className="form-group">
                    <label>Estado</label>
                    <select className="form-control" name="estado_id" value={formData.estado_id} onChange={handleChange}>
                      <option value="">-- Seleccionar --</option>
                      {estados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr ', gap: '16px' }}>
                  <div className="form-group">
                    <label>Aplicación</label>
                    <select className="form-control" name="aplicacion_id" value={formData.aplicacion_id} onChange={handleChange}>
                      <option value="">-- Seleccionar --</option>
                      {aplicaciones.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Producto</label>
                    <select className="form-control" name="producto_id" value={formData.producto_id} onChange={handleChange}>
                      <option value="">-- Seleccionar --</option>
                      {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Estado SD</label>
                    <select className="form-control" name="estado_jira_id" value={formData.estado_jira_id} onChange={handleChange}>
                      <option value="">-- Seleccionar --</option>
                      {estadosJira.map(ej => <option key={ej.id} value={ej.id}>{ej.nombre}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ padding: '16px', backgroundColor: 'var(--slate-50)', borderRadius: '8px', marginBottom: '20px', border: '1px solid var(--slate-200)' }}>

                  <h4 style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '16px', color: 'var(--slate-700)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', verticalAlign: 'text-bottom', marginRight: '6px' }}>calendar_month</span>
                    Gestión de Fechas
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ color: '#0369a1' }}>Fecha de registro SD </label>
                      <input type="datetime-local" className="form-control" name="fecha_creacion_sd" value={formatearParaInput(formData.fecha_creacion_sd)} onChange={handleChange} />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Fecha Asignación</label>
                      <input type="datetime-local" className="form-control" name="fecha_asignacion" value={formatearParaInput(formData.fecha_asignacion)} onChange={handleChange} />
                      {formData.fecha_creacion_sd && formData.fecha_asignacion && (
                        <small style={{ color: excedeAsignacion ? '#dc2626' : '#16a34a', fontWeight: '600', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                          {excedeAsignacion ? '⚠️ Fuera de tiempo: Supera las 8h laborables desde Creación SD' : '✅ Asignación dentro del tiempo límite'}
                        </small>
                      )}
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Fecha Máxima Atención </label>
                      <input type="datetime-local" className="form-control" name="fecha_maxima_atencion" value={formatearParaInput(formData.fecha_maxima_atencion)} onChange={handleChange} />
                      {formData.fecha_asignacion && formData.fecha_maxima_atencion && (
                        <small style={{ color: tiempoInsuficiente ? '#dc2626' : '#16a34a', fontWeight: '600', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                          {tiempoInsuficiente ? '⚠️ Tiempo insuficiente: Es menor a 16h laborables desde la asignación' : '✅ Tiempo de SLA correcto'}
                        </small>
                      )}
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Fecha Delegación (Automático interno)</label>
                      <input type="datetime-local" className="form-control" name="fecha_delegacion" value={formatearParaInput(formData.fecha_delegacion)} onChange={handleChange} />
                    </div>

                    {isEditing && (
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Fecha Atención (Cierre)</label>
                        <input type="datetime-local" className="form-control" name="fecha_atencion" value={formatearParaInput(formData.fecha_atencion)} onChange={handleChange} />
                        {formData.fecha_maxima_atencion && formData.fecha_atencion && (
                          <small style={{ color: superaCierre ? '#dc2626' : '#16a34a', fontWeight: '600', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                            {difCierreMensaje}
                          </small>
                        )}
                      </div>
                    )}

                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Fecha Estimada</label>
                    <input type="datetime-local" className="form-control" name="fecha_estimada" value={formatearParaInput(formData.fecha_estimada)} onChange={handleChange} />
                  </div>
                  {isEditing && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Horas Invertidas</label>
                      <input type="number" step="0.1" className="form-control" name="horas_invertidas" value={formData.horas_invertidas} onChange={handleChange} />
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label>Observaciones</label>
                  <textarea className="form-control" rows="2" name="observaciones" value={formData.observaciones} onChange={handleChange} />
                </div>
              </div>

              <div className="modal-timeline" style={{ borderLeft: '1px solid var(--slate-100)', paddingLeft: '32px' }}>
                <h3 className="timeline-title">Historial de actividad</h3>
                {!isEditing ? (
                  <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem', fontStyle: 'italic' }}>El historial se generará automáticamente.</p>
                ) : (
                  <div className="timeline-container">
                    <div className="timeline-line"></div>
                    {historial.length === 0 ? (
                      <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem' }}>Aún no hay movimientos registrados.</p>
                    ) : (
                      historial.map((item) => {
                        const iconConf = getIconConfig(item.tipo_accion);
                        return (
                          <div key={item.id} className="timeline-item">
                            <div className={`timeline-icon ${iconConf.class}`}><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{iconConf.icon}</span></div>
                            <div className="timeline-content">
                              <p className="t-action">{item.descripcion}</p>
                              <p className="t-meta">{new Date(item.fecha_registro).toLocaleString()} • {item.usuario}</p>
                              {item.detalle_extra && <p className="timeline-note">"{item.detalle_extra}"</p>}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={onClose}>Cancelar</button>
              <button className="btn-primary" onClick={handleGuardarCambios}>
                {isEditing ? 'Guardar Cambios' : 'Crear Ticket'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
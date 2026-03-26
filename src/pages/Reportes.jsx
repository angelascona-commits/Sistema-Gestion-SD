import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import * as XLSX from 'xlsx';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import './Reportes.css';

// IMPORTACIONES PARA GRÁFICAS
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

// REGISTRAMOS LOS COMPONENTES DE CHART.JS
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function Reportes() {
    const [todosLosTickets, setTodosLosTickets] = useState([]);
    const [reportes, setReportes] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [usuarioActual, setUsuarioActual] = useState(null);

    const [filtroTipo, setFiltroTipo] = useState('todos');
    const [filtroMes, setFiltroMes] = useState('');
    const [filtroInicio, setFiltroInicio] = useState('');
    const [filtroFin, setFiltroFin] = useState('');
    const [filtroSemana, setFiltroSemana] = useState('');
    const [semanasDisponibles, setSemanasDisponibles] = useState([]);

    // ESTADOS PARA GRÁFICAS
    const [mostrarGraficas, setMostrarGraficas] = useState(false);
    const [datosGraficas, setDatosGraficas] = useState(null);

    const [resumen, setResumen] = useState({
        totalTickets: 0, abiertos: 0, atendidos: 0,
        fueraSlaAsignacion: 0, fueraSlaAtencion: 0,
        promedioDiasAsignacion: 0, promedioDiasAtencion: 0
    });

    // HORARIO EFECTIVO: Lunes a Viernes, 9 a 1 y 2 a 6. (Total 8h al día = 480 min)
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
            
            if (dia >= 1 && dia <= 5) {
                const yyyy = actual.getFullYear();
                const mm = String(actual.getMonth() + 1).padStart(2, '0');
                const dd = String(actual.getDate()).padStart(2, '0');
                const fechaLocalStr = `${yyyy}-${mm}-${dd}`;

                if (!feriadosSet.has(fechaLocalStr)) {
                    if ((hora >= 9 && hora < 13) || (hora >= 14 && hora < 18)) {
                        minutosLaborables++;
                    }
                }
            }
            actual.setMinutes(actual.getMinutes() + 1);
        }
        return minutosLaborables / 480; // 1 día = 8 horas laborales
    };

    const generarSemanasDisponibles = (tickets) => {
        const semanas = new Map();
        tickets.forEach(t => {
            if (!t.fecha_asignacion) return;
            const fecha = new Date(t.fecha_asignacion);
            const dia = fecha.getDay();
            const diff = fecha.getDate() - dia + (dia === 0 ? -6 : 1);
            const lunes = new Date(fecha);
            lunes.setDate(diff);
            lunes.setHours(0, 0, 0, 0);
            const domingo = new Date(lunes);
            domingo.setDate(lunes.getDate() + 6);
            domingo.setHours(23, 59, 59, 999);
            const value = `${lunes.getTime()}|${domingo.getTime()}`;
            const label = `${lunes.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })} al ${domingo.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
            if (!semanas.has(value)) {
                semanas.set(value, { value, label, time: lunes.getTime() });
            }
        });
        return Array.from(semanas.values()).sort((a, b) => b.time - a.time);
    };

    const calcularDatosMultiplesGraficas = (tickets) => {
        const statsSemanales = [
            { sumAsig: 0, countAsig: 0, sumRes: 0, countRes: 0, creados: 0, resueltos: 0 },
            { sumAsig: 0, countAsig: 0, sumRes: 0, countRes: 0, creados: 0, resueltos: 0 },
            { sumAsig: 0, countAsig: 0, sumRes: 0, countRes: 0, creados: 0, resueltos: 0 },
            { sumAsig: 0, countAsig: 0, sumRes: 0, countRes: 0, creados: 0, resueltos: 0 },
            { sumAsig: 0, countAsig: 0, sumRes: 0, countRes: 0, creados: 0, resueltos: 0 },
        ];

        tickets.forEach(t => {
            if (!t.fecha_asignacion) return;
            const date = new Date(t.fecha_asignacion);
            const dayOfMonth = date.getDate();
            const weekIndex = Math.ceil(dayOfMonth / 7) - 1;

            if (weekIndex >= 0 && weekIndex < 5) {
                statsSemanales[weekIndex].creados++;
                if (['Cerrado', 'Atendido', 'Resuelto'].includes(t.estado)) {
                    statsSemanales[weekIndex].resueltos++;
                }

                if (t.dias_asignacion_real !== null) {
                    statsSemanales[weekIndex].sumAsig += t.dias_asignacion_real;
                    statsSemanales[weekIndex].countAsig++;
                }
                if (t.dias_atencion_real !== null) {
                    statsSemanales[weekIndex].sumRes += t.dias_atencion_real;
                    statsSemanales[weekIndex].countRes++;
                }
            }
        });

        const labels = ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4', 'Semana 5'];

        return {
            totales: {
                labels,
                datasets: [
                    { label: 'Total Horas en Asignación', data: statsSemanales.map(s => (s.sumAsig * 8).toFixed(1)), backgroundColor: 'rgba(245, 158, 11, 0.7)', borderColor: '#f59e0b', borderWidth: 1 },
                    { label: 'Total Horas en Resolución', data: statsSemanales.map(s => (s.sumRes * 8).toFixed(1)), backgroundColor: 'rgba(16, 185, 129, 0.7)', borderColor: '#10b981', borderWidth: 1 }
                ]
            },
            promedios: {
                labels,
                datasets: [
                    { label: 'Promedio Horas Asignación', data: statsSemanales.map(s => s.countAsig ? ((s.sumAsig / s.countAsig) * 8).toFixed(1) : 0), backgroundColor: 'rgba(59, 130, 246, 0.7)', borderColor: '#3b82f6', borderWidth: 1 },
                    { label: 'Promedio Horas Resolución', data: statsSemanales.map(s => s.countRes ? ((s.sumRes / s.countRes) * 8).toFixed(1) : 0), backgroundColor: 'rgba(99, 102, 241, 0.7)', borderColor: '#6366f1', borderWidth: 1 }
                ]
            },
            volumen: {
                labels,
                datasets: [
                    { label: 'Tickets Entrantes', data: statsSemanales.map(s => s.creados), backgroundColor: 'rgba(148, 163, 184, 0.7)', borderColor: '#94a3b8', borderWidth: 1 },
                    { label: 'Tickets Resueltos', data: statsSemanales.map(s => s.resueltos), backgroundColor: 'rgba(16, 185, 129, 0.7)', borderColor: '#10b981', borderWidth: 1 }
                ]
            }
        };
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

                let query = supabase.from('vista_tickets_completos')
                    .select('*')
                    .order('fecha_asignacion', { ascending: false, nullsFirst: false });

                if (usuario.rol !== 'Administrador') {
                    query = query.eq('responsable_id', usuario.id);
                }

                const { data, error } = await query;
                if (error) throw error;

                // FILTRO ESTRICTO: Ignora desestimados y los que pertenecen a MG (insensible a mayúsculas/minúsculas)
                const ticketsValidos = (data || []).filter(ticket => {
                    if (!ticket.estado) return true; // Si por algún motivo no tiene estado, lo dejamos pasar
                    
                    // Limpiamos el texto por si hay espacios extra y lo pasamos a minúsculas
                    const estadoActual = ticket.estado.trim().toLowerCase();
                    
                    // Comparamos con los nombres exactos que me mostraste en la imagen
                    const esBasura = estadoActual === 'desestimado' || estadoActual === 'corresponde a mg';
                    
                    // Si NO es basura, lo conservamos
                    return !esBasura;
                });

                const datosCorregidos = ticketsValidos.map(ticket => {
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
                setSemanasDisponibles(generarSemanasDisponibles(datosCorregidos));
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
                if (!t.fecha_asignacion) return false;
                const date = new Date(t.fecha_asignacion);
                return date.getFullYear() === parseInt(year) && (date.getMonth() + 1) === parseInt(month);
            });
            setDatosGraficas(calcularDatosMultiplesGraficas(filtrados));
        } else {
            setDatosGraficas(null);
            setMostrarGraficas(false);
        }

        if (filtroTipo === 'rango' && (filtroInicio || filtroFin)) {
            filtrados = filtrados.filter(t => {
                if (!t.fecha_asignacion) return false;
                const date = new Date(t.fecha_asignacion).getTime();
                const start = filtroInicio ? new Date(filtroInicio + 'T00:00:00').getTime() : 0;
                const end = filtroFin ? new Date(filtroFin + 'T23:59:59').getTime() : Infinity;
                return date >= start && date <= end;
            });
        } else if (filtroTipo === 'semana' && filtroSemana) {
            const [inicioTime, finTime] = filtroSemana.split('|');
            const inicio = parseInt(inicioTime);
            const fin = parseInt(finTime);

            filtrados = filtrados.filter(t => {
                if (!t.fecha_asignacion) return false;
                const tiempoTicket = new Date(t.fecha_asignacion).getTime();
                return tiempoTicket >= inicio && tiempoTicket <= fin;
            });
        }
        setReportes(filtrados);
        calcularResumen(filtrados);
    }, [filtroTipo, filtroMes, filtroSemana, filtroInicio, filtroFin, todosLosTickets]);

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
        return new Date(fechaIso).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const exportarExcel = () => {
        if (!reportes.length) return alert("No hay datos para exportar.");

        // --- HOJA 1: DATOS PRINCIPALES Y DETALLE ---
        const datosExcel = [
            ["REPORTE DE NIVEL DE SERVICIO (SLA)"],
            [], 
            ["RESUMEN DEL PERIODO"],
            ["Total Creados", "Abiertos", "Resueltos", "Prom. Asignación (días)", "Prom. Resolución (días)", "Fuera de SLA"],
            [
                resumen.totalTickets, resumen.abiertos, resumen.atendidos,
                resumen.promedioDiasAsignacion.toFixed(2), resumen.promedioDiasAtencion.toFixed(2),
                resumen.fueraSlaAsignacion + resumen.fueraSlaAtencion
            ],
            [], 
            ["DETALLE DE TICKETS"],
            ["Ticket", "Prioridad", "Responsable", "Fecha Creación", "Fecha Asignación", "T. Asignación Real (días)", "SLA Atención Máxima", "T. Resolución Real (días)", "Retraso (días)", "Estado"]
        ];

        reportes.forEach(rep => {
            datosExcel.push([
                rep.codigo_ticket,
                rep.prioridad || 'Normal',
                rep.responsable || 'Sin asignar',
                formatearFecha(rep.fecha_creacion_sd),
                rep.fecha_asignacion ? formatearFecha(rep.fecha_asignacion) : 'Pendiente',
                rep.dias_asignacion_real !== null ? Number(rep.dias_asignacion_real.toFixed(2)) : 'Pendiente',
                formatearFecha(rep.fecha_maxima_atencion),
                rep.dias_atencion_real !== null ? Number(rep.dias_atencion_real.toFixed(2)) : 'En proceso',
                rep.dias_retraso_actual > 0 ? Number(rep.dias_retraso_actual.toFixed(2)) : 0,
                rep.estado || 'Abierto'
            ]);
        });

        const hojaPrincipal = XLSX.utils.aoa_to_sheet(datosExcel);
        const libro = XLSX.utils.book_new();
        
        // Agregamos la primera hoja al libro
        XLSX.utils.book_append_sheet(libro, hojaPrincipal, "Reporte SLA");

        // --- HOJA 2: DATOS DE LAS GRÁFICAS (TENDENCIAS SEMANALES) ---
        // Solo generamos esta hoja si estamos viendo un mes y hay datos de gráficas
        if (datosGraficas) {
            const datosTendencias = [
                ["TENDENCIAS SEMANALES (DATOS DE LAS GRÁFICAS)"],
                [],
                ["SEMANA", "TOTAL HORAS ASIGNACIÓN", "TOTAL HORAS RESOLUCIÓN", "PROM. HORAS ASIGNACIÓN", "PROM. HORAS RESOLUCIÓN", "TICKETS ENTRANTES", "TICKETS RESUELTOS"]
            ];

            // Extraemos los datos exactos que alimentan a Chart.js y los ponemos en columnas
            datosGraficas.totales.labels.forEach((semana, index) => {
                datosTendencias.push([
                    semana,
                    Number(datosGraficas.totales.datasets[0].data[index]),     // Total Horas Asignación
                    Number(datosGraficas.totales.datasets[1].data[index]),     // Total Horas Resolución
                    Number(datosGraficas.promedios.datasets[0].data[index]),   // Promedio Horas Asignación
                    Number(datosGraficas.promedios.datasets[1].data[index]),   // Promedio Horas Resolución
                    Number(datosGraficas.volumen.datasets[0].data[index]),     // Tickets Entrantes
                    Number(datosGraficas.volumen.datasets[1].data[index])      // Tickets Resueltos
                ]);
            });

            const hojaTendencias = XLSX.utils.aoa_to_sheet(datosTendencias);
            // Agregamos la segunda hoja al libro
            XLSX.utils.book_append_sheet(libro, hojaTendencias, "Tendencias Semanales");
        }

        const fechaHoy = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(libro, `Reporte_SLA_${fechaHoy}.xlsx`);
    };

    const descargarPDF = () => {
        if (!reportes.length) return alert("No hay datos para exportar.");

        const doc = new jsPDF('landscape');
        const fechaHoy = new Date().toISOString().slice(0, 10);

        doc.setFontSize(18);
        doc.text("Reporte de Nivel de Servicio (SLA)", 14, 20);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Generado el: ${fechaHoy}`, 14, 28);

        autoTable(doc, {
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
            headStyles: { fillColor: [59, 130, 246] }
        });

        // ==========================================
        // PÁGINAS INTERMEDIAS: UNA GRÁFICA POR HOJA
        // ==========================================
        const addChartToPDF = (chartId, title) => {
            const chartCanvas = document.getElementById(chartId);
            if (chartCanvas) {
                // Forzamos la creación de una hoja nueva para cada gráfica
                doc.addPage('landscape'); 
                
                doc.setFontSize(14);
                doc.setTextColor(0);
                doc.text(title, 14, 20); // Título en la parte superior de la nueva hoja
                
                // Capturamos la gráfica y la dibujamos ocupando un buen espacio
                const chartImage = chartCanvas.toDataURL("image/png", 1.0);
                doc.addImage(chartImage, 'PNG', 14, 30, 260, 120); 
            }
        };

        // Si el panel de gráficas está abierto, las capturamos e insertamos
        if (datosGraficas && mostrarGraficas) {
            addChartToPDF('chart-totales', 'Tendencia: Acumulado Total de Horas Trabajadas');
            addChartToPDF('chart-promedios', 'Tendencia: Promedio de Horas por Ticket');
            addChartToPDF('chart-volumen', 'Tendencia: Volumen de Tickets (Entrantes vs Resueltos)');
        }

        // ==========================================
        // PÁGINA FINAL: TABLA DE DETALLE DE TICKETS
        // ==========================================
        // Siempre creamos una hoja nueva para los detalles para que no se amontone
        doc.addPage('landscape'); 
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text("Detalle de Tickets", 14, 20);

        autoTable(doc, {
            startY: 30, // Empezamos un poco más arriba porque es hoja nueva
            head: [["Ticket", "Prioridad", "Responsable", "Fecha Creación", "F. Asignación", "T. Asignación", "SLA Máximo", "T. Resolución", "Retraso", "Estado"]],
            body: reportes.map(rep => [
                rep.codigo_ticket,
                rep.prioridad || '-',
                rep.responsable || 'Sin asignar',
                formatearFecha(rep.fecha_creacion_sd),
                rep.fecha_asignacion ? formatearFecha(rep.fecha_asignacion) : 'Pendiente',
                rep.dias_asignacion_real !== null ? `${rep.dias_asignacion_real.toFixed(2)} d` : 'Pendiente',
                formatearFecha(rep.fecha_maxima_atencion),
                rep.dias_atencion_real !== null ? `${rep.dias_atencion_real.toFixed(2)} d` : 'En proceso',
                rep.dias_retraso_actual > 0 ? `+${rep.dias_retraso_actual.toFixed(2)} d` : '0',
                rep.estado || 'Abierto'
            ]),
            theme: 'striped',
            headStyles: { fillColor: [51, 65, 85] },
            styles: { fontSize: 8 }
        });

        doc.save(`Reporte_SLA_${fechaHoy}.pdf`);
    };

    if (cargando) return (<div className="spinner-container"><div className="spinner"></div><span className="spinner-text">Calculando métricas...</span></div>);

    const esAdmin = usuarioActual?.rol === 'Administrador';

    return (
        <div className="reportes-container">
            <div className="rep-header">
                <div>
                    <h1 className="rep-title">Análisis de Nivel de Servicio (SLA)</h1>
                    <p className="rep-subtitle">{esAdmin ? "Vista Global: Monitoreo de tiempos de todo el equipo." : `Mis Métricas: Rendimiento de ${usuarioActual?.nombre || 'Agente'}`}</p>
                </div>
                <div className="rep-actions">
                    <button className="btn-outline" onClick={() => window.location.reload()}><span className="material-symbols-outlined">refresh</span></button>
                    {datosGraficas && (
                        <button className={`btn-export ${mostrarGraficas ? 'btn-red' : 'btn-blue'}`} onClick={() => setMostrarGraficas(!mostrarGraficas)}>
                            <span className="material-symbols-outlined">{mostrarGraficas ? 'bar_chart_off' : 'bar_chart'}</span> 
                            {mostrarGraficas ? 'Ocultar Panel de Gráficas' : 'Ver Gráficas Interactivas'}
                        </button>
                    )}
                    <button className="btn-outline" onClick={descargarPDF} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span className="material-symbols-outlined">picture_as_pdf</span> PDF</button>
                    <button className="btn-primary" onClick={exportarExcel} style={{ display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: '#10b981', borderColor: '#10b981', color: 'white' }}><span className="material-symbols-outlined">table_view</span> Excel</button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', backgroundColor: '#fff', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span className="material-symbols-outlined" style={{ color: '#64748b' }}>filter_alt</span><span style={{ fontWeight: '600', color: '#334155' }}>Periodo:</span></div>
                <select value={filtroTipo} onChange={(e) => { setFiltroTipo(e.target.value); setFiltroMes(''); setFiltroInicio(''); setFiltroFin(''); setFiltroSemana(''); }} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', cursor: 'pointer' }}>
                    <option value="todos">Todo el Histórico</option><option value="mes">Mes en Específico</option><option value="rango">Rango de Fechas</option><option value="semana">Por rango de semanas</option>
                </select>
                {filtroTipo === 'mes' && <input type="month" value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }} />}
                {filtroTipo === 'rango' && ( <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><input type="date" value={filtroInicio} onChange={(e) => setFiltroInicio(e.target.value)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }} /><span style={{ color: '#64748b', fontSize: '14px' }}>hasta</span><input type="date" value={filtroFin} onChange={(e) => setFiltroFin(e.target.value)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }} /></div> )}
                {filtroTipo === 'semana' && ( <select className="form-control" value={filtroSemana} onChange={(e) => setFiltroSemana(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', cursor: 'pointer' }}> <option value="">-- Seleccionar Semana --</option> {semanasDisponibles.map(sem => ( <option key={sem.value} value={sem.value}>{sem.label}</option> ))} </select> )}
            </div>

            <h2 className="section-title" style={{ marginBottom: '16px' }}>{filtroTipo === 'todos' ? 'Resumen Histórico General' : filtroTipo === 'mes' ? 'Resumen del Mes' : 'Resumen por Periodo Seleccionado'}</h2>

            <div className="kpi-grid">
                <div className="kpi-card"><div className="kpi-icon icon-blue"><span className="material-symbols-outlined">tag</span></div><div className="kpi-info"><h3>{resumen.totalTickets}</h3><p>Total Creados</p></div></div>
                <div className="kpi-card"><div className="kpi-icon icon-orange" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}><span className="material-symbols-outlined">pending_actions</span></div><div className="kpi-info"><h3>{resumen.abiertos}</h3><p>Tickets Abiertos</p></div></div>
                <div className="kpi-card"><div className="kpi-icon icon-green"><span className="material-symbols-outlined">task_alt</span></div><div className="kpi-info"><h3>{resumen.atendidos}</h3><p>Tickets Resueltos</p></div></div>
                <div className="kpi-card"><div className={`kpi-icon ${resumen.promedioDiasAsignacion > 1 ? 'icon-red' : 'icon-blue'}`}><span className="material-symbols-outlined">person_add</span></div><div className="kpi-info"><h3 style={{ color: resumen.promedioDiasAsignacion > 1 ? '#dc2626' : 'inherit' }}>{resumen.promedioDiasAsignacion.toFixed(1)} <span style={{ fontSize: '12px' }}>días</span></h3><p>Promedio Asignación</p></div></div>
                <div className="kpi-card"><div className="kpi-icon icon-blue"><span className="material-symbols-outlined">timer</span></div><div className="kpi-info"><h3>{resumen.promedioDiasAtencion.toFixed(1)} <span style={{ fontSize: '12px' }}>días</span></h3><p>Promedio Resolución</p></div></div>
                <div className="kpi-card"><div className={`kpi-icon ${(resumen.fueraSlaAsignacion > 0 || resumen.fueraSlaAtencion > 0) ? 'icon-red' : 'icon-green'}`}><span className="material-symbols-outlined">assignment_late</span></div><div className="kpi-info"><h3 style={{ color: (resumen.fueraSlaAsignacion > 0 || resumen.fueraSlaAtencion > 0) ? '#dc2626' : 'inherit' }}>{resumen.fueraSlaAsignacion + resumen.fueraSlaAtencion}</h3><p>Tickets fuera de SLA</p></div></div>
            </div>

            {/* --- PANEL INTERACTIVO DE GRÁFICAS SEPARADAS --- */}
            {datosGraficas && mostrarGraficas && (
                <div className="rep-content charts-container" style={{ marginBottom: '24px', backgroundColor: '#f8fafc', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 className="section-title" style={{ margin: 0 }}>Panel Gráfico de Tendencias Mensuales</h2>
                        <span style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>* Puedes hacer clic en las leyendas o pasar el ratón sobre las barras.</span>
                    </div>

                    {/* GRÁFICA 1: TOTAL DE HORAS */}
                    <div className="chart-wrapper" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '30px' }}>
                        <Bar 
                            id="chart-totales" // ID para captura PDF
                            data={datosGraficas.totales} 
                            options={{
                                responsive: true,
                                plugins: { 
                                    legend: { position: 'top' }, 
                                    title: { display: true, text: 'Acumulado Total de Horas Trabajadas', font: { size: 14 } },
                                    tooltip: { // MEJORA DE INTERACTIVIDAD
                                        mode: 'index',
                                        intersect: false,
                                        callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} horas` } 
                                    }
                                },
                                scales: { y: { beginAtZero: true, title: { display: true, text: 'Horas Laborables Totales' } } }
                            }} 
                        />
                    </div>

                    {/* GRÁFICA 2: PROMEDIO DE HORAS */}
                    <div className="chart-wrapper" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '30px' }}>
                        <Bar 
                            id="chart-promedios" // ID para captura PDF
                            data={datosGraficas.promedios} 
                            options={{
                                responsive: true,
                                plugins: { 
                                    legend: { position: 'top' }, 
                                    title: { display: true, text: 'Promedio de Horas por Ticket', font: { size: 14 } },
                                    tooltip: { // MEJORA DE INTERACTIVIDAD
                                        mode: 'index',
                                        intersect: false,
                                        callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} horas` } 
                                    }
                                },
                                scales: { y: { beginAtZero: true, title: { display: true, text: 'Horas Promedio' } } }
                            }} 
                        />
                    </div>

                    {/* GRÁFICA 3: VOLUMEN DE TICKETS */}
                    <div className="chart-wrapper" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <Bar 
                            id="chart-volumen" // ID para captura PDF
                            data={datosGraficas.volumen} 
                            options={{
                                responsive: true,
                                plugins: { 
                                    legend: { position: 'top' }, 
                                    title: { display: true, text: 'Volumen de Tickets (Entrantes vs Resueltos)', font: { size: 14 } },
                                    tooltip: { // MEJORA DE INTERACTIVIDAD
                                        mode: 'index',
                                        intersect: false,
                                        callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} tickets` } 
                                    }
                                },
                                scales: { y: { beginAtZero: true, title: { display: true, text: 'Cantidad de Tickets' } } }
                            }} 
                        />
                    </div>

                </div>
            )}

            {/* TABLA CON TOOLTIPS NATIVOS */}
            <div className="rep-content">
                <div className="section-header"><h2 className="section-title">Detalle de Tickets</h2></div>
                <div className="table-container">
                    <table className="ticket-table">
                        <thead>
                            <tr>
                                <th>Ticket</th>
                                {esAdmin && <th>Responsable</th>}
                                <th>Creación SD</th>
                                <th>Fecha Asignación</th>
                                <th className="text-center">T. Asignación</th>
                                <th className="text-center">SLA Atención</th>
                                <th className="text-center">T. Resolución Real</th>
                                <th className="text-center">Retraso</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportes.length === 0 ? ( <tr><td colSpan={esAdmin ? 9 : 8} className="text-center">No se encontraron tickets en este periodo.</td></tr> ) : (
                                reportes.map((rep) => (
                                    <tr 
                                        key={rep.id || rep.ticket_id} 
                                        title={`Ticket: ${rep.codigo_ticket}\nDescripción: ${rep.descripcion || 'Sin descripción'}\nPrioridad: ${rep.prioridad || 'N/A'}`} // TOOLTIP EN LA FILA
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <td className="t-id font-bold">{rep.codigo_ticket}</td>
                                        {esAdmin && <td className="t-assigned">{rep.responsable || 'Sin asignar'}</td>}
                                        <td className="t-date">{formatearFecha(rep.fecha_creacion_sd)}</td>
                                        <td className="t-date">{rep.fecha_asignacion ? formatearFecha(rep.fecha_asignacion) : <span style={{ color: '#94a3b8' }}>Pendiente</span>}</td>
                                        <td className="text-center font-bold"> {rep.dias_asignacion_real === null ? <span style={{ color: '#94a3b8' }}>Pendiente</span> : <span style={{ color: rep.asignacion_fuera_tiempo ? '#dc2626' : '#16a34a' }}>{rep.dias_asignacion_real.toFixed(1)} d</span>} </td>
                                        <td className="text-center t-date" style={{ fontSize: '12px' }}>{formatearFecha(rep.fecha_maxima_atencion) || '-'}</td>
                                        <td className="text-center font-bold"> {rep.dias_atencion_real === null ? <span style={{ color: '#94a3b8' }}>En proceso</span> : <span style={{ color: rep.atencion_fuera_tiempo ? '#dc2626' : '#16a34a' }}>{rep.dias_atencion_real.toFixed(1)} d</span>} </td>
                                        <td className="text-center font-bold"> {rep.dias_retraso_actual > 0 ? <span style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>+{rep.dias_retraso_actual.toFixed(1)} d</span> : <span style={{ color: '#94a3b8' }}>-</span>} </td>
                                        <td> <span className={`status-pill ${['Cerrado', 'Atendido', 'Resuelto'].includes(rep.estado) ? 'status-resolved' : 'status-open'}`}>{rep.estado || 'Abierto'}</span> </td>
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
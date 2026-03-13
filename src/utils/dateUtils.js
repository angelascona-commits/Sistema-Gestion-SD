// src/utils/dateUtils.js

export const calcularDiasRetrasoHabiles = (fechaLimite, fechaCierre) => {
  if (!fechaLimite) return 0;

  // Convertimos a fechas y quitamos las horas para comparar solo los días limpios
  const inicio = new Date(fechaLimite);
  inicio.setHours(0, 0, 0, 0);

  // Si hay fecha de cierre usamos esa, si está abierto usamos la fecha de HOY
  const fin = fechaCierre ? new Date(fechaCierre) : new Date();
  fin.setHours(0, 0, 0, 0);

  // Si se cerró antes o el mismo día límite, no hay retraso
  if (fin <= inicio) return 0;

  let diasRetraso = 0;
  
  // Empezamos a contar desde el día SIGUIENTE a la fecha límite
  let fechaActual = new Date(inicio);
  fechaActual.setDate(fechaActual.getDate() + 1);

  // Lista de feriados oficiales en Perú
  const feriadosPeru = [
    // Fijos (Mes-Día)
    '01-01', // Año nuevo
    '05-01', // Día del Trabajo
    '06-07', // Batalla de Arica y Día de la Bandera
    '06-29', // San Pedro y San Pablo
    '07-23', // Día de la Fuerza Aérea
    '07-28', // Fiestas Patrias
    '07-29', // Fiestas Patrias
    '08-06', // Batalla de Junín
    '08-30', // Santa Rosa de Lima
    '10-08', // Combate de Angamos
    '11-01', // Todos los Santos
    '12-08', // Inmaculada Concepción
    '12-09', // Batalla de Ayacucho
    '12-25', // Navidad
    
    // Móviles (YYYY-MM-DD)
    '2024-03-28', '2024-03-29', // Semana Santa 2024
    '2025-04-17', '2025-04-18', // Semana Santa 2025
    '2026-04-02', '2026-04-03'  // Semana Santa 2026
  ];

  while (fechaActual <= fin) {
    const diaSemana = fechaActual.getDay(); // 0 = Domingo, 6 = Sábado
    
    const mes = String(fechaActual.getMonth() + 1).padStart(2, '0');
    const dia = String(fechaActual.getDate()).padStart(2, '0');
    const anio = fechaActual.getFullYear();
    
    const formatoCorto = `${mes}-${dia}`;
    const formatoLargo = `${anio}-${mes}-${dia}`;

    const esFeriado = feriadosPeru.includes(formatoCorto) || feriadosPeru.includes(formatoLargo);
    const esFinDeSemana = diaSemana === 0 || diaSemana === 6;

    if (!esFinDeSemana && !esFeriado) {
      diasRetraso++;
    }

    fechaActual.setDate(fechaActual.getDate() + 1);
  }

  return diasRetraso;
};
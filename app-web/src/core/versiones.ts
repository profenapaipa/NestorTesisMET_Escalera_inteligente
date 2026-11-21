// Historial de versiones de Escalera Inteligente, para mostrarlo en la
// aplicación (distintivo de versión). El detalle completo está en CHANGELOG.md;
// aquí, una fila por versión para ver de un vistazo cómo ha evolucionado.
//
// El historial PÚBLICO (repositorio NestorTesisMET_Escalera_inteligente)
// empieza en 0.11.0. Las versiones anteriores se desarrollaron en el
// repositorio privado de la tesis y se numeraron el 2026-11-20 a partir de los
// hitos de su historial de commits.

export type Version = {
  version: string
  fecha: string // AAAA-MM-DD
  titulo: string
  cambios: string
  publica: boolean // ¿está en el historial del repositorio público?
}

export const HISTORIAL_VERSIONES: Version[] = [
  {
    version: '0.12.1', fecha: '2026-11-21', publica: true,
    titulo: 'Textos sin montarse en celular y computador',
    cambios: 'Barra superior en dos carriles: las pestañas no se parten en dos líneas y las acciones (versión, Terminar sesión, perfil) siempre se ven; nombres cortos de pestaña cuando no caben; en el celular, «Cómo usar esta vista» empieza cerrada, las tarjetas de nivel del tutorial y las de Pausar/Pensar/Actuar ya no se exprimen y los títulos de sección bajan de línea en vez de partirse.',
  },
  {
    version: '0.12.0', fecha: '2026-11-21', publica: true,
    titulo: 'Accesibilidad',
    cambios: 'Página en español para lectores de pantalla; más contraste en textos secundarios y bordes; conexión de cada cubo con símbolo además del color; respeto de «reducir movimiento»; controles de 44 px en pantallas táctiles; pestañas como navegación con nombre; avisos del tutorial anunciados.',
  },
  {
    version: '0.11.0', fecha: '2026-11-21', publica: true,
    titulo: 'Primera versión pública con historial propio',
    cambios: 'Colores de los grafos auditados para daltonismo y contraste; leyenda y «cómo leerlo» en cada grafo; correcciones de una auditoría independiente (análisis de la mediación, motor PPA, importación, exportación).',
  },
  {
    version: '0.10.0', fecha: '2026-11-20', publica: false,
    titulo: 'Celulares, ayuda integrada y grafos para publicar',
    cambios: 'Interfaz adaptada a celulares; limitaciones conocidas y guía rápida en la app; paleta académica; figura HD de cada grafo con leyenda y créditos.',
  },
  {
    version: '0.9.0', fecha: '2026-11-20', publica: false,
    titulo: 'Versionado y trazabilidad',
    cambios: 'Versión y commit en cada informe, sesión y paquete; fechas al segundo con zona horaria; HTML interactivo con rutas mínimas; perfiles simulados descriptivos.',
  },
  {
    version: '0.8.0', fecha: '2026-11-20', publica: false,
    titulo: 'Repositorio público y protección de datos',
    cambios: 'Software publicado aparte; ejemplos sintéticos; credenciales fuera del código; un motor de mediación para las tres vistas; paquete de datos seudonimizado; marcadores EEG.',
  },
  {
    version: '0.7.0', fecha: '2026-10-22', publica: false,
    titulo: 'Métricas, mediación y cubos v3',
    cambios: 'Agregación ponderada y eficiencia; tiempos de planificación; efecto de la mediación en los informes; firmware v3 tras la prueba de banco; respaldo durable.',
  },
  {
    version: '0.6.0', fecha: '2026-10-17', publica: false,
    titulo: 'Tablero físico en vivo',
    cambios: 'Estado real del tablero, vista del jugador, telemetría de los cubos y sincronización con el EEG.',
  },
  {
    version: '0.5.0', fecha: '2026-10-08', publica: false,
    titulo: 'Informes y perfiles',
    cambios: 'Informes en dos niveles, perfiles con historial, publicación en GitHub Pages; las métricas consideran que la solución mínima no es única.',
  },
  {
    version: '0.4.0', fecha: '2026-10-02', publica: false,
    titulo: 'Reglas oficiales y grafo de estados',
    cambios: 'Reglas del juego según el libro (Fig. 3.3) y grafo del espacio del problema en vivo.',
  },
  {
    version: '0.3.0', fecha: '2026-09-25', publica: false,
    titulo: 'Tutorial y simulación',
    cambios: 'Tutorial guiado con motor pedagógico, Simulación libre y Vista de observador.',
  },
  {
    version: '0.2.0', fecha: '2026-09-18', publica: false,
    titulo: 'Consola de operación',
    cambios: 'Menor latencia entre maestro y cubos, control de partida con código de colores e identidad visual.',
  },
  {
    version: '0.1.0', fecha: '2026-09-01', publica: false,
    titulo: 'Estructura propia sobre ACACIA',
    cambios: 'Pestañas de Control, Simulación y Observador, controlador simulado y bitácoras, sobre la línea base del proyecto ACACIA (módulo INNOVA).',
  },
]


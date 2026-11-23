// Historial de versiones de Escalera Inteligente, para mostrarlo en la
// aplicación (distintivo de versión → «Historial de versiones»). Cada versión
// trae un resumen de una línea y su detalle, clasificado para que se vea qué
// errores se corrigieron y qué cambió en cada una. La fuente es CHANGELOG.md:
// si se edita uno, se edita el otro.
//
// El historial PÚBLICO (repositorio NestorTesisMET_Escalera_inteligente)
// empieza en 0.11.0. Las versiones anteriores se desarrollaron en el
// repositorio privado de la tesis y se numeraron el 2026-11-20 a partir de los
// hitos de su historial de commits.

// novedad: algo que antes no existía · mejora: algo que ya existía y ahora
// funciona o se ve mejor · correccion: un error que se arregló (qué fallaba).
export type TipoCambio = 'novedad' | 'mejora' | 'correccion'

export type Cambio = { tipo: TipoCambio; texto: string }

export type Version = {
  version: string
  fecha: string // AAAA-MM-DD
  titulo: string
  cambios: string // resumen de una línea (tabla del CHANGELOG)
  detalle: Cambio[]
  publica: boolean // ¿está en el historial del repositorio público?
}

const n = (texto: string): Cambio => ({ tipo: 'novedad', texto })
const m = (texto: string): Cambio => ({ tipo: 'mejora', texto })
const c = (texto: string): Cambio => ({ tipo: 'correccion', texto })

export const HISTORIAL_VERSIONES: Version[] = [
  {
    version: '0.13.0', fecha: '2026-11-23', publica: true,
    titulo: 'Enlace confiable con el maestro y pausa técnica',
    cambios: 'El servidor y la pantalla reconocen envíos repetidos o perdidos del maestro y avisan si se reinició; pausa técnica separada de Pausar; la vista del jugador ya no muestra diagnóstico; historial de versiones con el detalle de cada una.',
    detalle: [
      c('Una jugada que llegaba dos veces sumaba dos movimientos y duplicaba su marcador EEG. Ahora cada envío del maestro trae número de secuencia y las copias se descartan.'),
      c('Si el maestro se reiniciaba, la pantalla seguía con la lista de cubos anterior y podía iniciar un intento sin identificarlos. Ahora avisa del reinicio, cancela un inicio en curso y reidentifica los cubos solo cuando no hay un intento.'),
      n('El servidor cuenta envíos recibidos, repetidos, perdidos y tardíos (`/api/enlace`), y la bitácora anota cada salto de secuencia. El firmware publicado sigue siendo el v3, con el que todo funciona igual.'),
      m('La latencia de cada jugada se calcula con un reloj común entre el maestro y el servidor.'),
      n('Botón «Pausa técnica», aparte de «Pausar»: detiene el intento por un problema del montaje (cubo, batería, cable), se registra aparte (marcadores EEG 59 y 60) y el jugador ve un mensaje neutro.'),
      m('Cada jugada rechazada anota qué tan reciente era la información de conexión del cubo, para poder filtrar después las dudosas.'),
      m('La vista del jugador ya no muestra cuántos cubos hay conectados: eso queda solo en la consola del operador.'),
      m('El historial de versiones se despliega por versión y separa correcciones, mejoras y novedades.'),
    ],
  },
  {
    version: '0.12.3', fecha: '2026-11-21', publica: true,
    titulo: 'El juego al centro de la atención',
    cambios: 'Simulación libre y Tutorial guiado: el tablero ocupa el 60 % del ancho y el grafo el 40 % (antes el grafo se llevaba más de la mitad). Vista de observador: tablero, registro de observaciones y grafo, en ese orden, con el cronómetro centrado.',
    detalle: [
      c('Simulación libre y Tutorial guiado: el grafo ocupaba más de la mitad de la pantalla y dejaba el tablero, que es donde está la atención, a un lado. Ahora el tablero ocupa 3/5 del ancho y el grafo 2/5 (en pantallas de 1100 px o más).'),
      m('Vista de observador: nuevo orden, con el tablero en vivo, el registro de observaciones y el grafo de estados.'),
      m('El cronómetro del observador queda centrado, como en Control; en el celular todo va en una columna.'),
    ],
  },
  {
    version: '0.12.2', fecha: '2026-11-21', publica: true,
    titulo: 'Logo oficial en la pestaña del navegador',
    cambios: 'La pestaña del navegador muestra la marca de Escalera Inteligente (escalera azul y roja) en lugar del ícono genérico de la herramienta de compilación, que además no cargaba en GitHub Pages; ícono para iPhone/iPad y color de la barra del navegador en el celular.',
    detalle: [
      c('La pestaña mostraba el ícono genérico de la herramienta de compilación, con una ruta que en GitHub Pages ni siquiera cargaba. Ahora muestra la escalera azul y roja del proyecto.'),
      n('Ícono para iPhone y iPad y respaldo en PNG para navegadores antiguos.'),
      n('En el celular, la barra del navegador toma el color de fondo de la aplicación.'),
    ],
  },
  {
    version: '0.12.1', fecha: '2026-11-21', publica: true,
    titulo: 'Textos sin montarse en celular y computador',
    cambios: 'Barra superior en dos carriles: las pestañas no se parten en dos líneas y las acciones (versión, Terminar sesión, perfil) siempre se ven; nombres cortos de pestaña cuando no caben; en el celular, «Cómo usar esta vista» empieza cerrada, las tarjetas de nivel del tutorial y las de Pausar/Pensar/Actuar ya no se exprimen y los títulos de sección bajan de línea en vez de partirse.',
    detalle: [
      c('En el computador, el botón «Terminar sesión» quedaba cortado o fuera de la barra. Ahora la barra tiene dos carriles y las acciones siempre se ven.'),
      c('Las pestañas se partían en dos líneas: ahora se desplazan y, si no caben, usan nombres cortos («1 · Control») con el nombre completo para lectores de pantalla.'),
      c('En el celular, las tarjetas de nivel del Tutorial y las de Pausar/Pensar/Actuar se exprimían hasta ser ilegibles; ahora van de dos en dos.'),
      c('En el celular, «Cómo usar esta vista» tapaba más de media pantalla; ahora empieza cerrada.'),
      m('Auditoría automática de las seis vistas en cinco anchos (390 a 1920 px): 0 textos desbordados, recortados o solapados.'),
    ],
  },
  {
    version: '0.12.0', fecha: '2026-11-21', publica: true,
    titulo: 'Accesibilidad',
    cambios: 'Página en español para lectores de pantalla; más contraste en textos secundarios y bordes; conexión de cada cubo con símbolo además del color; respeto de «reducir movimiento»; controles de 44 px en pantallas táctiles; pestañas como navegación con nombre; avisos del tutorial anunciados.',
    detalle: [
      c('Los lectores de pantalla leían la página con pronunciación inglesa: ahora se declara en español.'),
      c('Los campos que confirman con Enter se disparaban a mitad de una composición de teclado (IME).'),
      m('Contraste WCAG: texto secundario de 3,6:1 a 4,8:1; bordes de campos y botones de 1,8:1 a 3,4:1; casilla vacía de 2,3:1 a 3,1:1.'),
      m('La conexión de cada cubo ya no depende solo del color: ✓ si está conectado, ✕ si no.'),
      m('Se respeta «reducir movimiento» del sistema.'),
      m('Controles de al menos 44 px en pantallas táctiles; pestañas como navegación con nombre; el mensaje del Tutorial se anuncia.'),
    ],
  },
  {
    version: '0.11.0', fecha: '2026-11-21', publica: true,
    titulo: 'Primera versión pública con historial propio',
    cambios: 'Colores de los grafos auditados para daltonismo y contraste; leyenda y «cómo leerlo» en cada grafo; correcciones de una auditoría independiente (análisis de la mediación, motor PPA, importación, exportación).',
    detalle: [
      c('Análisis de la mediación: una sugerencia descartada mientras había una señal vigente le quitaba a esa señal la decisión que la siguió. Ahora se cuentan aparte («absorbidas» y «reemplazadas»).'),
      c('Motor PPA: al enviar otra fase no se cerraba la sugerencia pendiente; Pausar (dos fallas) no tenía prioridad sobre un Actuar pendiente; el tiempo sin mover no se reiniciaba tras una corrección o una pausa.'),
      c('Importación: las bitácoras importadas perdían la versión PPA, el origen y los motivos, y se reanalizaban distinto que en vivo.'),
      c('Exportación: la imagen HD del HTML fallaba si un grafo anterior no se había capturado.'),
      c('Una compilación con cambios sin guardar citaba una combinación de versión y commit que no existe; ahora lo dice («+commit-modificado»).'),
      c('Celular: el menú de perfil quedaba recortado.'),
      m('Colores de los grafos auditados (contraste y daltonismo): en el tema oscuro, el verde del inicio y el rojo del camino sin retorno se confundían con deuteranopia; ahora el par más cercano queda en ΔE 15,5.'),
      n('Leyenda de colores y formas y «Cómo leerlo» debajo de cada grafo, en el HTML y en el PDF.'),
    ],
  },
  {
    version: '0.10.0', fecha: '2026-11-20', publica: false,
    titulo: 'Celulares, ayuda integrada y grafos para publicar',
    cambios: 'Interfaz adaptada a celulares; limitaciones conocidas y guía rápida en la app; paleta académica; figura HD de cada grafo con leyenda y créditos.',
    detalle: [
      n('La aplicación se adapta a celulares: pestañas en una línea, columnas apiladas y tableros de 11 casillas reducidos para caber completos.'),
      n('Distintivo «en desarrollo» que abre las limitaciones conocidas, y cada limitación también donde se decide.'),
      n('Guía rápida: «¿Primera vez?» en el inicio y «Cómo usar esta vista» en cada pestaña.'),
      m('Grafos con paleta apta para daltonismo (Okabe e Ito), legible también impresa en blanco y negro.'),
      n('Figura HD de cada grafo con leyenda, cómo leerla, créditos, versión y fecha.'),
    ],
  },
  {
    version: '0.9.0', fecha: '2026-11-20', publica: false,
    titulo: 'Versionado y trazabilidad',
    cambios: 'Versión y commit en cada informe, sesión y paquete; fechas al segundo con zona horaria; HTML interactivo con rutas mínimas; perfiles simulados descriptivos.',
    detalle: [
      n('Versión y commit en cada informe, sesión y paquete de datos; fechas al segundo con zona horaria.'),
      m('Mediación ppa-v2: tres anillos discretos y Actuar por tiempo con un umbral que fija quien opera (de 2 a 30 s). Se retiró la calibración por percentil 90.'),
      n('Informes en PDF con identidad del proyecto y de la UD, menú de descarga (PDF, HTML, CSV, JSON) y HTML interactivo con rutas mínimas.'),
      m('Las rutas mínimas pasan a magenta con contorno, para que se distingan aunque haya muchos recorridos encima.'),
      n('Cinco perfiles simulados con nombres descriptivos y cómo leer sus datos.'),
    ],
  },
  {
    version: '0.8.0', fecha: '2026-11-20', publica: false,
    titulo: 'Repositorio público y protección de datos',
    cambios: 'Software publicado aparte; ejemplos sintéticos; credenciales fuera del código; un motor de mediación para las tres vistas; paquete de datos seudonimizado; marcadores EEG.',
    detalle: [
      n('Repositorio público solo con el software, con sesiones de ejemplo sintéticas.'),
      c('Protección de datos: al arrancar se retiran las sesiones reales que una versión anterior dejó en los navegadores, y las credenciales salen del código.'),
      m('Un mismo motor de mediación para las tres vistas (antes solo Simulación libre sugería).'),
      n('Paquete de datos seudonimizado con diccionario, marcadores para EEG y verificación previa al inicio.'),
    ],
  },
  {
    version: '0.7.0', fecha: '2026-10-22', publica: false,
    titulo: 'Métricas, mediación y cubos v3',
    cambios: 'Agregación ponderada y eficiencia; tiempos de planificación; efecto de la mediación en los informes; firmware v3 tras la prueba de banco; respaldo durable.',
    detalle: [
      n('Agregación ponderada, eficiencia E y estratificación por nivel; tiempos de planificación y latencia por decisión.'),
      n('Efecto de la mediación en los informes.'),
      c('Cubos v3, con las correcciones que dejó la prueba de banco.'),
      c('Se perdían sesiones al cerrar el servidor o recargar: ahora hay respaldo durable y la misma información en pantalla y en archivo.'),
    ],
  },
  {
    version: '0.6.0', fecha: '2026-10-17', publica: false,
    titulo: 'Tablero físico en vivo',
    cambios: 'Estado real del tablero, vista del jugador, telemetría de los cubos y sincronización con el EEG.',
    detalle: [
      n('Estado real del tablero físico en la consola.'),
      n('Vista del jugador, para una segunda pantalla.'),
      n('Telemetría de los cubos (señal, batería, reinicios) y sincronización con el EEG.'),
    ],
  },
  {
    version: '0.5.0', fecha: '2026-10-08', publica: false,
    titulo: 'Informes y perfiles',
    cambios: 'Informes en dos niveles, perfiles con historial, publicación en GitHub Pages; las métricas consideran que la solución mínima no es única.',
    detalle: [
      n('Informes en dos niveles y perfiles con historial y trazabilidad entre sesiones.'),
      n('Publicación en GitHub Pages.'),
      c('Las métricas suponían una sola solución mínima; ahora tienen en cuenta que puede haber varias.'),
    ],
  },
  {
    version: '0.4.0', fecha: '2026-10-02', publica: false,
    titulo: 'Reglas oficiales y grafo de estados',
    cambios: 'Reglas del juego según el libro (Fig. 3.3) y grafo del espacio del problema en vivo.',
    detalle: [
      c('Las reglas del juego pasan a ser las oficiales del libro (Fig. 3.3).'),
      n('Grafo del espacio del problema, en vivo.'),
    ],
  },
  {
    version: '0.3.0', fecha: '2026-09-25', publica: false,
    titulo: 'Tutorial y simulación',
    cambios: 'Tutorial guiado con motor pedagógico, Simulación libre y Vista de observador.',
    detalle: [
      n('Tutorial guiado con motor pedagógico.'),
      n('Simulación libre y Vista de observador.'),
    ],
  },
  {
    version: '0.2.0', fecha: '2026-09-18', publica: false,
    titulo: 'Consola de operación',
    cambios: 'Menor latencia entre maestro y cubos, control de partida con código de colores e identidad visual.',
    detalle: [
      m('Menor latencia entre el maestro y los cubos.'),
      n('Control de partida con código de colores.'),
      m('Rediseño de la consola con identidad visual propia.'),
    ],
  },
  {
    version: '0.1.0', fecha: '2026-09-01', publica: false,
    titulo: 'Estructura propia sobre ACACIA',
    cambios: 'Pestañas de Control, Simulación y Observador, controlador simulado y bitácoras, sobre la línea base del proyecto ACACIA (módulo INNOVA).',
    detalle: [
      n('Pestañas de Control, Simulación y Observador, sobre la línea base del proyecto ACACIA (módulo INNOVA).'),
      n('Controlador simulado y bitácoras independientes.'),
    ],
  },
]

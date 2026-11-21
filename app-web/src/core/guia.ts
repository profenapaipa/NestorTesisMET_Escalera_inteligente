// Textos de la guía de uso y de las limitaciones conocidas: una sola fuente
// para la aplicación (pantalla de inicio, cada pestaña, ventana de
// limitaciones) y para la documentación del repositorio.
//
// Fase 1 (advertencias) y fase 2 (guía rápida) del plan del 2026-11-20.

export type Limitacion = { titulo: string; texto: string; donde: string }

// Lo que hay que saber antes de usar los datos. Cada una aparece también, en
// corto, en el lugar donde se toma la decisión (`donde`).
export const LIMITACIONES: Limitacion[] = [
  {
    titulo: 'Los datos viven solo en este equipo',
    texto: 'Sesiones e informes se guardan en el almacenamiento de este navegador, en este equipo. No se suben a internet ni se ven desde otro computador, y se pierden si se borran los datos del navegador. En Control, además, el servidor local escribe cada evento en un archivo de este computador (carpeta bitacoras/ del servidor), con el nombre del participante. Para conservar los datos: «Descargar copia» en Informes, una carpeta de sesión, o descargar cada informe.',
    donde: 'Pantalla de inicio e Informes',
  },
  {
    titulo: 'El análisis de la mediación es descriptivo, no causal',
    texto: 'Compara las decisiones que siguieron a una señal con las que siguieron a un anillo lleno que no se envió. Como la persona que opera decide qué enviar, la diferencia no prueba que la señal la cause; describe lo que ocurrió.',
    donde: 'Bloque de mediación de los informes',
  },
  {
    titulo: 'Los perfiles de ejemplo son simulados',
    texto: 'Los perfiles «Simulado» los genera el programa con las mismas reglas del juego para ilustrar combinaciones de ramificación y buclicidad. No son personas ni resultados de ningún estudio.',
    donde: 'Pantalla de inicio e Informes',
  },
]

// Fase 2 · Guía rápida: los tres caminos de la pantalla de inicio.
export const CAMINOS = [
  {
    titulo: 'Probar sin hardware',
    pasos: 'Entra con un perfil (o ADMIN) y abre Tutorial guiado o Simulación libre. Todo queda registrado y luego se ve en Informes.',
  },
  {
    titulo: 'Sesión con los cubos',
    pasos: 'Enciende la base y los cubos y arranca el servidor (Guía de encendido en Control). Escribe el participante y quien opera, revisa la verificación previa e inicia el intento.',
  },
  {
    titulo: 'Analizar datos',
    pasos: 'En Informes elige un perfil: informe de la sesión, informe entre sesiones y paquete de datos (CSV con diccionario). Los perfiles simulados sirven para practicar la lectura de R y β.',
  },
]

// Fase 2 · «Cómo usar esta vista», por pestaña.
export const GUIA_VISTA: Record<string, { pasos: string[]; ojo?: string }> = {
  control: {
    pasos: [
      'Escribe quién opera y elige los pares; revisa la verificación previa (base, cubos, lectura del tablero).',
      'Inicia el intento: la ronda de identificación por IP confirma qué cubo hay en cada casilla.',
      'Los anillos de mediación se llenan solos; tú decides cuándo enviar cada fase tocando su anillo, o la dejas pasar.',
      'Abre la Vista del jugador en otra pantalla para quien juega, y usa los marcadores para el EEG si se está registrando.',
    ],
    ojo: 'Necesita la base, los cubos y el servidor encendidos; sin ellos aparece «Desconectado».',
  },
  jugador: {
    pasos: ['Es la pantalla que mira quien juega: solo los cubos, el cronómetro (si el operador lo deja visible) y qué hacer tras una jugada inválida.'],
  },
  tutorial: {
    pasos: [
      'Cinco niveles, de uno a cinco pares: conviene hacerlos en orden.',
      'Las reglas se explican con animaciones; hay pistas a demanda y se puede deshacer.',
      'Cada nivel superado queda registrado para el informe.',
    ],
  },
  libre: {
    pasos: [
      'Elige los pares e inicia el intento: el juego completo, sin ayudas.',
      'El grafo de la derecha dibuja el recorrido en vivo sobre todas las posiciones posibles.',
      '«Control simulado» permite ensayar la mediación con los anillos, sin cubos.',
    ],
  },
  observador: {
    pasos: [
      'Espejo de Control, de solo lectura, para una segunda persona.',
      'Permite tomar notas y marcas cualitativas por intento.',
    ],
  },
  informes: {
    pasos: [
      'Elige un perfil para ver sus sesiones; «Ver informe» abre el informe de una sesión.',
      '«Generar informe macro» compara las sesiones de un perfil entre sí.',
      'Descarga en PDF, HTML, CSV o JSON, o guarda el informe en el historial del navegador.',
      'El paquete de datos trae las tablas en CSV con su diccionario, seudonimizado por defecto.',
    ],
    ojo: 'Todo se guarda en este navegador: descarga una copia para conservarlo.',
  },
}

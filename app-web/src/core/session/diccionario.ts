// Diccionario de datos del paquete de una sesión: UNA sola fuente.
//
// De aquí salen, sin reescribirlos a mano, tres cosas: las columnas (y su orden)
// de cada CSV, el DICCIONARIO.md que viaja en el paquete y el datapackage.json
// que lo describe para R y Python. Como el escritor de CSV rechaza cualquier
// columna que no esté aquí (ver `escribirCsv`) y `scripts/verificarPaquete.ts`
// comprueba lo contrario —que toda columna documentada se exporta—, el
// diccionario no puede desactualizarse sin que la compilación se detenga.
//
// Los símbolos son los de main.tex, sección «Fundamento matemático de las
// métricas de análisis» (ecuaciones 3.2 a 3.17).

import { CODIGOS_MARCADOR } from '../control/marcadoresEeg'

export type TipoColumna = 'texto' | 'entero' | 'numero' | 'booleano' | 'fecha-hora'

export type Columna = {
  nombre: string
  tipo: TipoColumna
  unidad?: string
  ecuacion?: string // número de ecuación de main.tex
  descripcion: string
  vacio?: string // cuándo va vacía: nunca se usa 0 ni «—» para un dato ausente
}

export type TablaDef = {
  archivo: string
  titulo: string
  descripcion: string
  columnas: Columna[]
}

export const ESQUEMA = 'escalera-datos/1.0'

const comunes: Columna[] = [
  { nombre: 'sesion_id', tipo: 'texto', descripcion: 'Identificador de la sesión de trabajo.' },
  { nombre: 'participante_id', tipo: 'texto', descripcion: 'Código seudónimo del participante (P01, P02…). El nombre real no viaja en el paquete salvo que se pida expresamente.' },
]

export const TABLAS: Record<string, TablaDef> = {
  eventos: {
    archivo: 'eventos.csv',
    titulo: 'Bitácora de eventos',
    descripcion: 'Una fila por evento de la sesión, en el orden en que se registraron, de todas las vistas (Control, Tutorial, Simulación libre, Observador).',
    columnas: [
      ...comunes,
      { nombre: 'evento_id', tipo: 'entero', descripcion: 'Orden del evento dentro de la sesión (1, 2, 3…).' },
      { nombre: 'ts_utc', tipo: 'fecha-hora', descripcion: 'Hora del evento, ISO 8601 en UTC con milisegundos. Ver `fuente_tiempo`.' },
      { nombre: 'ts_unix_ms', tipo: 'entero', unidad: 'ms', descripcion: 'La misma hora como milisegundos Unix (reloj del computador).' },
      { nombre: 't_rel_ms', tipo: 'entero', unidad: 'ms', ecuacion: '3.17', descripcion: 'Milisegundos desde que el tablero quedó disponible en ese intento (`juego_listo`): el origen de tiempos de la planificación.', vacio: 'el evento no pertenece a un intento o éste no registró `juego_listo`' },
      { nombre: 'fuente_tiempo', tipo: 'texto', descripcion: '`fisico_estimado`: la hora estimada del apoyo del cubo en el tablero (se restan espera en el maestro, mitad del viaje por la red y antirrebote). `pantalla`: la hora de llegada a la pantalla o de la acción en pantalla.' },
      { nombre: 'latencia_corregida_ms', tipo: 'entero', unidad: 'ms', descripcion: 'Cuántos ms antes de llegar a la pantalla se calcula que ocurrió el evento físico. Es una estimación, no una medida.', vacio: 'la hora es la de pantalla' },
      { nombre: 'desfase_reloj_ms', tipo: 'entero', unidad: 'ms', descripcion: 'Reloj de pared menos reloj monótono en el instante de registrar. Si cambia durante la sesión, el reloj del sistema se ajustó (ver `saltos_de_reloj` en sesion.json).', vacio: 'sesión anterior a este campo' },
      { nombre: 'seccion', tipo: 'texto', descripcion: 'Vista que lo registró: `control`, `tutorial`, `libre`, `observador`.' },
      { nombre: 'nivel_pares', tipo: 'entero', descripcion: 'Nivel jugado: número n de pares de fichas (1 a 5).' },
      { nombre: 'intento', tipo: 'entero', descripcion: 'Número de intento dentro de la vista.', vacio: 'evento fuera de un intento' },
      { nombre: 'tipo', tipo: 'texto', descripcion: 'Tipo de evento (`movimiento`, `falla`, `intento_iniciado`, `juego_listo`, `sugerencia_ppa`, `decision_ppa`, `victoria`…).' },
      { nombre: 'detalle', tipo: 'texto', descripcion: 'Descripción en lenguaje llano.' },
      { nombre: 'fase', tipo: 'texto', descripcion: 'Fase del ciclo: `pausar`, `pensar`, `actuar`.', vacio: 'el evento no es de mediación' },
      { nombre: 'decision', tipo: 'texto', descripcion: '`confirmada` o `descartada`: lo que hizo el operador con la sugerencia.', vacio: 'el evento no es una decisión del operador' },
      { nombre: 'origen', tipo: 'texto', descripcion: '`sugerencia` (el operador confirmó lo que el sistema sugirió) o `iniciativa` (la activó por su cuenta).', vacio: 'no es una activación' },
      { nombre: 'motivo', tipo: 'texto', descripcion: 'Motivo que disparó la sugerencia.', vacio: 'no es de mediación' },
      { nombre: 'version_ppa', tipo: 'texto', descripcion: 'Versión de la configuración PPA vigente cuando ocurrió el evento.', vacio: 'sesión anterior a la versión de configuración' },
      { nombre: 'nodo_grafo', tipo: 'entero', descripcion: 'Estado del grafo de estados en que quedó el tablero tras el evento (1…).', vacio: 'el evento no lleva posición' },
      { nombre: 'error_tipo', tipo: 'texto', descripcion: 'Regla infringida, si el evento es una jugada rechazada.', vacio: 'no es una falla' },
    ],
  },

  intentos: {
    archivo: 'intentos.csv',
    titulo: 'Intentos y métricas',
    descripcion: 'Una fila por intento terminado, con las métricas de trayectoria. Un dato que no se puede calcular va VACÍO, nunca como 0 o 1: un 0 en la ramificación significaría «siempre eligió lo mejor».',
    columnas: [
      ...comunes,
      { nombre: 'seccion', tipo: 'texto', descripcion: 'Vista: `control`, `tutorial`, `libre`, `observador`.' },
      { nombre: 'intento', tipo: 'entero', descripcion: 'Número de intento dentro de la vista.' },
      { nombre: 'nivel_pares', tipo: 'entero', descripcion: 'Número n de pares de fichas (1 a 5).' },
      { nombre: 'resultado', tipo: 'texto', descripcion: '`victoria`, `bloqueo` (solo quedaba la jugada que prohíbe la Regla 2) o `reiniciado`.' },
      { nombre: 'juego_listo_utc', tipo: 'fecha-hora', descripcion: 'Instante en que el tablero quedó disponible: origen de tiempos del intento.', vacio: 'la vista no registró `juego_listo`' },
      { nombre: 'fin_utc', tipo: 'fecha-hora', descripcion: 'Instante en que se cerró y registró el intento.' },
      { nombre: 'segundos', tipo: 'numero', unidad: 's', descripcion: 'Duración del intento en segundos.' },
      { nombre: 'L', tipo: 'entero', descripcion: 'Movimientos del intento, L.' },
      { nombre: 'D_estrella', tipo: 'entero', ecuacion: '3.2', descripcion: 'Mínimo de movimientos del nivel, D*(n) = n² + 2n.' },
      { nombre: 'Q', tipo: 'numero', ecuacion: '3.5', descripcion: 'Circuidad, L / D*.', vacio: 'el intento no ganó' },
      { nombre: 'E', tipo: 'numero', ecuacion: '3.6', descripcion: 'Eficiencia, D* / L, en (0, 1]. 1 = ruta mínima.', vacio: 'el intento no ganó' },
      { nombre: 'K', tipo: 'entero', ecuacion: '3.4', descripcion: 'Puntos de decisión: movimientos con más de una opción y no todas equivalentes, |K|.' },
      { nombre: 'R', tipo: 'numero', ecuacion: '3.8', descripcion: 'Ramificación: calidad media de las decisiones, en [0, 1]. 0 = siempre la mejor jugada.', vacio: 'K = 0: no hubo ninguna decisión' },
      { nombre: 'alfa', tipo: 'numero', ecuacion: '3.9', descripcion: 'Tasa de acierto: fracción de decisiones con C = 0.', vacio: 'K = 0' },
      { nombre: 'delta_media', tipo: 'numero', ecuacion: '3.10', descripcion: 'Grado de libertad medio del recorrido.', vacio: 'el intento no tiene movimientos' },
      { nombre: 'nu', tipo: 'entero', ecuacion: '3.11', descripcion: 'Retornos: veces que el paseo llega a un estado ya visitado, (L + 1) − |V(W)|.' },
      { nombre: 'beta', tipo: 'numero', ecuacion: '3.12', descripcion: 'Buclicidad normalizada, ν / L.', vacio: 'L = 0' },
      { nombre: 'mu', tipo: 'entero', ecuacion: '3.13', descripcion: 'Ciclos independientes (número ciclomático) del subgrafo recorrido.' },
      { nombre: 'V_distintos', tipo: 'entero', descripcion: 'Estados distintos visitados, |V(W)|.' },
      { nombre: 'tamanos_bucle', tipo: 'texto', descripcion: 'Longitud de cada bucle observado, separadas por espacio. Nunca menor que 6 (cuello del grafo).', vacio: 'ν = 0' },
      { nombre: 't_ini_ms', tipo: 'entero', unidad: 'ms', ecuacion: '3.17', descripcion: 'Tiempo hasta la primera jugada desde que el tablero quedó disponible.', vacio: 'el intento no trae marcas de tiempo' },
      { nombre: 't_dec_ms', tipo: 'entero', unidad: 'ms', ecuacion: '3.17', descripcion: 'Tiempo medio antes de las jugadas que eran punto de decisión (desde el segundo movimiento).', vacio: 'sin marcas de tiempo o sin decisiones' },
      { nombre: 't_for_ms', tipo: 'entero', unidad: 'ms', ecuacion: '3.17', descripcion: 'Tiempo medio antes de las jugadas sin elección real (desde el segundo movimiento).', vacio: 'sin marcas de tiempo o sin jugadas de ese tipo' },
      { nombre: 'n_sin_elegir_unica', tipo: 'entero', descripcion: 'Movimientos sin elección real porque solo había una jugada legal.' },
      { nombre: 'n_sin_elegir_equivalente', tipo: 'entero', descripcion: 'Movimientos sin elección real porque todas las jugadas dejaban la misma distancia a la meta.' },
      { nombre: 'faltas', tipo: 'entero', descripcion: 'Jugadas rechazadas durante el intento.' },
    ],
  },

  movimientos: {
    archivo: 'movimientos.csv',
    titulo: 'Detalle por movimiento',
    descripcion: 'Una fila por movimiento: lo que había para elegir, lo que se eligió y cuándo. Con esta tabla se reproducen todas las métricas del intento y se corta la señal del EEG por movimiento.',
    columnas: [
      ...comunes,
      { nombre: 'seccion', tipo: 'texto', descripcion: 'Vista en que ocurrió: control, tutorial, libre u observador.' },
      { nombre: 'intento', tipo: 'entero', descripcion: 'Número de intento.' },
      { nombre: 'nivel_pares', tipo: 'entero', descripcion: 'Número n de pares de fichas.' },
      { nombre: 'k', tipo: 'entero', descripcion: 'Número de movimiento dentro del intento (1…L).' },
      { nombre: 'nodo_previo', tipo: 'entero', descripcion: 'Estado de partida, s_{k−1}.' },
      { nombre: 'nodo', tipo: 'entero', descripcion: 'Estado alcanzado, s_k.' },
      { nombre: 'delta_k', tipo: 'entero', ecuacion: '3.3', descripcion: 'Grado de libertad: jugadas legales disponibles, sin volver al estado anterior (Regla 2).' },
      { nombre: 'd_min', tipo: 'entero', descripcion: 'Distancia a la meta que dejaba la mejor opción (un callejón sin salida cuenta como peor opción finita + 1).', vacio: 'ninguna opción llevaba a la meta' },
      { nombre: 'd_max', tipo: 'entero', descripcion: 'Distancia que dejaba la peor opción.', vacio: 'ninguna opción llevaba a la meta' },
      { nombre: 'd_elegida', tipo: 'entero', ecuacion: '3.7', descripcion: 'Distancia a la meta que dejó la jugada elegida.', vacio: 'ninguna opción llevaba a la meta' },
      { nombre: 'elegida_sin_salida', tipo: 'booleano', descripcion: 'La jugada elegida llevó a un callejón sin salida.' },
      { nombre: 'es_decision', tipo: 'booleano', ecuacion: '3.4', descripcion: 'El movimiento pertenece a K: había más de una opción y no todas eran equivalentes.' },
      { nombre: 'C_k', tipo: 'numero', ecuacion: '3.7', descripcion: 'Calidad del movimiento, (d_elegida − d_min) / (d_max − d_min), en [0, 1]. 0 = la mejor jugada.', vacio: 'no es punto de decisión' },
      { nombre: 'sin_elegir', tipo: 'texto', descripcion: '`unica` (una sola jugada legal) o `equivalente` (varias, todas a la misma distancia).', vacio: 'es punto de decisión' },
      { nombre: 'retorno', tipo: 'booleano', ecuacion: '3.11', descripcion: 'El estado alcanzado ya había sido visitado en el intento; cuenta para ν.' },
      { nombre: 't_rel_ms', tipo: 'entero', unidad: 'ms', ecuacion: '3.17', descripcion: 'Milisegundos desde que el tablero quedó disponible hasta este movimiento.', vacio: 'el intento no trae marcas de tiempo' },
      { nombre: 'intervalo_ms', tipo: 'entero', unidad: 'ms', ecuacion: '3.17', descripcion: 'Milisegundos desde el movimiento anterior (para k = 1, desde que el tablero quedó disponible).', vacio: 'sin marcas de tiempo' },
      { nombre: 'ts_unix_ms', tipo: 'entero', unidad: 'ms', descripcion: 'Hora Unix del movimiento (origen del intento + t_rel_ms).', vacio: 'sin marcas de tiempo o sin `juego_listo`' },
      { nombre: 'grupo_mediacion', tipo: 'texto', descripcion: '`con_senal`, `sugerida_descartada` o `sin_senal`: a qué grupo del análisis de la mediación pertenece esta decisión.', vacio: 'no es punto de decisión' },
      { nombre: 'fase_senal', tipo: 'texto', descripcion: 'Fase de la señal o sugerencia que abrió la ventana de atribución.', vacio: 'sin señal' },
    ],
  },

  mediacion_decisiones: {
    archivo: 'mediacion_decisiones.csv',
    titulo: 'Decisiones del análisis de la mediación',
    descripcion: 'Una fila por decisión real, con el grupo al que se atribuye. Una señal confirmada o una sugerencia descartada se atribuye a la primera decisión real de los tres movimientos siguientes.',
    columnas: [
      ...comunes,
      { nombre: 'seccion', tipo: 'texto', descripcion: 'Vista en que ocurrió: control, tutorial, libre u observador.' },
      { nombre: 'intento', tipo: 'entero', descripcion: 'Número de intento.', vacio: 'sin número de intento' },
      { nombre: 'k', tipo: 'entero', descripcion: 'Número de movimiento dentro del intento.' },
      { nombre: 'nodo', tipo: 'entero', descripcion: 'Estado alcanzado.' },
      { nombre: 'ts_utc', tipo: 'fecha-hora', descripcion: 'Hora de la decisión.' },
      { nombre: 'grupo', tipo: 'texto', descripcion: '`con_senal`, `sugerida_descartada` o `sin_senal`.' },
      { nombre: 'fase', tipo: 'texto', descripcion: 'Fase de la señal o sugerencia.', vacio: 'sin_senal' },
      { nombre: 'origen', tipo: 'texto', descripcion: '`sugerencia` o `iniciativa`.', vacio: 'sin_senal o sesión anterior a este campo' },
      { nombre: 'C_k', tipo: 'numero', ecuacion: '3.7', descripcion: 'Calidad de la decisión.' },
      { nombre: 'latencia_ms', tipo: 'entero', unidad: 'ms', ecuacion: '3.17', descripcion: 'Tiempo desde el movimiento anterior. En los grupos con señal incluye lo que dura la señal: sale mayor por construcción.', vacio: 'sin marca de tiempo previa' },
      { nombre: 'latencia_desde_senal_ms', tipo: 'entero', unidad: 'ms', descripcion: 'Tiempo desde que la señal terminó (o desde que se descartó la sugerencia). Es el que mide cuánto tardó en decidir una vez libre.', vacio: 'sin_senal, o la jugada se hizo con la señal aún encendida' },
    ],
  },

  marcadores_eeg: {
    archivo: 'marcadores_eeg.csv',
    titulo: 'Marcadores para el EEG',
    descripcion: 'Los marcadores que alinean la sesión con el registro EEG. Salen de la bitácora, así que existen para todas las vistas. Los códigos están en codigos_marcador.csv y no cambian entre sesiones.',
    columnas: [
      ...comunes,
      { nombre: 'timestamp_unix', tipo: 'numero', unidad: 's', descripcion: 'Hora Unix en segundos con milisegundos: la misma unidad de la columna Timestamp del OpenBCI GUI.' },
      { nombre: 'hora_iso', tipo: 'fecha-hora', descripcion: 'La misma hora en ISO 8601 UTC.' },
      { nombre: 'codigo', tipo: 'entero', descripcion: 'Código numérico del marcador.' },
      { nombre: 'evento', tipo: 'texto', descripcion: 'Nombre del marcador.' },
      { nombre: 'detalle', tipo: 'texto', descripcion: 'Descripción del evento que lo originó.' },
      { nombre: 'intento', tipo: 'entero', descripcion: 'Número de intento.', vacio: 'fuera de un intento' },
      { nombre: 'origen', tipo: 'texto', descripcion: '`tablero` (jugada física), `operador`, `pantalla` (jugada en pantalla) o `sistema`.' },
      { nombre: 'latencia_ms', tipo: 'entero', unidad: 'ms', descripcion: 'Solo jugadas físicas: ms antes de llegar a la pantalla en que se estima que ocurrió.', vacio: 'no es una jugada física' },
    ],
  },

  ventanas: {
    archivo: 'ventanas.csv',
    titulo: 'Ventanas para segmentar el EEG',
    descripcion: 'Intervalos con inicio y fin: línea base, cada intento y cada señal confirmada. Es lo que necesita el análisis por ventana (alfa TRP) en vez de «ventanas fijas desde el inicio del archivo».',
    columnas: [
      ...comunes,
      { nombre: 'ventana_id', tipo: 'entero', descripcion: 'Número de la ventana dentro de la sesión.' },
      { nombre: 'tipo', tipo: 'texto', descripcion: '`basal`, `intento`, `pausar`, `pensar` o `actuar`.' },
      { nombre: 'seccion', tipo: 'texto', descripcion: 'Vista en que ocurrió.', vacio: 'la línea base no pertenece a una vista' },
      { nombre: 'intento', tipo: 'entero', descripcion: 'Número de intento.', vacio: 'línea base' },
      { nombre: 'nivel_pares', tipo: 'entero', descripcion: 'Nivel jugado.', vacio: 'línea base' },
      { nombre: 'inicio_unix', tipo: 'numero', unidad: 's', descripcion: 'Inicio, hora Unix en segundos.' },
      { nombre: 'fin_unix', tipo: 'numero', unidad: 's', descripcion: 'Fin, hora Unix en segundos.' },
      { nombre: 'inicio_utc', tipo: 'fecha-hora', descripcion: 'Inicio en ISO 8601 UTC.' },
      { nombre: 'fin_utc', tipo: 'fecha-hora', descripcion: 'Fin en ISO 8601 UTC.' },
      { nombre: 'duracion_ms', tipo: 'entero', unidad: 'ms', descripcion: 'Duración de la ventana.' },
      { nombre: 'inicio_muestra', tipo: 'entero', descripcion: 'Muestra del EEG en que empieza. La completa herramientas/sincronizar_eeg.py.', vacio: 'todavía no alineado con un registro EEG' },
      { nombre: 'fin_muestra', tipo: 'entero', descripcion: 'Muestra del EEG en que termina.', vacio: 'todavía no alineado con un registro EEG' },
    ],
  },
}

export const CODIGOS_DESCRIPCION: Record<string, string> = {
  intento_iniciado: 'Se pulsó Iniciar (empieza la cuenta regresiva).',
  inicio_juego: '«¡YA!»: el tablero queda disponible; origen de tiempos.',
  cubo_levantado: 'Un cubo deja su casilla (inicio del movimiento físico).',
  jugada_valida: 'Una jugada aceptada.',
  falla_movimiento: 'Jugada rechazada.',
  pausa_automatica: 'Pausa automática hasta corregir una jugada inválida.',
  correccion_completada: 'Se corrigió la jugada inválida.',
  pausa_operador: 'El operador pausa la partida.',
  reanudar_operador: 'El operador reanuda la partida.',
  senal_pausar: 'Señal Pausar confirmada.',
  senal_pensar: 'Señal Pensar confirmada.',
  senal_actuar: 'Señal Actuar confirmada.',
  senal_estado_inicial: 'Señal de estado inicial.',
  victoria: 'El intento llegó a la meta.',
  derrota: 'El intento quedó bloqueado.',
  reinicio_manual: 'El operador reinició el intento.',
  tablero_reordenado: 'Se reordenó el tablero.',
  terminar_operador: '«Terminar»: intento cerrado como interrumpido.',
  basal_inicio: 'Empieza el intervalo de referencia sin tarea (para la potencia relativa a la tarea).',
  basal_fin: 'Termina el intervalo de referencia.',
  sesion_fin: 'Termina la sesión de registro.',
  calibracion: 'Artefacto deliberado (parpadeo) para medir el desfase del reloj.',
  sugerencia_ppa: 'El sistema sugiere una fase del ciclo (nada se activa solo).',
  sugerencia_descartada: 'El operador descarta la sugerencia.',
  deshacer: 'El participante deshace la última jugada (vistas en pantalla).',
  pista: 'El participante pide una pista (vistas en pantalla).',
  callejon_sin_salida: 'El participante entra en un callejón sin salida.',
}

export const TABLA_CODIGOS: TablaDef = {
  archivo: 'codigos_marcador.csv',
  titulo: 'Códigos de los marcadores',
  descripcion: 'Qué significa cada código de marcador. Son fijos: no cambian entre sesiones.',
  columnas: [
    { nombre: 'codigo', tipo: 'entero', descripcion: 'Código numérico.' },
    { nombre: 'evento', tipo: 'texto', descripcion: 'Nombre del marcador.' },
    { nombre: 'significado', tipo: 'texto', descripcion: 'Qué ocurrió.' },
  ],
}

export const TODAS: TablaDef[] = [...Object.values(TABLAS), TABLA_CODIGOS]

export type Valor = string | number | boolean | null | undefined

const FORMATO_NUM = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(6))))

function celda(v: Valor): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return Number.isFinite(v) ? FORMATO_NUM(v) : ''
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

// Escribe un CSV con las columnas y el orden del diccionario. Rechaza una fila
// con una clave que no esté documentada: así no puede exportarse nada sin
// diccionario.
export function escribirCsv(tabla: TablaDef, filas: Record<string, Valor>[]): string {
  const nombres = tabla.columnas.map(c => c.nombre)
  const conocidos = new Set(nombres)
  for (const f of filas) {
    for (const k of Object.keys(f)) {
      if (!conocidos.has(k)) throw new Error(`La columna «${k}» de ${tabla.archivo} no está en el diccionario de datos.`)
    }
  }
  return [nombres.join(','), ...filas.map(f => nombres.map(n => celda(f[n])).join(','))].join('\n') + '\n'
}

export function tablaCodigos(): string {
  return escribirCsv(TABLA_CODIGOS, Object.entries(CODIGOS_MARCADOR).map(([evento, codigo]) => ({
    codigo, evento, significado: CODIGOS_DESCRIPCION[evento] ?? '',
  })).sort((a, b) => (a.codigo as number) - (b.codigo as number)))
}

export const CAMPOS_SESION: { campo: string; descripcion: string }[] = [
  { campo: 'esquema', descripcion: 'Versión del formato de este paquete.' },
  { campo: 'aplicacion', descripcion: 'Software que lo produjo.' },
  { campo: 'generado_utc', descripcion: 'Cuándo se generó el paquete.' },
  { campo: 'sesion_id, participante_id, operador_id', descripcion: 'Identificadores. El participante y el operador van seudonimizados.' },
  { campo: 'inicio_utc, fin_utc', descripcion: 'Inicio y fin de la sesión.' },
  { campo: 'secciones, niveles_pares', descripcion: 'Vistas y niveles que se trabajaron.' },
  { campo: 'versiones_ppa', descripcion: 'Versiones de la configuración PPA vigentes en los eventos.' },
  { campo: 'reloj', descripcion: 'Fuente de la hora (reloj del computador), y `saltos_de_reloj`: ajustes del reloj del sistema detectados durante la sesión, que desplazarían los tiempos.' },
  { campo: 'tiempos', descripcion: 'Qué significa cada hora: `fisico_estimado`, `pantalla` y el origen de tiempos `juego_listo`.' },
  { campo: 'ecuaciones', descripcion: 'Dónde está la definición de cada símbolo (main.tex, sección «Fundamento matemático de las métricas de análisis»).' },
]

function filaMd(c: Columna): string {
  const celdaMd = (s: string) => s.replace(/\|/g, '\\|')
  return `| \`${c.nombre}\` | ${c.tipo} | ${c.unidad ?? ''} | ${c.ecuacion ?? ''} | ${celdaMd(c.descripcion)}${c.vacio ? ` *Vacío cuando: ${celdaMd(c.vacio)}.*` : ''} |`
}

export function diccionarioMarkdown(): string {
  const partes = [
    '# Diccionario de datos',
    '',
    `Esquema \`${ESQUEMA}\`. Generado por la aplicación desde una única fuente (src/core/session/diccionario.ts): toda columna exportada está aquí.`,
    '',
    'Convenciones: CSV en UTF-8, separador coma, decimal con punto; horas en ISO 8601 UTC o como segundos/milisegundos Unix. **Un dato que no se puede calcular va vacío, nunca 0 ni un guion.** Los símbolos y su número de ecuación son los de la tesis.',
    '',
  ]
  for (const t of TODAS) {
    partes.push(`## ${t.archivo} — ${t.titulo}`, '', t.descripcion, '', '| Columna | Tipo | Unidad | Ec. | Descripción |', '|---|---|---|---|---|')
    for (const c of t.columnas) partes.push(filaMd(c))
    partes.push('')
  }
  partes.push('## sesion.json — metadatos', '', '| Campo | Descripción |', '|---|---|')
  for (const c of CAMPOS_SESION) partes.push(`| ${c.campo} | ${c.descripcion} |`)
  partes.push('')
  return partes.join('\n')
}

const TIPO_FRICTIONLESS: Record<TipoColumna, string> = {
  texto: 'string', entero: 'integer', numero: 'number', booleano: 'boolean', 'fecha-hora': 'datetime',
}

// datapackage.json (Frictionless Data): permite cargar cada CSV con su esquema
// en R o Python sin leer código.
export function datapackage(titulo: string, creado: string, recursos: string[]): object {
  return {
    name: 'escalera-sesion',
    title: titulo,
    created: creado,
    version: ESQUEMA,
    profile: 'tabular-data-package',
    resources: TODAS.filter(t => recursos.includes(t.archivo)).map(t => ({
      name: t.archivo.replace(/\.csv$/, '').replace(/_/g, '-'),
      path: t.archivo,
      profile: 'tabular-data-resource',
      format: 'csv',
      mediatype: 'text/csv',
      encoding: 'utf-8',
      description: t.descripcion,
      schema: {
        fields: t.columnas.map(c => ({
          name: c.nombre, type: TIPO_FRICTIONLESS[c.tipo],
          description: c.descripcion + (c.ecuacion ? ` (ec. ${c.ecuacion})` : '') + (c.vacio ? ` Vacío cuando: ${c.vacio}.` : ''),
          ...(c.unidad ? { unit: c.unidad } : {}),
        })),
        missingValues: [''],
      },
    })),
  }
}

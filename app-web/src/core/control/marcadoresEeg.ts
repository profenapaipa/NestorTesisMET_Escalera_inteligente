// Marcadores para sincronizar la sesión con el EEG (OpenBCI Cyton+Daisy).
//
// El archivo crudo del OpenBCI GUI trae en cada muestra la hora del PC
// (columna "Timestamp", segundos Unix). Cada marcador lleva la hora del
// mismo reloj en que ocurrió el evento, así que basta con buscar la muestra
// más cercana — lo hace herramientas/sincronizar_eeg.py, que además deja un
// archivo de eventos listo para importar en EEGLAB.
//
// Para las jugadas del tablero la hora no es la de llegada a la pantalla
// sino la estimada del momento físico (telemetria.ts/estimarLatencia): se
// le restan la espera en el maestro, el viaje por la red y el antirrebote.
//
// Los códigos son fijos (no cambiarlos entre sesiones: el análisis los usa).

export const CODIGOS_MARCADOR = {
  intento_iniciado: 10,   // se pulsó Iniciar (empieza la cuenta regresiva)
  inicio_juego: 11,       // "¡YA!": el participante puede mover
  cubo_levantado: 20,     // un cubo deja su casilla (inicio del movimiento)
  jugada_valida: 21,      // un cubo apoyado en una casilla permitida
  falla_movimiento: 22,   // jugada inválida
  pausa_automatica: 23,
  correccion_completada: 24,
  pausa_operador: 30,
  reanudar_operador: 31,
  senal_pausar: 32,       // señal PPA manual a un cubo
  senal_pensar: 33,
  senal_actuar: 34,
  senal_estado_inicial: 35,
  victoria: 40,
  derrota: 41,
  reinicio_manual: 42,
  terminar_operador: 44,  // «Terminar»: intento cerrado y guardado como interrumpido
  tablero_reordenado: 43,
  // Del 50 en adelante: añadidos después de las primeras sesiones. Los códigos
  // anteriores NO se tocan: el análisis ya grabado los usa.
  basal_inicio: 50,       // empieza el intervalo de referencia sin tarea (TRP)
  basal_fin: 51,          // termina el intervalo de referencia
  sesion_fin: 52,         // termina la sesión de registro
  calibracion: 53,        // artefacto deliberado (parpadeo) para medir el desfase del reloj
  sugerencia_ppa: 54,     // el sistema sugiere una fase (nada se activa solo)
  sugerencia_descartada: 55, // el operador descarta la sugerencia
  deshacer: 56,           // el participante deshace la última jugada (vistas en pantalla)
  pista: 57,              // el participante pide una pista (vistas en pantalla)
  callejon_sin_salida: 58, // el participante entra en un callejón sin salida
} as const

export type TipoMarcador = keyof typeof CODIGOS_MARCADOR

export type MarcadorEeg = {
  tsMs: number          // hora Unix en ms (reloj del PC)
  codigo: number
  evento: TipoMarcador
  detalle: string
  intentoNum?: number
  origen: 'tablero' | 'operador' | 'sistema' | 'pantalla'
  latenciaMs?: number   // solo jugadas del tablero: cuánto tardó en llegar a la pantalla
}

// ── Marcadores derivados de la bitácora de la sesión ──────────────────────
//
// Los marcadores NO se guardan aparte: salen de los eventos de la sesión, que
// ya se guardan en el navegador, en la carpeta y en el respaldo. Así valen para
// TODAS las vistas (no solo Control), sobreviven a recargar la página y no hay
// dos copias que puedan contradecirse. La hora es la del evento: en Control, la
// jugada del tablero lleva la hora física estimada, no la de llegada a pantalla.

import type { EventoSesion } from '../session/sesion'

const NOMBRES = new Set<string>(Object.keys(CODIGOS_MARCADOR))

// El tipo de marcador que corresponde a un evento de la sesión, o null si ese
// evento no se marca. Los nombres de cada vista difieren (la simulación dice
// «falla» y «reinicio», Control «falla_movimiento» y «reinicio_manual»).
export function marcadorDeEvento(e: EventoSesion): TipoMarcador | null {
  if (e.tipo === 'juego_listo') return 'inicio_juego'
  if (e.tipo === 'movimiento') return 'jugada_valida'
  if (e.tipo === 'falla' || e.errorTipo) return 'falla_movimiento'
  if (e.tipo === 'derrota') return 'derrota'
  if (e.tipo === 'reinicio') return 'reinicio_manual'
  if (e.tipo === 'sugerencia_ppa') return 'sugerencia_ppa'
  if (e.tipo === 'decision_ppa') {
    if (e.decision === 'descartada') return 'sugerencia_descartada'
    return e.fase === 'pausar' ? 'senal_pausar' : e.fase === 'pensar' ? 'senal_pensar' : e.fase === 'actuar' ? 'senal_actuar' : null
  }
  return NOMBRES.has(e.tipo) ? (e.tipo as TipoMarcador) : null
}

// Dos eventos del mismo tipo, intento y sección a menos de este intervalo son
// el mismo hecho registrado dos veces (p. ej. dos ventanas de Control abiertas).
const MS_DUPLICADO = 50

export function marcadoresDeSesion(eventos: EventoSesion[]): MarcadorEeg[] {
  const out: MarcadorEeg[] = []
  const ultimo = new Map<string, number>()
  for (const e of eventos) {
    const tipo = marcadorDeEvento(e)
    if (!tipo) continue
    const tsMs = Date.parse(e.ts)
    if (!Number.isFinite(tsMs)) continue
    const clave = `${tipo}|${e.seccion}|${e.intentoNum ?? ''}`
    const previo = ultimo.get(clave)
    if (previo !== undefined && Math.abs(tsMs - previo) < MS_DUPLICADO) continue
    ultimo.set(clave, tsMs)
    const delTablero = e.seccion === 'control' && (tipo === 'jugada_valida' || tipo === 'falla_movimiento' || tipo === 'victoria' || tipo === 'derrota')
    out.push({
      tsMs, codigo: CODIGOS_MARCADOR[tipo], evento: tipo,
      detalle: e.detalle, intentoNum: e.intentoNum,
      origen: delTablero ? 'tablero' : e.seccion === 'control' ? 'operador' : 'pantalla',
      latenciaMs: e.latenciaMs,
    })
  }
  return out.sort((a, b) => a.tsMs - b.tsMs)
}

export function crearMarcador(evento: TipoMarcador, detalle: string, extra: Partial<MarcadorEeg> = {}): MarcadorEeg {
  return { tsMs: Date.now(), codigo: CODIGOS_MARCADOR[evento], evento, detalle, origen: 'sistema', ...extra }
}

const esc = (s: string) => `"${s.replace(/"/g, '""')}"`

// CSV con la hora en segundos Unix (con milisegundos), la misma unidad de
// la columna Timestamp del OpenBCI GUI.
export function toCsvMarcadores(rows: MarcadorEeg[]): string {
  const cab = 'timestamp_unix,hora_iso,codigo,evento,detalle,intento,origen,latencia_ms'
  const lineas = rows.map(m => [
    (m.tsMs / 1000).toFixed(3), new Date(m.tsMs).toISOString(), m.codigo, m.evento, esc(m.detalle),
    m.intentoNum ?? '', m.origen, m.latenciaMs ?? '',
  ].join(','))
  return [cab, ...lineas].join('\n')
}

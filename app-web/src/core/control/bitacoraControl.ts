// Dos bitácoras separadas para la pestaña de Control, según pidió el autor:
// una de eventos de los cubos (reportados por el hardware físico) y otra,
// independiente, de la mediación: las sugerencias del motor PPA
// (core/ppa/motorPpa.ts), la decisión del operador sobre cada una
// (confirmada o descartada, con su motivo), los envíos por iniciativa del
// operador y los ajustes del umbral de Actuar. Cada una descargable por
// separado. El sistema SUGIERE; ninguna fase se activa sin el operador.
//
// Desde el 2026-11-20 cada fila lleva también participante, operador,
// versión de la configuración PPA y nodo del grafo, como la bitácora de la
// simulación: así las dos se analizan con el mismo esquema.

import { toCsvGeneric, downloadFile, nowIso } from '../bitacora/csv'

export type EventoCuboTipo =
  | 'posiciones' | 'esclavo_conectado' | 'esclavo_desconectado'
  | 'base_conectada' | 'base_desconectada' | 'senal_apagada_automatica' | 'falla_movimiento'
  | 'victoria' | 'derrota' | 'cubo_no_detectado'
  // Control de partida ("intentos"): agrupados por intentoId, ver App.tsx.
  | 'intento_iniciado' | 'intento_finalizado' | 'reinicio_manual' | 'tablero_reordenado'
  // El tablero queda jugable, tras la cuenta regresiva: origen de tiempos
  // para medir la planificación (ec. 3.17).
  | 'juego_listo'
  // Sincronización con la base al cargar/reconectar, ronda de
  // identificación por IP, y pausa automática hasta corregir una jugada
  // inválida (2026-10-15).
  | 'tablero_sincronizado' | 'identificacion_cubos' | 'pausa_automatica' | 'correccion_completada'
  // Telemetría de los cubos (2026-10-16): batería por debajo del umbral y
  // reinicios de un cubo (con su motivo, p. ej. caída de tensión).
  | 'bateria_baja' | 'reinicio_cubo'
  // Una jugada aceptada del tablero (con la hora física estimada), de donde
  // salen las latencias de planificación; y un cambio de dispositivo tras la
  // misma IP de un cubo (2026-10-22).
  | 'movimiento' | 'cubo_distinto'
  // Resultado de la verificación previa al pulsar Iniciar intento (base,
  // cubos conectados, estado leído, operador y participante), y si el
  // operador decidió iniciar de todos modos (2026-11-20).
  | 'verificacion_previa'

export type EventoCubo = {
  timestamp: string
  pares: number
  tipo: EventoCuboTipo
  detalle: string
  participanteId?: string
  operadorId?: string
  versionPpa?: string
  // Estado del grafo del nivel tras el evento (ID 1-based de Escalera.m).
  nodoGrafo?: number
  posiciones?: (number | null)[]
  // Lo que lee cada casilla de la base (1 = algo apoyado). Solo para auditar
  // el canal de posición; no se exporta en el CSV.
  presencia?: number[]
  // Agrupa las filas de un mismo intento de partida (Iniciar -> victoria/
  // bloqueo/reinicio). Ausente en eventos que no pertenecen a un intento
  // en curso (p. ej. señales de conexión antes de iniciar).
  intentoId?: string
  // Correlativo legible del mismo intento (1, 2, 3…) — intentoId es un
  // timestamp interno, útil para agrupar filas pero no para leer "¿en qué
  // intento vamos?" de un vistazo al exportar y contrastar intentos.
  intentoNum?: number
}

export type DecisionOperador = {
  timestamp: string
  pares: number
  operadorId: string
  participanteId?: string
  // Qué registra la fila: una sugerencia del sistema, la decisión sobre ella
  // o una activación por iniciativa, un ajuste del umbral de Actuar, o el
  // apagado de una señal. Las filas antiguas no lo traen: eran envíos.
  tipo?: 'sugerencia_ppa' | 'decision_ppa' | 'ajuste_umbral' | 'senal_apagada'
  cuboId: number
  fase: 'pausar' | 'pensar' | 'actuar' | 'estado_inicial'
  detalle: string
  motivo?: string
  decision?: 'confirmada' | 'descartada'
  motivoDescarte?: string
  activacionEfectiva?: boolean
  origen?: 'sugerencia' | 'iniciativa'
  umbralMs?: number | null
  versionPpa?: string
  nodoGrafo?: number
  intentoId?: string
  intentoNum?: number
}

const EVENTO_CUBO_COLS: (keyof EventoCubo)[] = ['timestamp', 'pares', 'participanteId', 'operadorId', 'versionPpa', 'tipo', 'detalle', 'posiciones', 'nodoGrafo', 'intentoId', 'intentoNum']
const DECISION_OPERADOR_COLS: (keyof DecisionOperador)[] = [
  'timestamp', 'pares', 'participanteId', 'operadorId', 'versionPpa', 'tipo', 'cuboId', 'fase', 'motivo', 'decision',
  'motivoDescarte', 'activacionEfectiva', 'origen', 'umbralMs', 'detalle', 'nodoGrafo', 'intentoId', 'intentoNum',
]

export function toCsvEventosCubo(rows: EventoCubo[]): string {
  return toCsvGeneric(rows, EVENTO_CUBO_COLS)
}
export function toCsvDecisionesOperador(rows: DecisionOperador[]): string {
  return toCsvGeneric(rows, DECISION_OPERADOR_COLS)
}

export { downloadFile, nowIso }

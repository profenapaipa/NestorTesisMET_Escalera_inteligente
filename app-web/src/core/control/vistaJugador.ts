// Estado que Control Mago de Oz comparte con la Vista del jugador: solo lo
// que el participante necesita ver (cubos, tiempo, conexión, qué hacer tras
// una jugada inválida), nunca los controles del operador. Va por
// BroadcastChannel, así funciona igual en la pestaña de la aplicación que en
// una ventana aparte (p. ej. en un segundo monitor frente al participante),
// sin abrir otra conexión con el backend.

import type { CeldaTablero, CuboLevantado } from '../../components/control/TableroFisico'
import type { CuboDesubicado } from './ordenTablero'
import type { SessionState } from '../ppa/cubeVisualState'

export type VistaJugadorSnapshot = {
  celdas: CeldaTablero[]
  primeraCasilla: number
  levantados: CuboLevantado[]
  tiempo: string
  mostrarTiempo: boolean
  estado: SessionState
  // Pausa por un problema del montaje (2026-11-22): el jugador ve un mensaje
  // neutro, sin el color de Pausar. Ya no se envía cuántos cubos hay
  // conectados: es diagnóstico del operador, no información del juego.
  pausaTecnica: boolean
  intento: number
  baseConectada: boolean
  cuenta: number | null
  // Tablero al que hay que llevar los cubos (antes de iniciar, o tras una
  // jugada inválida), en ids por casilla de la ventana del nivel.
  objetivo: { celdas: number[]; desubicados: CuboDesubicado[]; motivo: 'orden' | 'correccion' } | null
  fin: 'victoria' | 'bloqueo' | null
}

const CANAL = 'cubos-vista-jugador'
let emisor: BroadcastChannel | null = null

export function publicarVistaJugador(s: VistaJugadorSnapshot) {
  if (typeof BroadcastChannel === 'undefined') return
  emisor ??= new BroadcastChannel(CANAL)
  emisor.postMessage({ tipo: 'snapshot', s })
}

// Control: responde cuando una vista recién abierta pide el estado actual.
export function escucharPedidosVistaJugador(alPedir: () => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  const c = new BroadcastChannel(CANAL)
  c.onmessage = e => { if (e.data?.tipo === 'pedir') alPedir() }
  return () => c.close()
}

// Vista del jugador: recibe cada cambio y pide el estado al abrirse.
export function suscribirVistaJugador(alRecibir: (s: VistaJugadorSnapshot) => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}
  const c = new BroadcastChannel(CANAL)
  c.onmessage = e => { if (e.data?.tipo === 'snapshot') alRecibir(e.data.s) }
  c.postMessage({ tipo: 'pedir' })
  return () => c.close()
}

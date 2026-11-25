// Sonido de encaje (2026-11-24, pedido del autor): cuando un cubo se asienta en su casilla suena un
// «pop» sutil de madera con el clic del conector imantado del prototipo. Es limpio y suave para no distraer, y quien opera lo puede apagar con un
// botón (la elección se recuerda en este navegador).
//
// Se sintetiza con Web Audio (sin archivos) y usa el AudioContext compartido de ppaTones.ts.
import { audioCompartido } from './ppaTones'

const CLAVE = 'escalera.sonido.encaje'
const oyentes = new Set<() => void>()

function leer(): boolean {
  try { return localStorage.getItem(CLAVE) !== 'false' } catch { return true }
}
let activo = leer()

export function sonidoEncajeActivo() { return activo }
export function fijarSonidoEncaje(valor: boolean) {
  activo = valor
  try { localStorage.setItem(CLAVE, String(valor)) } catch { /* sin almacenamiento: vale solo esta sesión */ }
  for (const cb of oyentes) cb()
}
export function suscribirSonidoEncaje(cb: () => void) {
  oyentes.add(cb)
  return () => { oyentes.delete(cb) }
}

// Ruido blanco breve, creado una sola vez por contexto: es la «textura» de la madera y del clic.
let ruido: { ctx: BaseAudioContext; buf: AudioBuffer } | null = null
function bufferRuido(ctx: BaseAudioContext): AudioBuffer {
  if (ruido && ruido.ctx === ctx) return ruido.buf
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.12), ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  ruido = { ctx, buf }
  return buf
}

// Piezas de síntesis «modal» (como la percusión física): modos resonantes del material excitados por
// un golpe muy corto, en vez de tonos puros. Cada pieza dura décimas de segundo y se libera sola.
function modo(c: BaseAudioContext, out: AudioNode, t: number, f: number, g: number, caida: number) {
  const o = c.createOscillator(), a = c.createGain()
  o.frequency.value = f
  a.gain.setValueAtTime(0.0001, t)
  a.gain.exponentialRampToValueAtTime(g, t + 0.0015)
  a.gain.exponentialRampToValueAtTime(0.0001, t + caida)
  o.connect(a).connect(out); o.start(t); o.stop(t + caida + 0.02)
}
function golpe(c: BaseAudioContext, out: AudioNode, t: number, tipo: BiquadFilterType, f: number, q: number, g: number, dur: number) {
  const s = c.createBufferSource(), fil = c.createBiquadFilter(), a = c.createGain()
  s.buffer = bufferRuido(c); fil.type = tipo; fil.frequency.value = f; fil.Q.value = q
  a.gain.setValueAtTime(0.0001, t)
  a.gain.exponentialRampToValueAtTime(g, t + 0.0008)
  a.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  s.connect(fil).connect(a).connect(out); s.start(t); s.stop(t + dur + 0.01)
}
function pop(c: BaseAudioContext, out: AudioNode, t: number, f0: number, f1: number, g: number, dur: number) {
  const o = c.createOscillator(), a = c.createGain()
  o.frequency.setValueAtTime(f0, t)
  o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.5)
  a.gain.setValueAtTime(0.0001, t)
  a.gain.exponentialRampToValueAtTime(g, t + 0.003)
  a.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(a).connect(out); o.start(t); o.stop(t + dur + 0.02)
}

let ultimoContacto = -1
/** Variante A del banco de escucha (2026-11-24): «pop» corto y redondo de la caja de MDF con el clic
 *  del imán apenas por delante. Varía un poco en tono y volumen en cada golpe para no sonar mecánico.
 *
 *  Sincronía (2026-11-24): `enMs` es cuánto falta para que el cubo toque la base. El sonido se programa
 *  en el reloj de audio (preciso a la muestra, sin temporizadores) y se adelanta la latencia de salida
 *  del equipo, para que la madera suene en el mismo cuadro en que el cubo se asienta. */
export function playEncaje(enMs = 0) {
  if (!activo) return
  try {
    const c = audioCompartido()
    // Instante de la página en que el golpe se VE (lo calcula el tablero) → instante del reloj de audio en
    // que debe SALIR por el altavoz. getOutputTimestamp da el par (muestra que está sonando, cuándo suena),
    // con la latencia de salida ya incluida; sin él, se descuenta outputLatency a mano.
    const objetivo = performance.now() + enMs
    const ts = c.getOutputTimestamp?.()
    const latencia = (c as AudioContext & { outputLatency?: number }).outputLatency || c.baseLatency || 0
    const ideal = ts && ts.performanceTime && ts.contextTime !== undefined
      ? ts.contextTime + (objetivo - ts.performanceTime) / 1000
      : c.currentTime + (objetivo - performance.now()) / 1000 - latencia
    const contacto = Math.max(c.currentTime + 0.005, ideal)
    if (Math.abs(contacto - ultimoContacto) < 0.09) return // varios cubos a la vez suenan como uno solo
    ultimoContacto = contacto
    sintetizarEncaje(c, c.destination, contacto, 0.97 + Math.random() * 0.06, 0.85 + Math.random() * 0.15)
  } catch { /* audio no disponible */ }
}

/** El sonido en sí, sobre cualquier contexto (también uno fuera de línea, para analizar la onda).
 *  `contacto` es el instante del contexto en que la madera debe sonar: el imán va 9 ms antes. */
export function sintetizarEncaje(c: BaseAudioContext, destino: AudioNode, contacto: number, k = 1, volumen = 0.92) {
  const t = contacto - 0.009 // el imán engancha un instante antes de que asiente la madera
  const v = c.createGain(), lp = c.createBiquadFilter()
  v.gain.value = volumen
  lp.type = 'lowpass'; lp.frequency.value = 7000
  lp.connect(v).connect(destino)
  // Imán: tic seco y un brillo metálico breve.
  golpe(c, lp, t, 'highpass', 3800, 0.7, 0.05, 0.006)
  modo(c, lp, t + 0.001, 4300 * k, 0.012, 0.03)
  // Madera, 9 ms después: cuerpo hueco del cubo (pop), contacto y modos del panel de MDF.
  pop(c, lp, contacto, 210 * k, 125 * k, 0.32, 0.075)
  golpe(c, lp, contacto, 'bandpass', 1500 * k, 1.4, 0.16, 0.022)
  modo(c, lp, contacto, 640 * k, 0.07, 0.06)
  modo(c, lp, contacto, 1730 * k, 0.03, 0.035)
  modo(c, lp, contacto, 3370 * k, 0.012, 0.018)
}

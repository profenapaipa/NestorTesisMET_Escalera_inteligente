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
let ruido: { ctx: AudioContext; buf: AudioBuffer } | null = null
function bufferRuido(ctx: AudioContext): AudioBuffer {
  if (ruido && ruido.ctx === ctx) return ruido.buf
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.12), ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  ruido = { ctx, buf }
  return buf
}

// Piezas de síntesis «modal» (como la percusión física): modos resonantes del material excitados por
// un golpe muy corto, en vez de tonos puros. Cada pieza dura décimas de segundo y se libera sola.
function modo(c: AudioContext, out: AudioNode, t: number, f: number, g: number, caida: number) {
  const o = c.createOscillator(), a = c.createGain()
  o.frequency.value = f
  a.gain.setValueAtTime(0.0001, t)
  a.gain.exponentialRampToValueAtTime(g, t + 0.0015)
  a.gain.exponentialRampToValueAtTime(0.0001, t + caida)
  o.connect(a).connect(out); o.start(t); o.stop(t + caida + 0.02)
}
function golpe(c: AudioContext, out: AudioNode, t: number, tipo: BiquadFilterType, f: number, q: number, g: number, dur: number) {
  const s = c.createBufferSource(), fil = c.createBiquadFilter(), a = c.createGain()
  s.buffer = bufferRuido(c); fil.type = tipo; fil.frequency.value = f; fil.Q.value = q
  a.gain.setValueAtTime(0.0001, t)
  a.gain.exponentialRampToValueAtTime(g, t + 0.0008)
  a.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  s.connect(fil).connect(a).connect(out); s.start(t); s.stop(t + dur + 0.01)
}
function pop(c: AudioContext, out: AudioNode, t: number, f0: number, f1: number, g: number, dur: number) {
  const o = c.createOscillator(), a = c.createGain()
  o.frequency.setValueAtTime(f0, t)
  o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.5)
  a.gain.setValueAtTime(0.0001, t)
  a.gain.exponentialRampToValueAtTime(g, t + 0.003)
  a.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(a).connect(out); o.start(t); o.stop(t + dur + 0.02)
}

let ultimo = 0
/** Variante A del banco de escucha (2026-11-24): «pop» corto y redondo de la caja de MDF con el clic
 *  del imán apenas por delante. Varía un poco en tono y volumen en cada golpe para no sonar mecánico. */
export function playEncaje() {
  if (!activo) return
  const ahora = performance.now()
  if (ahora - ultimo < 90) return // varios cubos a la vez suenan como uno solo
  ultimo = ahora
  try {
    const c = audioCompartido()
    const t = c.currentTime + 0.01
    const k = 0.97 + Math.random() * 0.06
    const v = c.createGain(), lp = c.createBiquadFilter()
    v.gain.value = 0.85 + Math.random() * 0.15
    lp.type = 'lowpass'; lp.frequency.value = 7000
    lp.connect(v).connect(c.destination)
    // Imán: tic seco y un brillo metálico breve.
    golpe(c, lp, t, 'highpass', 3800, 0.7, 0.05, 0.006)
    modo(c, lp, t + 0.001, 4300 * k, 0.012, 0.03)
    // Madera, 9 ms después: cuerpo hueco del cubo (pop), contacto y modos del panel de MDF.
    const tm = t + 0.009
    pop(c, lp, tm, 210 * k, 125 * k, 0.32, 0.075)
    golpe(c, lp, tm, 'bandpass', 1500 * k, 1.4, 0.16, 0.022)
    modo(c, lp, tm, 640 * k, 0.07, 0.06)
    modo(c, lp, tm, 1730 * k, 0.03, 0.035)
    modo(c, lp, tm, 3370 * k, 0.012, 0.018)
  } catch { /* audio no disponible */ }
}

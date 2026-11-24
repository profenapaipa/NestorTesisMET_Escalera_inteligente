// Sonido de encaje (2026-11-24, pedido del autor): cuando un cubo se asienta en su casilla suena un
// «toc» corto de madera contra madera seguido de un clic metálico muy tenue, como el del conector
// imantado del prototipo. Es limpio y suave para no distraer, y quien opera lo puede apagar con un
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

let ultimo = 0
/** Toc de madera y clic imantado. Varía apenas en tono y volumen para no sonar repetido. */
export function playEncaje() {
  if (!activo) return
  const ahora = performance.now()
  if (ahora - ultimo < 90) return // varios cubos a la vez suenan como uno solo
  ultimo = ahora
  try {
    const ctx = audioCompartido()
    const t = ctx.currentTime + 0.005
    const v = 0.92 + Math.random() * 0.16
    const tono = 0.97 + Math.random() * 0.06

    const salida = ctx.createGain()
    salida.gain.value = 0.5 * v
    // Un pasa-bajos suave quita la aspereza digital.
    const suave = ctx.createBiquadFilter()
    suave.type = 'lowpass'
    suave.frequency.value = 6500
    suave.connect(salida)
    salida.connect(ctx.destination)

    // 1. Cuerpo de madera: tono grave que cae rápido (≈ 90 ms).
    const cuerpo = ctx.createOscillator()
    const gCuerpo = ctx.createGain()
    cuerpo.type = 'sine'
    cuerpo.frequency.setValueAtTime(310 * tono, t)
    cuerpo.frequency.exponentialRampToValueAtTime(190 * tono, t + 0.06)
    gCuerpo.gain.setValueAtTime(0.0001, t)
    gCuerpo.gain.exponentialRampToValueAtTime(0.32, t + 0.004)
    gCuerpo.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
    cuerpo.connect(gCuerpo).connect(suave)
    cuerpo.start(t)
    cuerpo.stop(t + 0.1)

    // 2. Golpe de madera: ruido filtrado en banda media, muy corto (≈ 30 ms).
    const golpe = ctx.createBufferSource()
    golpe.buffer = bufferRuido(ctx)
    const banda = ctx.createBiquadFilter()
    banda.type = 'bandpass'
    banda.frequency.value = 1100 * tono
    banda.Q.value = 2.2
    const gGolpe = ctx.createGain()
    gGolpe.gain.setValueAtTime(0.0001, t)
    gGolpe.gain.exponentialRampToValueAtTime(0.22, t + 0.002)
    gGolpe.gain.exponentialRampToValueAtTime(0.0001, t + 0.03)
    golpe.connect(banda).connect(gGolpe).connect(suave)
    golpe.start(t)
    golpe.stop(t + 0.04)

    // 3. Clic imantado: 22 ms después, chasquido agudo cortísimo y un timbre metálico tenue.
    const tc = t + 0.022
    const clic = ctx.createBufferSource()
    clic.buffer = bufferRuido(ctx)
    const agudo = ctx.createBiquadFilter()
    agudo.type = 'highpass'
    agudo.frequency.value = 3200
    const gClic = ctx.createGain()
    gClic.gain.setValueAtTime(0.0001, tc)
    gClic.gain.exponentialRampToValueAtTime(0.09, tc + 0.001)
    gClic.gain.exponentialRampToValueAtTime(0.0001, tc + 0.008)
    clic.connect(agudo).connect(gClic).connect(suave)
    clic.start(tc)
    clic.stop(tc + 0.012)

    // Timbre metálico: dos parciales inarmónicos (como una pieza de acero pequeña), muy bajos.
    for (const [f, g] of [[2650, 0.022], [3970, 0.012]] as const) {
      const o = ctx.createOscillator()
      const go = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = f * tono
      go.gain.setValueAtTime(0.0001, tc)
      go.gain.exponentialRampToValueAtTime(g, tc + 0.002)
      go.gain.exponentialRampToValueAtTime(0.0001, tc + 0.07)
      o.connect(go).connect(suave)
      o.start(tc)
      o.stop(tc + 0.08)
    }
  } catch { /* audio no disponible */ }
}

import { memo, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { PPA_RGB, PPA_TEXT, PPA_VIBRATION, PPA_VIB_PATTERN, INVALIDO_HEX, type PPAPhase } from '../../core/ppa/ppaColors'
import type { CeldaTablero, CuboLevantado, CubeVisual } from './TableroFisico'
import {
  MEDIA_BANDEJA as HXB, ALTO_ESCENA, ANCHO_ESCENA, CAMARA_MDF, CAMARA_MINIMALISTA, CASILLAS, GROSOR, PASO, W_REGLETA,
  Z_ATRAS, Z_FRENTE, aclarar, contornoRanura, crearBandeja, crearEscena, horiz, mezclar, oscurecer, xCasilla,
  type Camara, type CaraRol, type Escena, type RolBandeja, type Vec3,
} from './proyeccion3d'
import LeyendaLED from './LeyendaLED'
import { pasoEfecto, duracionEfecto } from '../../core/ppa/efectosCubo'
import { Volume2, VolumeX } from 'lucide-react'
import { playEncaje, sonidoEncajeActivo, fijarSonidoEncaje, suscribirSonidoEncaje } from '../../core/utils/sonidoEncaje'
import './Tablero3D.css'

export type AcabadoTablero3D = 'minimalista' | 'mdf'

type Tablero3DProps = {
  celdas: CeldaTablero[]
  primeraCasilla: number
  levantados: CuboLevantado[]
  seleccionado?: number | null
  onSelect?: (id: number) => void
  mostrarConexion?: boolean
  mostrarPresencia?: boolean
  mostrarCasillas?: boolean
  zoom?: number
  acabado?: AcabadoTablero3D
  /** Equipo de un cubo; por omisión, ids 1-5 azul y 6-10 rojo (como Control). */
  equipoDe?: (id: number) => 'A' | 'B'
  /** Simulación: clic en una casilla (índice local de `celdas`), ocupada o vacía. Si falta, solo se
   *  puede seleccionar cubos con `onSelect`. */
  onCasilla?: (indiceLocal: number) => void
  /** Obsoleto: el tablero se ajusta solo al ancho de su contenedor. */
  ajuste?: number
  /** Tono de los cubos de equipo (solo para comparar variantes; por omisión el elegido). */
  tono?: TonoCubos
  /** Solo para pruebas aisladas (vista cenital de comparación con las fotos): cámara distinta de la del acabado. */
  camaraPrueba?: Camara
  /** Búsqueda de conexión en curso: los cubos que el maestro aún no ve se muestran con el LED MAGENTA (firmware: sin Wi-Fi,
   *  Cubo_Esclavo_v3.ino:683-706). Fuera de la búsqueda nunca se pinta magenta: un cubo sin conexión muestra su color de equipo. */
  buscando?: boolean
  /** Muestra la leyenda plegable «Colores del LED del cubo» bajo el tablero (por omisión, sí). */
  leyenda?: boolean
}

const TOTAL_CASILLAS = CASILLAS
// Una cámara por acabado: cada referencia (01 y 02) tiene su propia elevación.
const BANDEJAS = { minimalista: crearBandeja(-0.54), mdf: crearBandeja(-0.64) }
const ESCENAS: Record<AcabadoTablero3D, Escena> = {
  minimalista: crearEscena(CAMARA_MINIMALISTA),
  mdf: crearEscena(CAMARA_MDF),
}
const ELEV_FLOTA = 0.85 // cubo desconectado: flota sin inclinarse; con la cámara a 32-43° los pines de la base solo asoman bajo su arista frontal a partir de ≈ 0,75 w
const ELEV_LEVANTADO = 0.35
const ELEV_SELECCION = 0.04
/** Arco del cubo levantado al cambiar de casilla: altura máxima extra (en w) para pasar por encima de los vecinos. */
const ARCO = 0.9
const PROFUNDIDAD_POZO = 0.1
const ENCAJE_MS = 270 // antes 340: movimiento más ágil (2026-11-25)
// Impacto (2026-11-24, sincronía con el sonido): el cubo ya no «se posa» frenando —tardaba ~60 ms en
// recorrer los últimos 4 px y no había un instante visible de contacto—, sino que cae acelerando, como
// cuando el imán lo jala, y golpea la base exactamente al terminar la transición. Mover, bajar y
// reconectar golpean a los ENCAJE_MS; ahí se programa el sonido.
const CONTACTO_MS = ENCAJE_MS

const ETIQUETA_FASE: Record<PPAPhase, string> = { pausar: 'Pausar', pensar: 'Pensar', actuar: 'Actuar' }

type Paleta = { frente: string; techo: string; costado: string }
type TonoEquipos = { A: Paleta; B: Paleta }
/** Variantes de color de equipo para comparar (T-012, vuelta 2; ver tonos.png). */
export const TONOS = {
  // El que había: azul y rojo algo apagados por el MDF.
  actual: { A: { frente: '#0a3fe6', techo: '#0358fd', costado: '#000ac8' }, B: { frente: '#e0141c', techo: '#fb2a2c', costado: '#8d0108' } },
  // Más vivos y luminosos, tipo acrílico brillante. Todos parten del azul/rojo del LED físico (0,0,255)/(255,0,0).
  zafiro: { A: { frente: '#1f4dff', techo: '#5a82ff', costado: '#0a24c9' }, B: { frente: '#ff2a35', techo: '#ff6a72', costado: '#c3101c' } },
  acrilico: { A: { frente: '#2a5cff', techo: '#6f95ff', costado: '#1235d6' }, B: { frente: '#ff3340', techo: '#ff7a82', costado: '#cf1424' } },
  intenso: { A: { frente: '#1535ff', techo: '#4a6bff', costado: '#0618bd' }, B: { frente: '#ff1f2d', techo: '#ff5a64', costado: '#b80b17' } },
} satisfies Record<string, TonoEquipos>
export type TonoCubos = keyof typeof TONOS
export const TONO_POR_OMISION: TonoCubos = 'intenso'

function paletaEquipo(id: number, tono: TonoCubos): Paleta {
  return id <= 5 ? TONOS[tono].A : TONOS[tono].B
}

/** Hex de un color RGB del firmware (los mismos tres bytes que recibe el LED del cubo). */
const rgbHex = ([r, g, b]: readonly [number, number, number]) => `#${[r, g, b].map(n => n.toString(16).padStart(2, '0')).join('')}`
/** Color del LED de equipo en el firmware (Cubo_Esclavo_v3.ino:644-645): id 1-5 (0,0,255), id 6-10 (255,0,0). Un cubo que el
 *  maestro no ve pero ya tiene Wi-Fi se asienta en él (:719); el magenta (:196,685) solo es «buscando Wi-Fi» y la app no lo distingue. */
const HEX_LED_EQUIPO = { A: '#0000ff', B: '#ff0000' } as const
const HEX_BUSCANDO = '#ff00ff' // COLOR_DESC_R/G/B = 255, 0, 255 (Cubo_Esclavo_v3.ino:196): solo mientras se busca la Wi-Fi

/** Lo que el LED del cubo muestra ahora: señal PPA y pausa global (PPA_RGB, lo que recibe el cubo),
 *  jugada inválida (naranja EF=3) y blanco fijo (bloqueo, victoria, fuera de lugar). */
type Patron = PPAPhase | 'invalido' | 'fijo' | 'flota'
type Luz = { hex: string; patron: Patron; etiqueta?: string }
function luzDe(v: CubeVisual): Luz | null {
  if (v.accion) return { hex: rgbHex(PPA_RGB[v.accion]), patron: v.accion, etiqueta: ETIQUETA_FASE[v.accion] }
  if (v.pulso) return v.hex === INVALIDO_HEX ? { hex: v.hex, patron: 'invalido', etiqueta: 'Inválido' } : { hex: v.hex, patron: 'fijo' }
  return null
}

function coloresCubo(luz: Luz | null, tono: TonoCubos, led: number, equipo: 'A' | 'B', apagado = false) {
  const b0 = paletaEquipo(equipo === 'A' ? 1 : 6, tono)
  // Cubo sin señal (desconectado): color apagado.
  const base = apagado ? { frente: mezclar(b0.frente, '#59606a', 0.5), techo: mezclar(b0.techo, '#59606a', 0.5), costado: mezclar(b0.costado, '#59606a', 0.5) } : b0
  // Decisión del autor (2026-11-23): el cubo ENTERO se ilumina con el color del LED, como un cubo
  // translúcido encendido por dentro; el techo queda más claro y el costado más oscuro. `led`
  // (0→1) funde el color de equipo hacia el de la luz. Al retirarla vuelve al azul/rojo.
  if (!luz) return base
  const h = luz.hex
  return {
    frente: mezclar(base.frente, h, led),
    techo: mezclar(base.techo, aclarar(h, 0.2), led),
    costado: mezclar(base.costado, oscurecer(h, 0.38), led),
  }
}

/* ---------- Reloj de vibración: solo corre mientras hay señal PPA ---------- */

type Pulso = { k: number; dx: number; dy: number; on: boolean }
const REDUCIDO = '(prefers-reduced-motion: reduce)'

/** Estado del pulso de una fase a los `ms` de iniciada la señal. Mismo patrón y ciclo que el
 *  firmware (PPA_VIB_PATTERN, que repite mientras dure la señal): intensidad de la luz `k`
 *  (0,3 en reposo → 1 encendido) y temblor de 1-2 px mientras el motor estaría encendido. */
function calcularPulso(patron: Patron, ms: number): Pulso {
  // Blanco fijo: luz sin vibración. Inválido (EF=3 del firmware): naranja continuo al 70 % durante 1 s.
  if (patron === 'fijo') return { k: 1, on: false, dx: 0, dy: 0 }
  // Desconectado: balanceo lento (≈ 3 s por ciclo, ±2 px).
  if (patron === 'flota') return { k: 1, on: false, dx: 0, dy: 2 * Math.sin((2 * Math.PI * ms) / 3000) }
  const tramos = patron === 'invalido' ? [] : PPA_VIB_PATTERN[patron].tramosMs
  const vib = patron === 'invalido' ? 0.7 : PPA_VIBRATION[patron]
  let on = true
  let rampa = 1
  if (tramos.length) {
    const ciclo = tramos.reduce((a, b) => a + b, 0)
    let s = ms % ciclo
    let i = 0
    while (s >= tramos[i]) { s -= tramos[i]; i++ }
    on = i % 2 === 0
    rampa = Math.min(1, s / 40, (tramos[i] - s) / 40)
  }
  const k = on ? 0.3 + 0.7 * rampa : 0.3
  const amp = on ? (0.8 + 1.2 * vib) * Math.min(1, 0.35 + rampa) : 0
  const t = ms / 1000
  return { k, on, dx: amp * Math.sin(2 * Math.PI * 13 * t), dy: 0.6 * amp * Math.sin(2 * Math.PI * 17 * t + 1) }
}

/* Reloj compartido (optimización 2026-11-24): un solo requestAnimationFrame para todas las
 * vibraciones, y cada cubo (y su haz) se suscribe por su cuenta. Antes el tablero entero se
 * volvía a calcular cada 30 ms mientras hubiera una señal; ahora solo se redibuja lo que vibra. */
const reloj = { t: 0, ultimo: 0, raf: 0, subs: new Set<() => void>() }
function tic(t: number) {
  reloj.raf = 0
  if (t - reloj.ultimo >= 30) {
    reloj.ultimo = t
    reloj.t = t
    for (const cb of [...reloj.subs]) cb()
  }
  if (reloj.subs.size) reloj.raf = requestAnimationFrame(tic)
}
function suscribirReloj(cb: () => void) {
  reloj.subs.add(cb)
  if (!reloj.raf) reloj.raf = requestAnimationFrame(tic)
  return () => {
    reloj.subs.delete(cb)
    if (!reloj.subs.size && reloj.raf) { cancelAnimationFrame(reloj.raf); reloj.raf = 0 }
  }
}
const sinSuscripcion = () => () => {}
const leerReloj = () => reloj.t
const esReducido = () => typeof window !== 'undefined' && window.matchMedia(REDUCIDO).matches

/** Pulso de vibración de un cubo con señal `fase` iniciada en `t0`; solo este componente se actualiza. */
function usePulso(fase: Patron | undefined, t0: number | undefined, id: number): Pulso | undefined {
  const activo = fase !== undefined && t0 !== undefined && !esReducido()
  const t = useSyncExternalStore(activo ? suscribirReloj : sinSuscripcion, leerReloj, leerReloj)
  if (!activo) return undefined
  return calcularPulso(fase, Math.max(0, t - t0) + id * 377)
}

/** Efecto EF=<n> del firmware en curso (efectosCubo.ts): color del paso vigente (null = color de
 *  equipo) y temblor según la vibración de ese paso. null cuando no hay efecto o ya terminó; entonces
 *  el cubo muestra su estado sostenido, que es el mismo paso final del firmware (p. ej. blanco fijo). */
function useEfecto(n: number | undefined, t0: number | undefined) {
  const vivo = n !== undefined && t0 !== undefined && !esReducido() && performance.now() - t0 < duracionEfecto(n) + 60
  useSyncExternalStore(vivo ? suscribirReloj : sinSuscripcion, leerReloj, leerReloj)
  if (!vivo) return null
  const ms = Math.max(0, performance.now() - t0!)
  const paso = pasoEfecto(n!, ms)
  if (paso.terminado) return null
  const amp = paso.vib > 0 ? 0.8 + 1.2 * paso.vib : 0
  const s = ms / 1000
  return { hex: paso.hex, dx: amp * Math.sin(2 * Math.PI * 13 * s), dy: 0.6 * amp * Math.sin(2 * Math.PI * 17 * s + 1) }
}

type InicioEfecto = { n: number; clave: string; t0: number }
/** Cuándo empezó cada efecto, por cubo. Un efecto que ya estaba al montar el tablero (al cambiar de
 *  pestaña, por ejemplo) no se repite: el cubo físico tampoco lo repetiría. */
function useIniciosEfecto(lista: { id: number; n: number; clave: string }[]): Record<number, InicioEfecto> {
  const clave = lista.map(e => `${e.id}:${e.n}:${e.clave}`).join('|')
  const [estado, setEstado] = useState<{ clave: string | null; mapa: Record<number, InicioEfecto> }>({ clave: null, mapa: {} })
  if (estado.clave !== clave) {
    const primera = estado.clave === null
    const ahora = performance.now()
    const mapa: Record<number, InicioEfecto> = {}
    for (const e of lista) {
      const previo = estado.mapa[e.id]
      mapa[e.id] = previo && previo.clave === e.clave && previo.n === e.n ? previo : { n: e.n, clave: e.clave, t0: primera ? -1e9 : ahora }
    }
    setEstado({ clave, mapa })
    return mapa
  }
  return estado.mapa
}

type Inicio = { fase: Patron; t0: number }
/** Momento en que empezó la señal de cada cubo. Cambia solo cuando aparece, cambia o se retira una
 *  señal, así que las props de los cubos quietos no cambian y su memo los deja sin redibujar. */
function useIniciosSenal(senales: { id: number; fase: Patron }[]): Record<number, Inicio> {
  const clave = senales.map(s => `${s.id}:${s.fase}`).join('|')
  const [estado, setEstado] = useState<{ clave: string; mapa: Record<number, Inicio> }>({ clave: '', mapa: {} })
  if (estado.clave !== clave) {
    const ahora = performance.now()
    const mapa: Record<number, Inicio> = {}
    for (const par of clave ? clave.split('|') : []) {
      const [id, fase] = par.split(':')
      const previo = estado.mapa[Number(id)]
      mapa[Number(id)] = previo && previo.fase === fase ? previo : { fase: fase as Patron, t0: ahora }
    }
    setEstado({ clave, mapa })
    return mapa
  }
  return estado.mapa
}

/* Textura del poro del MDF calculada UNA vez (antes, cada cubo generaba ruido con feTurbulence en
 * cada repintado). Mismo grano y color que el filtro anterior: ruido fino de ≈ 1 px de la escena,
 * color (0,2; 0,1; 0,03) y alfa = 1,5·n − 0,62, como su feColorMatrix. */
let texturaCache: string | null | undefined
function texturaPoro(): string | null {
  if (texturaCache !== undefined) return texturaCache
  texturaCache = null
  if (typeof document === 'undefined') return null
  try {
    const n = 128
    const lienzo = document.createElement('canvas')
    lienzo.width = n
    lienzo.height = n
    const ctx = lienzo.getContext('2d')
    if (!ctx) return null
    const img = ctx.createImageData(n, n)
    let s = 3 // semilla fija: la misma textura en cada carga
    const azar = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
    for (let k = 0; k < n * n; k++) {
      const u = (azar() + azar() + azar()) / 3
      const a = Math.min(1, Math.max(0, 1.5 * u - 0.62))
      img.data.set([51, 26, 8, Math.round(a * 255)], k * 4)
    }
    ctx.putImageData(img, 0, 0)
    texturaCache = lienzo.toDataURL('image/png')
  } catch {
    texturaCache = null
  }
  return texturaCache
}

/** Niveles de desenfoque de sombra compartidos (antes, dos filtros propios por cubo). */
const NIVELES_SOMBRA = 10
const nivelSombra = (alto: number) => Math.round(Math.min(1, Math.max(0, alto)) * NIVELES_SOMBRA)

/** Definiciones comunes a todos los cubos de un dibujo: se crean una vez y cada cubo las usa. */
const DefsCubos = memo(function DefsCubos({ uid }: { uid: string }) {
  const tex = texturaPoro()
  return (
    <defs>
      {tex
        ? <pattern id={`${uid}-poro`} patternUnits="userSpaceOnUse" width="128" height="128"><image href={tex} width="128" height="128" /></pattern>
        : <filter id={`${uid}-poroF`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="3" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 .2  0 0 0 0 .1  0 0 0 0 .03  0 0 0 1.5 -.62" result="m" />
            <feComposite in="m" in2="SourceGraphic" operator="in" />
          </filter>}
      {Array.from({ length: NIVELES_SOMBRA + 1 }, (_, i) => (
        <filter key={i} id={`${uid}-sb${i}`} x="-40%" y="-120%" width="180%" height="340%"><feGaussianBlur stdDeviation={2 + (9 * i) / NIVELES_SOMBRA} /></filter>
      ))}
      <filter id={`${uid}-sp`} x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="3.4" /></filter>
      <filter id={`${uid}-halo`} x="-40%" y="-60%" width="180%" height="220%"><feGaussianBlur stdDeviation="5" /></filter>
      <filter id={`${uid}-led`} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.2" /></filter>
    </defs>
  )
})
/** Relleno de poro sobre una cara: patrón compartido (o el filtro, si no hay lienzo). */
function poroProps(uid: string, opacidad: number) {
  return texturaPoro()
    ? { fill: `url(#${uid}-poro)`, opacity: opacidad }
    : { fill: '#2a1a0c', opacity: opacidad, filter: `url(#${uid}-poroF)` }
}

/* ---------- Animación: estado 3D interpolado con requestAnimationFrame ---------- */

// Curva: 'out' frena al llegar (por omisión); 'lineal' velocidad constante (vuelo horizontal);
// 'caida' frena al subir y ACELERA al bajar, con tope seco (encaje imantado).
type Curva = 'out' | 'lineal' | 'caida'
type Spec = { key: string; target: number; dur: number; entra?: number; curva?: Curva }
type Tween = { from: number; to: number; t0: number; dur: number; curva: Curva }
const suave = (t: number) => 1 - Math.pow(1 - t, 3) // easeOutCubic
const curvaDe = (tw: Tween, t: number) =>
  tw.curva === 'lineal' ? t : tw.curva === 'caida' && tw.to < tw.from ? t * t * t : suave(t)

/** Animador del tablero (2026-11-25, pedido del autor: «que llame a la función de la animación»).
 *  Vive FUERA de React: guarda los valores animados (posición X, elevación, luz y anillo de cada
 *  cubo) y los interpola con un solo requestAnimationFrame. Cada pieza (cubo, haz, anillo) se suscribe
 *  solo a sus claves, así que en cada cuadro se redibuja únicamente lo que se mueve; el tablero completo
 *  se vuelve a dibujar una sola vez al empezar y otra al terminar el movimiento. */
class Animador {
  private prev = new Map<string, number>()
  private tw = new Map<string, Tween>()
  private cur = new Map<string, number>()
  private subs = new Map<string, Set<() => void>>()
  private raf = 0
  private montado = false
  alTerminar: (() => void) | null = null

  valor(key: string, objetivo: number) { return this.cur.get(key) ?? objetivo }
  transicion(key: string) { return this.tw.get(key) }
  enMovimiento(key: string) { return this.tw.has(key) }

  suscribir(key: string, cb: () => void) {
    let s = this.subs.get(key)
    if (!s) this.subs.set(key, (s = new Set()))
    s.add(cb)
    return () => { s!.delete(cb) }
  }

  /** Recibe los objetivos del render y arranca una transición por cada objetivo que cambió. Se llama al
   *  dibujar el tablero, antes que sus piezas, para que cada una lea ya su valor de partida. */
  sincronizar(specs: Spec[]) {
    const reducido = typeof window !== 'undefined' && window.matchMedia(REDUCIDO).matches
    const ahora = performance.now()
    const vivas = new Set<string>()
    for (const s of specs) {
      vivas.add(s.key)
      const antes = this.prev.get(s.key)
      this.prev.set(s.key, s.target)
      const cambia = antes === undefined ? this.montado && s.entra !== undefined : antes !== s.target
      if (!cambia) continue
      const desde = antes === undefined ? (s.entra as number) : (this.cur.get(s.key) ?? antes)
      if (reducido || desde === s.target) { this.tw.delete(s.key); this.cur.delete(s.key); continue }
      this.tw.set(s.key, { from: desde, to: s.target, t0: ahora, dur: s.dur, curva: s.curva ?? 'out' })
      this.cur.set(s.key, desde)
    }
    for (const k of [...this.prev.keys()]) {
      if (vivas.has(k)) continue
      this.prev.delete(k); this.tw.delete(k); this.cur.delete(k)
    }
    this.montado = true
    if (this.tw.size && !this.raf && typeof requestAnimationFrame !== 'undefined') this.raf = requestAnimationFrame(this.marco)
  }

  private marco = (t: number) => {
    this.raf = 0
    let termino = false
    for (const [k, tw] of this.tw) {
      const q = Math.min(1, Math.max(0, (t - tw.t0) / tw.dur))
      if (q >= 1) { this.tw.delete(k); this.cur.delete(k); termino = true } else this.cur.set(k, tw.from + (tw.to - tw.from) * curvaDe(tw, q))
      const s = this.subs.get(k)
      if (s) for (const cb of s) cb()
    }
    if (this.tw.size) this.raf = requestAnimationFrame(this.marco)
    if (termino) this.alTerminar?.()
  }

  detener() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0 }
}

/** Valor animado de una clave; solo el componente que lo usa se actualiza en cada cuadro. */
function useValor(anim: Animador, key: string, objetivo: number) {
  const suscribir = useCallback((cb: () => void) => anim.suscribir(key, cb), [anim, key])
  return useSyncExternalStore(suscribir, () => anim.valor(key, objetivo), () => objetivo)
}

/** Posición y elevación vivas de un cubo, con el arco del vuelo entre casillas (balístico: sube y cae
 *  acelerando, porque X avanza a velocidad constante). */
function usePoseCubo(anim: Animador, id: number, objX: number, objLift: number, objLed: number) {
  const X = useValor(anim, `x:${id}`, objX)
  const lift = useValor(anim, `lift:${id}`, objLift)
  const led = useValor(anim, `led:${id}`, objLed)
  const tw = anim.transicion(`x:${id}`)
  const q = tw && tw.to !== tw.from ? Math.min(1, Math.max(0, (X - tw.from) / (tw.to - tw.from))) : 1
  return { X, elev: lift + ARCO * 4 * q * (1 - q), led }
}

/* ---------- Colores de la base por acabado: [arriba, abajo] del degradado de cada cara ---------- */

type Par = readonly [string, string]
const GRAFITO: Record<RolBandeja, Par> = {
  piso: ['#4a4d56', '#62656f'],
  labio: ['#6b6f79', '#5b5e68'],
  frente: ['#3b3e47', '#25272d'],
}
const MADERA: Record<RolBandeja, Par> = {
  piso: ['#bda88a', '#cfbc9f'],
  labio: ['#d6c2a3', '#c9b08d'],
  frente: ['#baa07c', '#9d825d'],
}
/** Canto quemado de las uniones (marrón oscuro de las fotos). */
const QUEMADO = '#4f3626'

/** Base: caja rectangular con la tapa de las casillas a ras (medida sobre las fotos; ver T-012.md).
 *  En MDF: poro fino, líneas grabadas y lengüetas de canto quemado alternadas en tapa y pared frontal. */
function Bandeja({ mdf, uid, E, caras }: { mdf: boolean; uid: string; E: Escena; caras: ReturnType<typeof crearBandeja> }) {
  const { p } = E
  const poly = (v: readonly Vec3[]) => E.pts(v)
  const col = mdf ? MADERA : GRAFITO
  const piso = caras.find(c => c.rol === 'piso')!
  const frente = caras.find(c => c.rol === 'frente')!
  const yFr = frente.v[2][1]
  const trazo = mdf ? 'rgba(40,22,8,.55)' : 'rgba(4,6,14,.55)'
  const bordeClaro = mdf ? 'rgba(255,240,215,.5)' : 'rgba(255,255,255,.3)'
  const sombra = [p([-6.7, -0.7, -0.6]), p([6.7, -0.7, -0.6]), p([6.7, -0.7, 1.5]), p([-6.7, -0.7, 1.5])]
  const bs = p([-HXB, 0, Z_FRENTE])
  const be = p([HXB, 0, Z_FRENTE])
  const L = 1.0 // largo de cada lengüeta (fotos: ≈ 1 w) y período entre ellas (≈ 2,9 w)
  const xs: number[] = []
  for (let x = -HXB + 0.55; x + L < HXB - 0.3; x += 2.9) xs.push(x)
  const linea = (a: Vec3, b: Vec3) => `M${p(a).map(n => n.toFixed(1)).join(',')}L${p(b).map(n => n.toFixed(1)).join(',')}`
  const zi = Z_FRENTE + 0.2
  const zd = Z_ATRAS - 0.2
  const grabado = linea([-HXB + 0.2, 0, zi], [HXB - 0.2, 0, zi]) + linea([-HXB + 0.2, 0, zd], [HXB - 0.2, 0, zd]) +
    linea([-HXB + 0.2, 0, zi], [-HXB + 0.2, 0, zd]) + linea([HXB - 0.2, 0, zi], [HXB - 0.2, 0, zd])
  return (
    <g>
      <defs>
        {(Object.keys(col) as RolBandeja[]).map(rol => (
          <linearGradient key={rol} id={`${uid}-b-${rol}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={col[rol][0]} />
            <stop offset="1" stopColor={col[rol][1]} />
          </linearGradient>
        ))}
        <linearGradient id={`${uid}-vignette`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity={mdf ? 0.22 : 0.42} />
          <stop offset="0.14" stopColor="#000" stopOpacity="0" />
          <stop offset="0.86" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity={mdf ? 0.22 : 0.42} />
        </linearGradient>
        <filter id={`${uid}-groundblur`} x="-10%" y="-80%" width="120%" height="260%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
        <filter id={`${uid}-poro`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 .3  0 0 0 0 .19  0 0 0 0 .09  0 0 0 1.7 -.7" result="m" />
          <feComposite in="m" in2="SourceGraphic" operator="in" />
        </filter>
      </defs>
      <polygon points={sombra.map(q => q.join(',')).join(' ')} fill={mdf ? '#1d1209' : '#04060d'} opacity={mdf ? 0.32 : 0.5} filter={`url(#${uid}-groundblur)`} />
      {caras.map((c, i) => (
        <polygon key={i} points={poly(c.v)} fill={`url(#${uid}-b-${c.rol})`} stroke={trazo} strokeWidth=".8" strokeLinejoin="round" />
      ))}
      {/* Oscurecimiento suave hacia los extremos: da volumen a la base. */}
      <polygon points={poly(piso.v)} fill={`url(#${uid}-vignette)`} />
      {mdf && caras.map((c, i) => (
        <polygon key={`po-${i}`} points={poly(c.v)} fill="#4a3018" opacity=".42" filter={`url(#${uid}-poro)`} />
      ))}
      {mdf && (
        <g>
          {/* Líneas grabadas de la tapa, a 0,2 w de cada borde. */}
          <path d={grabado} fill="none" stroke="rgba(60,38,20,.5)" strokeWidth=".8" />
          {/* Lengüetas de canto quemado: tapa (frente y fondo), canto de la tapa, pared frontal (desfasadas) y extremos. */}
          {xs.map(x => (
            <g key={x} fill={QUEMADO} opacity=".92">
              <polygon points={poly(horiz(x, x + L, 0, Z_FRENTE, Z_FRENTE + GROSOR))} />
              <polygon points={poly(horiz(x, x + L, 0, Z_ATRAS - GROSOR, Z_ATRAS))} />
              <polygon points={poly([[x, 0, Z_FRENTE], [x + L, 0, Z_FRENTE], [x + L, -GROSOR, Z_FRENTE], [x, -GROSOR, Z_FRENTE]])} />
              <polygon points={poly([[x + 1.45, yFr + GROSOR, Z_FRENTE], [x + 1.45 + L, yFr + GROSOR, Z_FRENTE], [x + 1.45 + L, yFr, Z_FRENTE], [x + 1.45, yFr, Z_FRENTE]])} />
            </g>
          ))}
          <g fill={QUEMADO} opacity=".92">
            {[[-0.15, 0.5], [0.8, 1.25]].map(([z0, z1]) => (
              <g key={z0}>
                <polygon points={poly(horiz(-HXB, -HXB + GROSOR, 0, z0, z1))} />
                <polygon points={poly(horiz(HXB - GROSOR, HXB, 0, z0, z1))} />
              </g>
            ))}
          </g>
        </g>
      )}
      {/* Realce fino en la arista frontal de la tapa. */}
      <line x1={bs[0]} y1={bs[1]} x2={be[0]} y2={be[1]} stroke={bordeClaro} strokeWidth="1" />
    </g>
  )
}
const BandejaMemo = memo(Bandeja)

/* ---------- Regleta pogo (casilla de la base y cara inferior del cubo) ---------- */

/** Holgura de la ranura por lado (en w). Fotos: casilla ≈ 1,05 w frente al cubo (separador 0,14 w). */
const HOLGURA = 0.03
/** Regleta pogo magnética (fotos pines_cubo.jpeg y vista superior): carcasa negra en forma de estadio,
 *  4 pines dorados al centro y 2 discos plateados (imanes) en los extremos. Mide 0,36 × 0,09 w; va
 *  horizontal, centrada en X, con su centro a ≈ 0,2 w del borde trasero (a 22 % de la profundidad de la
 *  casilla) tanto en la base como en la cara inferior del cubo, para que encajen. */
const LARGO_REG = 0.36
const ALTO_REG = 0.09
const H_REG = 0.02
type Mapa = (dx: number, dz: number, lift: number) => Vec3

function Regleta({ E, m, id, oro }: { E: Escena; m: Mapa; id: string; oro: boolean }) {
  const { p } = E
  const r = ALTO_REG / 2
  const rec = LARGO_REG / 2 - r
  const fmt = (q: readonly number[]) => q.map(n => n.toFixed(2)).join(',')
  const estadio = (l: number, esc = 1, ox = 0, oz = 0) => {
    const pts: string[] = []
    for (let i = 0; i <= 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI
      pts.push(fmt(p(m(ox + rec + r * esc * Math.cos(a), oz + r * esc * Math.sin(a), l))))
    }
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI / 2 + (i / 10) * Math.PI
      pts.push(fmt(p(m(ox - rec + r * esc * Math.cos(a), oz + r * esc * Math.sin(a), l))))
    }
    return pts.join(' ')
  }
  const disco = (cx: number, rr: number, l: number) =>
    Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2
      return fmt(p(m(cx + rr * Math.cos(a), rr * Math.sin(a), l)))
    }).join(' ')
  const pinX = [-0.07, -0.0233, 0.0233, 0.07]
  const metal = oro ? ['#fff3c4', '#d9a93a'] : ['#ffffff', '#c3c9d0']
  return (
    <g data-regleta="true">
      <defs>
        <filter id={`${id}-pb`} x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="0.8" /></filter>
      </defs>
      <polygon points={estadio(0, 1.3, 0.012, -0.012)} fill="#000" opacity=".35" filter={`url(#${id}-pb)`} />
      <polygon points={estadio(0)} fill="#05070a" />
      <polygon points={estadio(H_REG)} fill="#14181d" stroke="rgba(255,255,255,.2)" strokeWidth=".5" />
      {[-1, 1].map(sg => (
        <g key={sg}>
          <polygon points={disco(sg * rec, r * 0.74, H_REG + 0.003)} fill="#9aa2ab" stroke="rgba(0,0,0,.5)" strokeWidth=".4" />
          <polygon points={disco(sg * rec - r * 0.14, r * 0.32, H_REG + 0.005)} fill="#ffffff" opacity=".9" />
        </g>
      ))}
      {pinX.map(px => (
        <g key={px}>
          <polygon points={disco(px, 0.0145, H_REG + 0.003)} fill={metal[1]} stroke="rgba(0,0,0,.45)" strokeWidth=".35" />
          <polygon points={disco(px - 0.004, 0.0065, H_REG + 0.005)} fill={metal[0]} opacity=".92" />
        </g>
      ))}
    </g>
  )
}

/* ---------- Ranura: pozo (vacía o de origen de un cubo levantado) o solo holgura (ocupada) ---------- */

function Pozo({ X, uid, k, mdf, hondo, E }: { X: number; uid: string; k: number; mdf: boolean; hondo: boolean; E: Escena }) {
  const poly = (v: readonly Vec3[]) => E.pts(v)
  const d = PROFUNDIDAD_POZO
  const h = HOLGURA
  const x0 = X - 0.5 - h
  const x1 = X + 0.5 + h
  const z0 = -h
  const z1 = 1 + h
  const abertura = horiz(x0, x1, 0, z0, z1)
  const cam = E.POSICION_CAMARA[0]
  const c = mdf
    ? { fondo: '#a88e6c', trasera: ['#b39770', '#8f7552'], lado: '#9d805c', base: '#c3ab88' }
    : { fondo: '#454851', trasera: ['#50535c', '#454851'], lado: '#3d4048', base: '#4b4e57' }
  const id = `${uid}-pz${k}`
  const rim = mdf ? 'rgba(46,26,10,.7)' : '#565a63'
  if (!hondo) {
    // Ranura ocupada: se ve solo la holgura uniforme alrededor del cubo.
    return (
      <polygon data-ranura={k + 1} points={poly(abertura)} fill={mdf ? 'rgba(30,16,6,.32)' : 'rgba(0,0,0,.5)'} stroke={rim} strokeWidth={mdf ? 1 : 1.2} strokeLinejoin="round" />
    )
  }
  return (
    <g>
      <defs>
        <clipPath id={`${id}-c`}><polygon points={poly(abertura)} /></clipPath>
        <linearGradient id={`${id}-t`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.trasera[0]} />
          <stop offset="1" stopColor={c.trasera[1]} />
        </linearGradient>
        <filter id={`${id}-b`} x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="2.4" /></filter>
      </defs>
      <g clipPath={`url(#${id}-c)`}>
        <polygon points={poly(abertura)} fill={c.fondo} />
        <polygon points={poly(horiz(x0, x1, -d, z0, z1))} fill={c.base} />
        <polygon points={poly([[x0, 0, z1], [x1, 0, z1], [x1, -d, z1], [x0, -d, z1]])} fill={`url(#${id}-t)`} />
        {cam > x0 && <polygon points={poly([[x0, 0, z0], [x0, 0, z1], [x0, -d, z1], [x0, -d, z0]])} fill={c.lado} />}
        {cam < x1 && <polygon points={poly([[x1, 0, z1], [x1, 0, z0], [x1, -d, z0], [x1, -d, z1]])} fill={oscurecer(c.lado, 0.25)} />}
        {/* Oclusión suave: borde interior oscuro difuminado, recortado a la abertura. */}
        <polygon points={poly(abertura)} fill="none" stroke="#000" strokeOpacity={mdf ? 0.26 : 0.32} strokeWidth="5" filter={`url(#${id}-b)`} />
        {/* Contactos magnéticos de la base: horizontales, centrados en X, a ≈ 22 % de la profundidad desde el borde trasero. */}
        <Regleta E={E} m={(dx, dz, l) => [X + dx, -d + l, W_REGLETA + dz]} id={id} oro={mdf} />
      </g>
      <polygon data-ranura={k + 1} points={poly(abertura)} fill="none" stroke={rim} strokeWidth={mdf ? 1 : 1.4} strokeLinejoin="round" />
    </g>
  )
}

/* ---------- Cubo ---------- */

type CuboProps = {
  uid: string
  id: number
  X: number
  elev: number
  led: number
  desconectado: boolean
  buscando: boolean
  /** LED apagado (domo transparente): solo en la leyenda; un cubo conectado en reposo tiene el LED encendido en su color de equipo. */
  apagado?: boolean
  /** Número del cubo (1-10, el de su IP), grabado en la cara frontal. */
  numero?: number
  mdf: boolean
  tono: TonoCubos
  equipo: 'A' | 'B'
  luz: Luz | null
  fase?: Patron
  t0?: number
  efN?: number
  efT0?: number
  E: Escena
}

const centro = (v: readonly Vec3[]): Vec3 => [0, 1, 2].map(i => v.reduce((a, q) => a + q[i], 0) / v.length) as unknown as Vec3

/** Lengüetas de canto quemado de una cara. Cada arista de la caja lleva, en una de sus dos caras, una
 *  lengüeta central (0,6 de la arista) y en la otra dos lengüetas de esquina (0,2 + 0,2). Las tapas
 *  (techo y fondo) y las caras frontal/trasera muestran la central en sus aristas verticales; el resto, esquinas. */
function lenguetas(v: readonly Vec3[], tipos: readonly ('c' | 'e')[]): Vec3[][] {
  const cen = centro(v)
  const out: Vec3[][] = []
  for (let i = 0; i < 4; i++) {
    const A = v[i]
    const B = v[(i + 1) % 4]
    const mid = centro([A, B])
    const dentro = [0, 1, 2].map(k => (cen[k] - mid[k]) * (GROSOR / 0.5)) as unknown as Vec3
    const rangos = tipos[i] === 'c' ? [[0.2, 0.8]] : [[0, 0.2], [0.8, 1]]
    for (const [s0, s1] of rangos) {
      const P0 = [0, 1, 2].map(k => A[k] + (B[k] - A[k]) * s0) as unknown as Vec3
      const P1 = [0, 1, 2].map(k => A[k] + (B[k] - A[k]) * s1) as unknown as Vec3
      out.push([P0, P1, [P1[0] + dentro[0], P1[1] + dentro[1], P1[2] + dentro[2]], [P0[0] + dentro[0], P0[1] + dentro[1], P0[2] + dentro[2]]])
    }
  }
  return out
}
const TIPOS_CARA: Record<CaraRol, readonly ('c' | 'e')[]> = {
  techo: ['c', 'c', 'c', 'c'],
  fondo: ['c', 'c', 'c', 'c'],
  frente: ['e', 'c', 'e', 'c'],
  'costado-izq': ['e', 'e', 'e', 'e'],
  'costado-der': ['e', 'e', 'e', 'e'],
}

// Cada cubo se redibuja solo si cambia lo suyo (T-015, propuesta 3 de Codex):
// mientras uno vuela, los otros nueve no se recalculan. `luz` llega como
// valores simples porque luzDe crea un objeto nuevo en cada cuadro.
const CuboMemo = memo(function CuboMemo({ luzHex, luzPatron, ...props }: Omit<CuboProps, 'luz'> & { luzHex?: string; luzPatron?: Patron }) {
  const luz = luzHex !== undefined && luzPatron !== undefined ? { hex: luzHex, patron: luzPatron } : null
  return <Cubo {...props} luz={luz} />
})

function Cubo({ uid, id, X, elev, led: ledBase, desconectado, buscando, apagado = false, numero, mdf, tono, equipo, luz: luzBase, fase, t0, efN, efT0, E }: CuboProps) {
  const pulsoSenal = usePulso(fase, t0, id)
  // Efecto del firmware en curso: manda sobre la señal, como en el cubo (EF= reemplaza cualquier estado).
  const ef = useEfecto(efN, efT0)
  const luz: Luz | null = ef ? (ef.hex ? { hex: ef.hex, patron: 'fijo' } : null) : luzBase
  const led = ef ? 1 : ledBase
  const pulso: Pulso | undefined = ef ? { k: 1, on: ef.dx !== 0, dx: ef.dx, dy: ef.dy } : pulsoSenal
  const { p } = E
  const poly = (v: readonly Vec3[]) => E.pts(v)
  const G = E.girar(X, elev, 0)
  const cara = (rol: CaraRol) => G.caras.find(c => c.rol === rol)?.v
  const techo = cara('techo')
  const frente = cara('frente')
  const fondo = cara('fondo')
  const costadoIzq = cara('costado-izq')
  const costado = costadoIzq ?? cara('costado-der')
  const ladoCostado = costadoIzq ? 'izq' : costado ? 'der' : null
  const col = coloresCubo(luz, tono, led, equipo, desconectado && !luz)
  const g = `${uid}-c${id}`
  const e = Math.max(0, elev - ELEV_SELECCION)
  const levantado = e > 0.01
  const trazo = 'rgba(4,8,36,.42)'
  const pxW = E.pxPorW()

  const k = pulso?.k ?? 1
  const dx0 = pulso?.dx ?? 0
  const dy0 = pulso?.dy ?? 0
  const hay = luz
  const intensidad = hay ? led * (0.55 + 0.45 * k) : 0

  // Sombra: sobre la casilla, crece y se oscurece al apoyar; elevado, una elipse más pequeña y suave
  // cuanto más alto está, que sigue el balanceo (la sombra no se mueve con el cubo).
  const hSombra = Math.max(0, elev - dy0 / pxW)
  const alto = Math.min(1, hSombra / 0.6)
  const rS = 0.6 - 0.26 * alto
  const rx = pxW * rS
  const ry = Math.abs(p([X, 0, 0.5 + rS])[1] - p([X, 0, 0.5 - rS])[1]) / 2
  const [sx, sy] = p([X + 0.02, 0, 0.5])
  const opElipse = (0.62 - 0.32 * alto) * (mdf ? 0.8 : 1)
  // Una sola luz (arriba y al frente): las sombras llevan el tono de la superficie, no negro puro.
  const sombraTinte = mdf ? '#1d1209' : '#04060d'
  const m = 0.07 + 0.55 * elev
  const sombraPlana = horiz(X - 0.5 - m + 0.04, X + 0.5 + m + 0.04, 0, -0.06 - 0.2 * elev, 1.05 + 0.3 * elev + 0.05)

  // LED: agujero redondo en la tapa (≈ 0,10 w) con aro oscuro y domo.
  const C = G.pt(0, 1, 0.5)
  const ez = G.dir(0, 0, 1)
  const circulo = (r: number, ox = 0, oz = 0) =>
    Array.from({ length: 16 }, (_, i) => {
      const a = (i / 16) * Math.PI * 2
      const u = r * Math.cos(a) + ox
      const w = r * Math.sin(a) + oz
      return p([C[0] + u, C[1] + w * ez[1], C[2] + w * ez[2]]).map(n => n.toFixed(2)).join(',')
    }).join(' ')

  const aristaF = frente ? [p(frente[0]), p(frente[1])] : null
  const dibujaLeng = (rol: CaraRol, v: Vec3[]) =>
    lenguetas(v, TIPOS_CARA[rol]).map((q, i) => <polygon key={`${rol}${i}`} points={poly(q)} fill={QUEMADO} opacity=".92" />)

  return (
    <g
      className={`tablero3d-cube-draw${levantado ? ' is-lifted' : ''}`}
      data-cube-draw={id}
      data-ppa-fase={luz?.patron}
      data-vib-on={hay && pulso ? String(pulso.on) : undefined}
      data-vib-k={hay && pulso ? pulso.k.toFixed(2) : undefined}
      transform={dx0 || dy0 ? `translate(${dx0.toFixed(2)} ${dy0.toFixed(2)})` : undefined}
    >
      <defs>
        <linearGradient id={`${g}-f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={aclarar(col.frente, 0.03)} />
          <stop offset="0.55" stopColor={col.frente} />
          <stop offset="1" stopColor={oscurecer(col.frente, 0.05)} />
        </linearGradient>
        <linearGradient id={`${g}-fh`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity=".07" />
          <stop offset=".16" stopColor="#000" stopOpacity="0" />
          <stop offset=".84" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".07" />
        </linearGradient>
        <linearGradient id={`${g}-t`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={oscurecer(col.techo, 0.1)} />
          <stop offset="1" stopColor={aclarar(col.techo, 0.12)} />
        </linearGradient>
        <linearGradient id={`${g}-s`} x1={ladoCostado === 'izq' ? 1 : 0} y1="0" x2={ladoCostado === 'izq' ? 0 : 1} y2="0">
          <stop offset="0" stopColor={aclarar(col.costado, 0.04)} />
          <stop offset="1" stopColor={oscurecer(col.costado, 0.28)} />
        </linearGradient>
        <radialGradient id={`${g}-in`} cx=".5" cy=".42" r=".7">
          <stop offset="0" stopColor="#fff" stopOpacity=".34" />
          <stop offset=".6" stopColor="#fff" stopOpacity=".08" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g transform={dx0 || dy0 ? `translate(${(-dx0).toFixed(2)} ${(-dy0).toFixed(2)})` : undefined}>
        {elev > 0.06
          ? <ellipse cx={sx} cy={sy} rx={rx} ry={ry} fill={sombraTinte} opacity={opElipse} filter={`url(#${uid}-sb${nivelSombra(alto)})`} />
          : <polygon points={poly(sombraPlana)} fill={sombraTinte} opacity={Math.max(0.2, 0.62 - 1.1 * elev) * (mdf ? 0.45 : 1)} filter={`url(#${uid}-sp)`} />}
      </g>

      {hay && frente && (
        <polygon points={poly(frente)} fill={hay.hex} opacity={0.38 * intensidad} filter={`url(#${uid}-halo)`} />
      )}
      {fondo && (
        <g data-cara="fondo">
          <polygon points={poly(fondo)} fill={oscurecer(col.frente, 0.2)} stroke={trazo} strokeWidth=".9" strokeLinejoin="round" />
          {mdf && <polygon points={poly(fondo)} {...poroProps(uid, 0.38)} />}
          {mdf && dibujaLeng('fondo', fondo)}
          {/* Regleta de la cara inferior: horizontal, centrada, a ≈ 0,2 w del borde trasero. */}
          <Regleta E={E} m={(dx, dz, l) => G.pt(dx, -l, W_REGLETA + dz)} id={`${g}-rg`} oro={mdf} />
        </g>
      )}
      {costado && (
        <polygon points={poly(costado)} fill={`url(#${g}-s)`} stroke={trazo} strokeWidth=".9" strokeLinejoin="round" />
      )}
      {frente && <polygon data-cara="frente" points={poly(frente)} fill={`url(#${g}-f)`} stroke={trazo} strokeWidth=".9" strokeLinejoin="round" />}
      {frente && <polygon points={poly(frente)} fill={`url(#${g}-fh)`} />}
      {techo && <polygon points={poly(techo)} fill={`url(#${g}-t)`} stroke={trazo} strokeWidth=".9" strokeLinejoin="round" />}
      {hay && (
        <g opacity={intensidad} style={{ mixBlendMode: 'screen' }}>
          {frente && <polygon points={poly(frente)} fill={`url(#${g}-in)`} />}
          {techo && <polygon points={poly(techo)} fill="#fff" opacity=".16" />}
          {costado && <polygon points={poly(costado)} fill="#fff" opacity=".07" />}
        </g>
      )}

      {/* Arista techo-frente: línea oscura suave y realce especular tenue sobre el techo. */}
      {aristaF && techo && <line x1={aristaF[0][0]} y1={aristaF[0][1]} x2={aristaF[1][0]} y2={aristaF[1][1]} stroke="rgba(2,4,30,.8)" strokeWidth="2" shapeRendering="crispEdges" />}

      {mdf && (
        <g>
          {/* MDF de poro fino por encima del color de equipo. */}
          {G.caras.filter(c => c.rol !== 'fondo').map(c => (
            <polygon key={`po${c.rol}`} points={poly(c.v)} {...poroProps(uid, 0.13)} />
          ))}
          {/* Uniones dentadas: canto quemado, central en un lado de cada arista y de esquina en el otro. */}
          {G.caras.filter(c => c.rol !== 'fondo').map(c => dibujaLeng(c.rol, c.v))}
        </g>
      )}

      {/* LED en la tapa (≈ 0,10 w): encendido en el color que tiene el firmware (equipo, señal o magenta al buscar la
          Wi-Fi), con un halo suave y corto; transparente solo si está apagado. El cono intenso es de las señales. */}
      {techo && (() => {
        const hexLed = luz ? luz.hex : buscando && desconectado ? HEX_BUSCANDO : HEX_LED_EQUIPO[equipo]
        const encendido = !apagado
        return (
          <g data-led={apagado ? 'apagado' : luz ? 'encendido' : desconectado ? (buscando ? 'buscando-magenta' : 'equipo-sin-maestro') : 'equipo'}>
            <polygon points={circulo(0.062)} fill="#07090b" stroke="rgba(255,255,255,.22)" strokeWidth=".6" />
            {encendido && <polygon points={circulo(luz ? 0.08 : 0.072)} fill={hexLed} opacity={luz ? 0.6 : 0.45} filter={`url(#${uid}-led)`} />}
            <polygon
              points={circulo(0.05)}
              fill={encendido ? hexLed : 'rgba(228,236,242,.2)'}
              stroke={encendido ? 'none' : 'rgba(255,255,255,.35)'}
              strokeWidth=".6"
            />
            <polygon points={circulo(0.014, -0.02, -0.02)} fill="#fff" opacity={encendido ? 0.9 : 0.7} />
          </g>
        )
      })()}

      {frente && numero !== undefined && <DecalNumero E={E} X={X} elev={elev} numero={numero} claro={luminancia(col.frente) > 0.55} conIcono={desconectado} />}
      {desconectado && frente && <DecalSinWifi E={E} X={X} elev={elev} id={id} />}
    </g>
  )
}

const luminancia = (hex: string) => {
  const h = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Número del cubo grabado en el centro de la cara FRONTAL (arriba del símbolo de conexión si lo hay), en la
 *  perspectiva de esa cara; claro sobre colores oscuros y oscuro sobre colores claros (señales amarillas, blancas, verdes). */
function DecalNumero({ E, X, elev, numero, claro, conIcono }: { E: Escena; X: number; elev: number; numero: number; claro: boolean; conIcono: boolean }) {
  const { p } = E
  const v = conIcono ? 0.64 : 0.46
  const o = p([X, elev + v, 0])
  const ex = p([X + 1, elev + v, 0])
  const ey = p([X, elev + v + 1, 0])
  const k = 0.0125
  const m = `matrix(${(k * (ex[0] - o[0])).toFixed(4)} ${(k * (ex[1] - o[1])).toFixed(4)} ${(-k * (ey[0] - o[0])).toFixed(4)} ${(-k * (ey[1] - o[1])).toFixed(4)} ${o[0].toFixed(2)} ${o[1].toFixed(2)})`
  const col = claro ? '#10141a' : '#ffffff'
  return (
    <g data-numero-cubo={numero} transform={m} pointerEvents="none">
      <text x="0.6" y="8.6" textAnchor="middle" fontSize="24" fontWeight="700" fontFamily="var(--font-mono, monospace)" fill={claro ? '#ffffff' : '#000'} opacity=".35">{numero}</text>
      <text x="0" y="8" textAnchor="middle" fontSize="24" fontWeight="700" fontFamily="var(--font-mono, monospace)" fill={col} opacity=".82">{numero}</text>
    </g>
  )
}

/** Glifo de «sin conexión»: Wi-Fi tachado (3 arcos, punto y barra diagonal) en una caja de 24 × 20 centrada en el origen. */
export function GlifoSinWifi({ trazo = 2.2 }: { trazo?: number }) {
  const arco = (r: number) => {
    const a = (42 * Math.PI) / 180
    const dx = r * Math.sin(a)
    const dy = 4 - r * Math.cos(a)
    return `M${(-dx).toFixed(2)},${dy.toFixed(2)}A${r},${r} 0 0 1 ${dx.toFixed(2)},${dy.toFixed(2)}`
  }
  return (
    <g strokeLinecap="round" fill="none">
      <path d={`${arco(3.6)}${arco(7)}${arco(10.4)}`} strokeWidth={trazo} />
      <circle cx="0" cy="4.4" r={trazo * 0.8} fill="currentColor" stroke="none" />
      <line x1="-9" y1="-8" x2="9" y2="9.5" strokeWidth={trazo + 2.6} stroke="#0b0e14" strokeOpacity=".8" />
      <line x1="-9" y1="-8" x2="9" y2="9.5" strokeWidth={trazo} />
    </g>
  )
}

/** Calcomanía de «sin conexión» en el centro inferior de la cara FRONTAL del cubo: glifo blanco al 78 % con una
 *  sombra mínima, en la perspectiva de esa cara (transformación afín de la cara en la escena). */
function DecalSinWifi({ E, X, elev, id }: { E: Escena; X: number; elev: number; id: number }) {
  const { p } = E
  const o = p([X, elev + 0.26, 0])
  const ex = p([X + 1, elev + 0.26, 0])
  const ey = p([X, elev + 1.26, 0])
  const k = 0.0135 // unidades del glifo (24 → ≈ 0,32 w)
  const m = `matrix(${(k * (ex[0] - o[0])).toFixed(4)} ${(k * (ex[1] - o[1])).toFixed(4)} ${(-k * (ey[0] - o[0])).toFixed(4)} ${(-k * (ey[1] - o[1])).toFixed(4)} ${o[0].toFixed(2)} ${o[1].toFixed(2)})`
  return (
    <g data-sin-conexion={id} transform={m} pointerEvents="none">
      <title>Sin conexión: el maestro no ve este cubo</title>
      <g color="#ffffff" stroke="#ffffff" opacity=".8"><GlifoSinWifi /></g>
    </g>
  )
}

/* ---------- Haz de luz del LED y etiqueta de fase (capa por encima de todos los cubos) ---------- */

const HazSenal = memo(function HazSenal({ uid, id, luzHex, luzPatron, luzEtiqueta, X, cx, cy, led, fase, t0, efN, efT0, E }: {
  uid: string; id: number; luzHex: string; luzPatron: Patron; luzEtiqueta?: string; X: number; cx: number; cy: number; led: number; fase?: Patron; t0?: number; efN?: number; efT0?: number; E: Escena
}) {
  const pulsoSenal = usePulso(fase, t0, id)
  const ef = useEfecto(efN, efT0)
  const luz: Luz = { hex: ef?.hex ?? luzHex, patron: luzPatron, etiqueta: luzEtiqueta }
  const pulso: Pulso | undefined = ef ? { k: 1, on: ef.dx !== 0, dx: ef.dx, dy: ef.dy } : pulsoSenal
  const { p } = E
  const k = pulso?.k ?? 1
  const hex = luz.hex
  const pxW = E.pxPorW()
  const H = Math.min(cy - 4, pxW * 1.3)
  const w0 = pxW * 0.06 // el cono nace del domo del LED, en el centro de la tapa
  const w1 = pxW * 0.5 // apertura ≈ 37°, sin pasar del ancho de su casilla
  const g = `${uid}-h${id}`
  const cono = `${cx - w0},${cy} ${cx + w0},${cy} ${cx + w1},${cy - H} ${cx - w1},${cy - H}`
  const [, pie] = p([X, 0, 0])
  const op = Math.min(1, led * (0.4 + 0.6 * k))
  const ancho = 56
  return (
    <g transform={pulso && (pulso.dx || pulso.dy) ? `translate(${pulso.dx.toFixed(2)} ${pulso.dy.toFixed(2)})` : undefined} pointerEvents="none" data-ppa-haz={luz.patron}>
      <defs>
        <linearGradient id={`${g}-v`} gradientUnits="userSpaceOnUse" x1="0" y1={cy} x2="0" y2={cy - H}>
          <stop offset="0" stopColor={hex} stopOpacity=".95" />
          <stop offset=".5" stopColor={hex} stopOpacity=".4" />
          <stop offset="1" stopColor={hex} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${g}-r`} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={pxW * 0.5} gradientTransform={`translate(${cx} ${cy}) scale(1 .5) translate(${-cx} ${-cy})`}>
          <stop offset="0" stopColor="#fff" stopOpacity=".95" />
          <stop offset=".3" stopColor={hex} stopOpacity=".8" />
          <stop offset="1" stopColor={hex} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${g}-d`} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={H} gradientTransform={`translate(${cx} ${cy}) scale(${(w1 * 1.1) / H} 1) translate(${-cx} ${-cy})`}>
          <stop offset="0" stopColor="#fff" stopOpacity=".9" />
          <stop offset=".25" stopColor={hex} stopOpacity=".7" />
          <stop offset="1" stopColor={hex} stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${g}-k`}><polygon points={cono} /></clipPath>
        <filter id={`${g}-b`} x="-30%" y="-20%" width="160%" height="150%"><feGaussianBlur stdDeviation="2.8" /></filter>
      </defs>
      {/* Luz real: gradiente lineal (se apaga con la altura) por radial (se apaga con la distancia al
          LED, núcleo brillante junto a él), desenfocada y en mezcla aditiva; con halo suave en el domo. */}
      <g style={{ mixBlendMode: 'screen' }} opacity={op}>
        <g filter={`url(#${g}-b)`}>
          <polygon points={cono} fill={`url(#${g}-v)`} />
          <g clipPath={`url(#${g}-k)`}>
            <ellipse cx={cx} cy={cy} rx={w1 * 1.1} ry={H} fill={`url(#${g}-d)`} />
          </g>
        </g>
        <ellipse cx={cx} cy={cy} rx={pxW * 0.42} ry={pxW * 0.21} fill={`url(#${g}-r)`} />
      </g>
      {/* La fase no depende solo del color: etiqueta de texto bajo el cubo. */}
      {luz.etiqueta && (
        <g data-ppa-etiqueta={luz.patron} transform={`translate(${p([X, 0, 0])[0]} ${pie + 13})`}>
          <rect x={-ancho / 2} y="-8" width={ancho} height="15" rx="7.5" fill="rgba(7,10,15,.82)" stroke={hex} strokeOpacity=".8" strokeWidth=".9" />
          <text x="0" y="3" textAnchor="middle" fontSize="10.5" fontWeight="700" fill={luz.patron === 'invalido' ? '#ffc06b' : PPA_TEXT[luz.patron as PPAPhase]} fontFamily="var(--font-sans, sans-serif)">{luz.etiqueta}</text>
        </g>
      )}
    </g>
  )
})

/** Destello de contacto al encajar: brillo dorado breve sobre los pines de la base. */
function DestelloContacto({ uid, id, X, k, E }: { uid: string; id: number; X: number; k: number; E: Escena }) {
  const [cx, cy] = E.p([X, 0.03, W_REGLETA])
  const pxW = E.pxPorW()
  const g = `${uid}-fl${id}`
  return (
    <g pointerEvents="none" data-destello-contacto={id} opacity={k} style={{ mixBlendMode: 'screen' }}>
      <defs>
        <radialGradient id={g}>
          <stop offset="0" stopColor="#fff" stopOpacity=".95" />
          <stop offset=".35" stopColor="#ffd75a" stopOpacity=".7" />
          <stop offset="1" stopColor="#ffb300" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx={cx} cy={cy} rx={pxW * (0.3 + 0.12 * (1 - k))} ry={pxW * 0.12} fill={`url(#${g})`} />
    </g>
  )
}

/* ---------- Muestra: el mismo cubo del tablero, con un estado dado (leyenda de colores) ---------- */

/** Estado de una muestra: lo que el LED muestra (`luz`), si el cubo flota sin conexión y si la búsqueda de conexión
 *  está en curso (LED magenta). Se dibuja con el mismo componente `Cubo`, la misma proyección y el mismo material. */
export type EstadoMuestra = { luz: { hex: string; patron: 'pausar' | 'pensar' | 'actuar' | 'invalido' | 'fijo'; etiqueta?: string } | null; equipo: 'A' | 'B'; flota?: boolean; buscando?: boolean; apagado?: boolean }

export function CuboMuestra({ acabado, tono, estado }: { acabado: AcabadoTablero3D; tono: TonoCubos; estado: EstadoMuestra }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const E = ESCENAS[acabado]
  const mdf = acabado === 'mdf'
  const elev = estado.flota ? ELEV_FLOTA : 0
  const luz = estado.luz
  const inicios = useIniciosSenal(luz && luz.patron !== 'fijo' ? [{ id: 1, fase: luz.patron }] : estado.flota ? [{ id: 1, fase: 'flota' as Patron }] : [])
  const [cx, pie] = E.p([0, 0, 0.5])
  const [, domo] = E.p(E.girar(0, elev, 0).pt(0, 1, 0.5))
  const arriba = domo - (luz ? 112 : 34)
  const alto = pie + 30 - arriba
  const lid = mdf ? '#cdb99b' : '#565a64'
  return (
    <svg className="leyenda-led__cubo" width="150" height={Math.round((150 * alto) / 180)} viewBox={`${cx - 90} ${arriba} 180 ${alto}`} aria-hidden="true" focusable="false">
      <DefsCubos uid={uid} />
      <polygon points={E.pts(horiz(-0.9, 0.9, 0, -0.3, 1.25))} fill={lid} opacity=".9" />
      <Cubo uid={uid} id={1} X={0} elev={elev} led={1} desconectado={Boolean(estado.flota)} buscando={Boolean(estado.buscando)} apagado={Boolean(estado.apagado)} mdf={mdf} tono={tono}
        equipo={estado.equipo} luz={luz ? { hex: luz.hex, patron: luz.patron } : null} fase={inicios[1]?.fase} t0={inicios[1]?.t0} E={E} />
      {luz && <HazSenal uid={uid} id={1} luzHex={luz.hex} luzPatron={luz.patron} X={0} cx={cx} cy={domo} led={1} fase={inicios[1]?.fase} t0={inicios[1]?.t0} E={E} />}
    </svg>
  )
}

/** Botón para activar o apagar el sonido de encaje; la elección vale para todos los tableros. */
function BotonSonidoEncaje() {
  const activo = useSyncExternalStore(suscribirSonidoEncaje, sonidoEncajeActivo, sonidoEncajeActivo)
  const Icono = activo ? Volume2 : VolumeX
  return (
    <button
      type="button"
      className={`tablero3d-sonido${activo ? '' : ' is-off'}`}
      aria-pressed={activo}
      aria-label={activo ? 'Apagar el sonido de encaje de los cubos' : 'Activar el sonido de encaje de los cubos'}
      title={activo ? 'Sonido de encaje: activado' : 'Sonido de encaje: apagado'}
      onClick={() => { const nuevo = !activo; fijarSonidoEncaje(nuevo); if (nuevo) playEncaje() }}
    >
      <Icono size={15} aria-hidden="true" />
    </button>
  )
}

/* ---------- Piezas vivas: leen su pose del animador y se redibujan solas ---------- */

type PropsVivas = { anim: Animador; objX: number; objLift: number; objLed: number }

const CuboVivo = memo(function CuboVivo({ anim, objX, objLift, objLed, ...props }: PropsVivas & Omit<CuboProps, 'luz' | 'X' | 'elev' | 'led'> & { luzHex?: string; luzPatron?: Patron }) {
  const { X, elev, led } = usePoseCubo(anim, props.id, objX, objLift, objLed)
  return <CuboMemo {...props} X={X} elev={elev} led={led} />
})

const HazVivo = memo(function HazVivo({ anim, objX, objLift, objLed, E, ...props }: PropsVivas & {
  uid: string; id: number; luzHex: string; luzPatron: Patron; luzEtiqueta?: string; fase?: Patron; t0?: number; efN?: number; efT0?: number; E: Escena
}) {
  const { X, elev, led } = usePoseCubo(anim, props.id, objX, objLift, objLed)
  if (!(led > 0.001)) return null
  const [cx, cy] = E.p(E.girar(X, elev, 0).pt(0, 1, 0.5))
  return <HazSenal {...props} E={E} X={X} cx={cx} cy={cy} led={led} />
})

const AroVivo = memo(function AroVivo({ anim, posicion, objetivo, puntos }: { anim: Animador; posicion: number; objetivo: number; puntos: string }) {
  const sel = useValor(anim, `sel:${posicion}`, objetivo)
  if (!(sel > 0.005)) return null
  return <polygon points={puntos} fill="none" stroke="#e7edee" strokeWidth="1.8" strokeLinejoin="round" opacity={sel} style={{ filter: 'drop-shadow(0 0 4px rgba(231,237,238,.75))' }} />
})

/* ---------- Tablero ---------- */

export default function Tablero3D({
  celdas,
  primeraCasilla,
  levantados,
  seleccionado,
  onSelect,
  mostrarConexion = true,
  mostrarPresencia = false,
  mostrarCasillas = true,
  zoom = 1,
  acabado = 'minimalista',
  equipoDe,
  onCasilla,
  tono = TONO_POR_OMISION,
  camaraPrueba,
  leyenda = true,
  buscando = false,
}: Tablero3DProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const mdf = acabado === 'mdf'
  const E = camaraPrueba ? crearEscena(camaraPrueba) : ESCENAS[acabado]
  const { p, caja } = E
  const poly = (v: readonly Vec3[]) => E.pts(v)

  // El tablero se ajusta al ancho disponible (sin barra de desplazamiento horizontal): la escena de 1020 × 290
  // se escala con `zoom` al ancho del contenedor, entre 0,3 y 1,35.
  const [escala, setEscala] = useState(1)
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const medir = () => setEscala(Math.min(1.35, Math.max(0.3, viewport.clientWidth / ANCHO_ESCENA)))
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(viewport)
    return () => ro.disconnect()
  }, [])

  // Estado de cada casilla (se calcula una vez por render).
  const casillas = Array.from({ length: TOTAL_CASILLAS }, (_, posicion) => {
    const indiceLocal = posicion - primeraCasilla
    const enNivel = indiceLocal >= 0 && indiceLocal < celdas.length
    const celda = enNivel ? celdas[indiceLocal] : undefined
    const levantado = enNivel ? levantados.find(item => item.origen === indiceLocal) : undefined
    const id = levantado?.id ?? celda?.id ?? 0
    const visual = levantado?.visual ?? celda?.visual
    const desconectado = Boolean(mostrarConexion && !levantado && id && celda?.conectado !== true)
    return { posicion, enNivel, celda, levantado, id, visual, desconectado, esHueco: enNivel && id === 0 }
  })

  // Objetivos de animación: X, elevación, anillo de selección y entrada de la señal.
  const specs: Spec[] = []
  for (const c of casillas) {
    const sel = Boolean(c.id) && seleccionado === c.id
    specs.push({ key: `sel:${c.posicion}`, target: sel ? 1 : 0, dur: 140 })
    if (c.id && c.visual) {
      specs.push({ key: `x:${c.id}`, target: xCasilla(c.posicion + 1), dur: CONTACTO_MS, curva: 'lineal' })
      specs.push({ key: `lift:${c.id}`, target: (c.levantado ? ELEV_LEVANTADO : 0) + (sel ? ELEV_SELECCION : 0) + (c.desconectado ? ELEV_FLOTA : 0), dur: c.levantado ? 150 : ENCAJE_MS, curva: 'caida' })
      specs.push({ key: `led:${c.id}`, target: luzDe(c.visual) ? 1 : 0, dur: 180, entra: 0 })
    }
  }
  // Un animador por tablero. Se sincroniza al dibujar (antes que las piezas, que así ya leen su valor
  // de partida); al terminar un movimiento se vuelve a dibujar una vez para reordenar la escena.
  const animRef = useRef<Animador | null>(null)
  if (!animRef.current) animRef.current = new Animador()
  const anim = animRef.current
  anim.sincronizar(specs)
  const [, setFinMovimiento] = useState(0)
  useEffect(() => {
    anim.alTerminar = () => setFinMovimiento(n => n + 1)
    return () => { anim.alTerminar = null; anim.detener() }
  }, [anim])
  const equipoCubo = (id: number): 'A' | 'B' => (equipoDe ? equipoDe(id) : id <= 5 ? 'A' : 'B')

  const pxW = E.pxPorW()
  const pasoPx = pxW * PASO
  // Objetivos de cada cubo (dónde termina); la pose viva la leen sus piezas del animador.
  const cubos = casillas
    .filter(c => c.id && c.visual)
    .map(c => {
      const sel = seleccionado === c.id
      const X = xCasilla(c.posicion + 1)
      const elev = (c.levantado ? ELEV_LEVANTADO : 0) + (sel ? ELEV_SELECCION : 0) + (c.desconectado ? ELEV_FLOTA : 0)
      const luz = luzDe(c.visual!)
      const arriba = sel || elev > 0.2 || anim.enMovimiento(`x:${c.id}`) || anim.enMovimiento(`lift:${c.id}`)
      return { ...c, sel, X, elev, led: luz ? 1 : 0, luz, arriba }
    })
    // Lo lejano primero; el seleccionado, los levantados y los que están en vuelo quedan encima.
    .sort((a, b) => Number(a.arriba) - Number(b.arriba) || Math.abs(b.X) - Math.abs(a.X))

  const iniciosEf = useIniciosEfecto(cubos.flatMap(c => c.visual?.efecto ? [{ id: c.id, n: c.visual.efecto.n, clave: c.visual.efecto.clave }] : []))
  const inicios = useIniciosSenal(cubos.filter(c => (c.luz && c.luz.patron !== 'fijo') || (!c.luz && c.desconectado)).map(c => ({ id: c.id, fase: c.luz ? c.luz.patron : ('flota' as Patron) })))

  // Destello de contacto: al pasar de desconectado a conectado, cuando el cubo termina de bajar.
  const antes = useRef(new Map<number, boolean>())
  const [destellos, setDestellos] = useState<Record<number, number>>({})
  const [ahora, setAhora] = useState(0)
  // Corre en cada render a propósito: compara la conexión de cada cubo con la del render anterior.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const nuevos: Record<number, number> = {}
    for (const c of cubos) {
      if (antes.current.get(c.id) === true && !c.desconectado && !window.matchMedia(REDUCIDO).matches) nuevos[c.id] = performance.now() + ENCAJE_MS - 40
      antes.current.set(c.id, c.desconectado)
    }
    if (Object.keys(nuevos).length) setDestellos(d => ({ ...d, ...nuevos }))
  })
  const hayDestello = Object.keys(destellos).length > 0

  // Sonido de encaje (sonidoEncaje.ts): suena cuando el cubo termina de asentarse, al llegar a otra
  // casilla, al bajarlo después de levantarlo o al reconectarse. Un cambio masivo (nivel nuevo,
  // reinicio) no suena, y varios cubos a la vez suenan como uno solo.
  const encajes = useRef(new Map<number, { pos: number; lev: boolean; desc: boolean }>())
  // Corre en cada render a propósito (en la misma fase que arranca la animación, para medir el golpe
  // desde el mismo instante): compara cada cubo con el render anterior.
  useLayoutEffect(() => {
    const previo = encajes.current
    const primera = previo.size === 0
    let movidos = 0
    let espera = -1
    const siguiente = new Map<number, { pos: number; lev: boolean; desc: boolean }>()
    for (const c of cubos) {
      const ahora = { pos: c.posicion, lev: Boolean(c.levantado), desc: c.desconectado }
      siguiente.set(c.id, ahora)
      const antes = previo.get(c.id)
      if (!antes || ahora.lev || ahora.desc) continue
      if (antes.pos !== ahora.pos) { movidos++; espera = CONTACTO_MS }
      else if (antes.desc || antes.lev) espera = CONTACTO_MS
    }
    encajes.current = siguiente
    if (primera || espera < 0 || movidos > 3) return
    // El golpe se ve un refresco después del cuadro en que la transición llega a 1 (≈ 16 ms); +8 ms centra
    // el pico de la onda (5 ms tras su arranque) sobre ese cuadro. Medido: desfase ≈ 0 ± 5 ms.
    playEncaje(window.matchMedia(REDUCIDO).matches ? 0 : espera + 24)
  })
  useEffect(() => {
    if (!hayDestello) return
    let raf = 0
    const marco = (t: number) => {
      setAhora(t)
      setDestellos(d => {
        const vivos = Object.entries(d).filter(([, t0]) => t - t0 < 420)
        return vivos.length === Object.keys(d).length ? d : Object.fromEntries(vivos)
      })
      raf = requestAnimationFrame(marco)
    }
    raf = requestAnimationFrame(marco)
    return () => cancelAnimationFrame(raf)
  }, [hayDestello])

  const resumen = casillas.map(c => {
    const n = c.posicion + 1
    if (!c.enNivel) return `Casilla ${n}: fuera del nivel.`
    if (!c.id) return `Casilla ${n}: vacía${c.celda?.legal ? ', destino permitido' : ''}.`
    const fase = c.visual?.accion
    const inval = c.visual?.pulso && c.visual.hex === INVALIDO_HEX
    return `Casilla ${n}: cubo ${c.id}, equipo ${equipoCubo(c.id) === 'A' ? 'azul' : 'rojo'}${c.levantado ? ', levantado' : ''}${c.celda?.conectado !== true ? ', sin conexión' : ''}${fase ? `, señal ${ETIQUETA_FASE[fase]}` : ''}${inval ? ', jugada inválida' : ''}.`
  })

  return (
    <>
      <div className="tablero3d-marco">
      <div
        ref={viewportRef}
        className="tablero3d-viewport"
        aria-hidden="true"
        data-testid="control-board-3d"
        data-finish={acabado}
        data-source-zoom={zoom}
        data-projection="camara-estenopeica-svg"
      >
        <div className={`tablero3d-stage tablero3d-stage--${acabado}`} style={{ zoom: escala }}>
          <svg
            className="tablero3d-svg"
            viewBox={`0 0 ${ANCHO_ESCENA} ${ALTO_ESCENA}`}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
            focusable="false"
          >
            <DefsCubos uid={uid} />
            <BandejaMemo mdf={mdf} uid={uid} E={E} caras={BANDEJAS[acabado]} />
            {casillas.map(c => {
              const X = xCasilla(c.posicion + 1)
              const pozo = !c.id || Boolean(c.levantado)
              const aro = contornoRanura(X, 0.07)
              return (
                <g key={c.posicion} opacity={c.enNivel ? 1 : 0.24}>
                  <Pozo X={X} uid={uid} k={c.posicion} mdf={mdf} hondo={pozo || c.desconectado} E={E} />
                  {c.celda?.legal && (
                    <polygon points={poly(aro)} fill="rgba(0,204,68,.1)" stroke="#00cc44" strokeWidth="2" strokeLinejoin="round" strokeOpacity=".9" />
                  )}
                  <AroVivo anim={anim} posicion={c.posicion} objetivo={seleccionado === c.id && c.id ? 1 : 0} puntos={poly(aro)} />
                </g>
              )
            })}
            {cubos.map(c => (
              <CuboVivo
                key={c.id}
                anim={anim}
                objX={c.X}
                objLift={c.elev}
                objLed={c.led}
                uid={uid}
                id={c.id}
                desconectado={c.desconectado}
                buscando={buscando}
                numero={c.id}
                mdf={mdf}
                tono={tono}
                equipo={equipoCubo(c.id)}
                luzHex={c.luz?.hex}
                luzPatron={c.luz?.patron}
                fase={inicios[c.id]?.fase}
                t0={inicios[c.id]?.t0}
                efN={iniciosEf[c.id]?.n}
                efT0={iniciosEf[c.id]?.t0}
                E={E}
              />
            ))}
            {cubos.filter(c => c.luz).map(c => {
              return (
                <HazVivo
                  key={`haz-${c.id}`}
                  anim={anim}
                  objX={c.X}
                  objLift={c.elev}
                  objLed={c.led}
                  uid={uid}
                  id={c.id}
                  luzHex={c.luz!.hex}
                  luzPatron={c.luz!.patron}
                  luzEtiqueta={c.luz!.etiqueta}
                  fase={inicios[c.id]?.fase}
                  t0={inicios[c.id]?.t0}
                  efN={iniciosEf[c.id]?.n}
                  efT0={iniciosEf[c.id]?.t0}
                  E={E}
                />
              )
            })}
            {Object.entries(destellos).map(([id, t0]) => {
              const f = (ahora - t0) / 420
              const c = cubos.find(q => q.id === Number(id))
              return f >= 0 && f < 1 && c ? <DestelloContacto key={`fl-${id}`} uid={uid} id={Number(id)} X={c.X} k={1 - f} E={E} /> : null
            })}
          </svg>
          {casillas.map(c => {
            const X = xCasilla(c.posicion + 1)
            const cx = p([X, 0, 0.5])[0]
            const cubo = cubos.find(q => q.posicion === c.posicion)
            const d = (c.posicion + 1 - 6) / 5
            const slotIzq = cx - pasoPx / 2
            const bb = cubo
              ? caja(E.girar(cubo.X, cubo.elev, 0).caras.flatMap(q => q.v))
              : null
            return (
              <div
                className={[
                  'tablero3d-slot',
                  c.enNivel ? '' : 'is-outside-level',
                  c.id ? 'is-occupied' : '',
                  c.celda?.legal ? 'is-legal' : '',
                  seleccionado === c.id && c.id ? 'is-selected' : '',
                  c.desconectado ? 'is-disconnected' : '',
                  c.levantado ? 'has-lifted' : '',
                ].filter(Boolean).join(' ')}
                key={c.posicion}
                style={{ left: slotIzq, width: pasoPx }}
                data-position={c.posicion + 1}
                data-gap={c.esHueco ? 'true' : undefined}
              >
                {c.id !== 0 && c.visual && bb && cubo && (
                  <div
                    className={[
                      'tablero3d-cube',
                      cubo.sel ? 'is-selected' : '',
                      c.desconectado ? 'is-disconnected' : '',
                      c.levantado ? 'is-lifted' : '',
                      c.visual.pulso ? 'is-pulse' : '',
                      cubo.luz ? 'has-signal' : '',
                    ].filter(Boolean).join(' ')}
                    style={{ left: bb.x0 - slotIzq, top: bb.y0, width: bb.x1 - bb.x0, height: bb.y1 - bb.y0 }}
                    data-cube-id={c.id}
                    data-position={c.posicion + 1}
                    data-perspective-d={d.toFixed(2)}
                    onClick={() => (onCasilla ? onCasilla(c.posicion - primeraCasilla) : onSelect?.(c.id))}
                  />
                )}
                {onCasilla && c.enNivel && !cubo && (() => {
                  const hb = caja(horiz(X - 0.5, X + 0.5, 0, 0, 1))
                  return (
                    <div
                      className="tablero3d-hit"
                      style={{ left: hb.x0 - slotIzq, top: hb.y0 - 6, width: hb.x1 - hb.x0, height: hb.y1 - hb.y0 + 12 }}
                      data-hit-casilla={c.posicion + 1}
                      onClick={() => onCasilla(c.posicion - primeraCasilla)}
                    />
                  )
                })()}
                {mostrarPresencia && c.enNivel && (
                  <span className={`tablero3d-presence ${c.celda?.presente ? 'is-present' : ''}`} />
                )}
                {c.celda?.bateria && (
                  <span className="tablero3d-battery">
                    <i style={{ width: `${c.celda.bateria.pct ?? 0}%` }} />
                  </span>
                )}
                {mostrarCasillas && <span className="tablero3d-position-label">{c.posicion + 1}</span>}
              </div>
            )
          })}
        </div>
      </div>
      <BotonSonidoEncaje />
      </div>
      <div className="tablero3d-sr-only" data-testid="control-board-3d-summary">
        Vista 3D del tablero. {resumen.join(' ')}
      </div>
      {leyenda && <LeyendaLED acabado={acabado} tono={tono} Muestra={CuboMuestra} />}
    </>
  )
}

// Cámara estenopeica para el tablero 3D (T-010, versión «realista»).
//
// Mundo: unidad = arista del cubo (w). X a lo largo de la bandeja, Y hacia arriba,
// Z hacia el fondo (alejándose de la cámara). El cubo de la casilla i ocupa
// X = (i - 6)·PASO ± 0,5; Y ∈ [0, 1]; Z ∈ [0, 1]; su cara frontal está en Z = 0.
//
// Cámara en X = 0 (centrada frente a la casilla 6), elevada y mirando hacia abajo. Proyección: x' = f·Xc/Zc, y' = f·Yc/Zc. Parámetros
// ajustados por búsqueda para reproducir las medidas de la referencia 01 (costado
// |d|·0,11 w, techo 0,54 w, desplazamiento del techo −d·0,10 w, d = (i − 6)/5).

export type Vec3 = readonly [number, number, number]
export type Pt = readonly [number, number]

export const PASO = 1.19
export const CASILLAS = 11
export const ANCHO_ESCENA = 1020
export const ALTO_ESCENA = 290
/** Altura (px de escena, desde arriba) donde apoya el pie del cubo central. */
export const PIE_CUBO_Y = 200

export type CaraRol = 'techo' | 'frente' | 'fondo' | 'costado-izq' | 'costado-der'
/** Posición (w desde el frente del cubo) del centro de la regleta pogo: ≈ 0,2 w del borde trasero (fotos). */
export const W_REGLETA = 0.87

export type Camara = {
  /** Distancia de la cámara al centro del cubo central, en w. */
  D: number
  /** Elevación de la cámara sobre el cubo central (ángulo de la visual con el piso), en grados. */
  elevacion: number
  /** Inclinación del eje óptico hacia abajo, en grados (menor que la elevación: el cubo queda
   *  algo bajo el eje y las verticales casi no convergen). */
  inclinacion: number
}

/** Ajustadas por búsqueda para reproducir las medidas de cada referencia. */
export const CAMARA_MINIMALISTA: Camara = { D: 32, elevacion: 32.5, inclinacion: 10 }
export const CAMARA_MDF: Camara = { D: 40, elevacion: 43, inclinacion: 28 }

const rad = (g: number) => (g * Math.PI) / 180

// Base (T-012, vuelta 2): caja rectangular medida sobre las fotos reales (ver T-012.md, tabla de medidas).
// Unidad w = arista del cubo. La tapa (con las casillas) queda a ras de los muros laterales; el cubo
// apoya en Y = 0. Esquinas a 90°, sin chaflán ni escalones.
export const VUELO_LATERAL = 0.45
export const MEDIA_BANDEJA = 5 * PASO + 0.5 + VUELO_LATERAL
/** Margen de tapa entre el borde frontal y la casilla (foto: 0,35-0,40 w) y entre la casilla y el borde trasero. */
export const Z_FRENTE = -0.4
export const Z_ATRAS = 1.4
/** Grosor del MDF (ancho del canto quemado visible en las fotos: ≈ 0,05 w). */
export const GROSOR = 0.05
// Calibración de la cámara (no cambia con la base): la esquina de la bandeja del boceto aprobado.
const Z_FR = -0.58
const Y_FR = -0.64
export const CHAFLAN = 0 // caja rectangular de esquinas rectas (fotos del prototipo; T-012)

export function xCasilla(posicion: number): number {
  return (posicion - 6) * PASO
}

/** Cuadrilátero horizontal (plano Y), cara frontal (plano Z) o lateral (plano X). */
const horiz = (x0: number, x1: number, y: number, z0: number, z1: number): Vec3[] => [
  [x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1],
]
const vert = (x0: number, x1: number, y0: number, y1: number, z: number): Vec3[] => [
  [x0, y1, z], [x1, y1, z], [x1, y0, z], [x0, y0, z],
]

const HX = MEDIA_BANDEJA
export type RolBandeja = 'piso' | 'labio' | 'frente'
/** Superconjunto (las copias *.antes-* de Tablero3D usan los roles de la base anterior). */
export type RolCara = RolBandeja | 'pared' | 'paredTecho' | 'reborde' | 'escalon' | 'cara' | 'chaflan'

/** Caras de la base visibles desde la cámara, en orden pintor: tapa, canto de la tapa y pared frontal.
 *  `yFr` es la cota inferior de la pared frontal (alto de caja ≈ 0,64 w frente a 1 w del cubo). */
export function crearBandeja(yFr: number): { rol: RolCara; v: Vec3[] }[] {
  return [
    { rol: 'piso', v: horiz(-HX, HX, 0, Z_FRENTE, Z_ATRAS) },
    { rol: 'labio', v: vert(-HX, HX, -GROSOR, 0, Z_FRENTE) },
    { rol: 'frente', v: vert(-HX, HX, yFr, -GROSOR, Z_FRENTE) },
  ]
}

export { horiz, vert }

/** Contorno rectangular sobre el piso (Y = 0) alrededor de la ranura de la casilla X. */
export function contornoRanura(X: number, margen: number, z0 = -0.02, z1 = 1.02): Vec3[] {
  return horiz(X - 0.5 - margen, X + 0.5 + margen, 0, z0 - margen, z1 + margen)
}

export type CarasCubo = {
  techo: Vec3[]
  frente: Vec3[]
  costado: Vec3[] | null
  ladoCostado: 'izq' | 'der' | null
}

/** Escena proyectada con una cámara estenopeica centrada en X = 0. */
export function crearEscena(cam: Camara) {
  const fw: Vec3 = [0, -Math.sin(rad(cam.inclinacion)), Math.cos(rad(cam.inclinacion))]
  const up: Vec3 = [0, Math.cos(rad(cam.inclinacion)), Math.sin(rad(cam.inclinacion))]
  /** Altura de la cámara = 0,5 + D·sen(elevación). */
  const POSICION_CAMARA: Vec3 = [
    0,
    0.5 + cam.D * Math.sin(rad(cam.elevacion)),
    0.5 - cam.D * Math.cos(rad(cam.elevacion)),
  ]

  function bruto([x, y, z]: Vec3): Pt {
    const vx = x - POSICION_CAMARA[0]
    const vy = y - POSICION_CAMARA[1]
    const vz = z - POSICION_CAMARA[2]
    const zc = vy * fw[1] + vz * fw[2]
    const yc = vy * up[1] + vz * up[2]
    return [vx / zc, -yc / zc]
  }

  // Factor f: la esquina frontal inferior de la bandeja llega a ±508 px de la escena.
  const FOCAL = 508 / Math.abs(bruto([MEDIA_BANDEJA, Y_FR, Z_FR])[0])
  const y0 = PIE_CUBO_Y - FOCAL * bruto([0, 0, 0])[1]

  function p(P: Vec3): Pt {
    const [a, b] = bruto(P)
    return [ANCHO_ESCENA / 2 + FOCAL * a, y0 + FOCAL * b]
  }

  function pts(puntos: readonly Vec3[]): string {
    return puntos.map(P => p(P).map(n => n.toFixed(2)).join(',')).join(' ')
  }

  function pxPorW(): number {
    return p([0.5, 0, 0])[0] - p([-0.5, 0, 0])[0]
  }

  /** Caras visibles de un cubo con arista 1, base en Y = elev, centrado en X. */
  function carasCubo(X: number, elev: number): CarasCubo {
    const y1 = elev + 1
    const cam = POSICION_CAMARA[0]
    let costado: Vec3[] | null = null
    let ladoCostado: 'izq' | 'der' | null = null
    if (cam > X + 0.5) {
      ladoCostado = 'der'
      costado = [[X + 0.5, y1, 0], [X + 0.5, y1, 1], [X + 0.5, elev, 1], [X + 0.5, elev, 0]]
    } else if (cam < X - 0.5) {
      ladoCostado = 'izq'
      costado = [[X - 0.5, y1, 1], [X - 0.5, y1, 0], [X - 0.5, elev, 0], [X - 0.5, elev, 1]]
    }
    return {
      techo: horiz(X - 0.5, X + 0.5, y1, 0, 1),
      frente: vert(X - 0.5, X + 0.5, elev, y1, 0),
      costado,
      ladoCostado,
    }
  }

  /** Cubo girado alrededor del eje X que pasa por la regleta (arista local v = 0, w = W_REGLETA):
   *  `th` > 0 levanta el frente y deja ver la cara inferior. Devuelve el punto del mundo de un punto
   *  local (u a lo largo de X desde el centro, v hacia arriba, w hacia el fondo) y las caras visibles. */
  function girar(X: number, elev: number, th: number) {
    const c = Math.cos(rad(th))
    const s = Math.sin(rad(th))
    const pt = (u: number, v: number, w: number): Vec3 => {
      const zl = w - W_REGLETA
      return [X + u, elev + v * c - zl * s, W_REGLETA + v * s + zl * c]
    }
    const dir = (u: number, v: number, w: number): Vec3 => [u, v * c - w * s, v * s + w * c]
    const defs: { rol: CaraRol; n: Vec3; v: [number, number, number][] }[] = [
      { rol: 'techo', n: [0, 1, 0], v: [[-.5, 1, 0], [.5, 1, 0], [.5, 1, 1], [-.5, 1, 1]] },
      { rol: 'frente', n: [0, 0, -1], v: [[-.5, 1, 0], [.5, 1, 0], [.5, 0, 0], [-.5, 0, 0]] },
      { rol: 'fondo', n: [0, -1, 0], v: [[-.5, 0, 0], [.5, 0, 0], [.5, 0, 1], [-.5, 0, 1]] },
      { rol: 'costado-izq', n: [-1, 0, 0], v: [[-.5, 1, 1], [-.5, 1, 0], [-.5, 0, 0], [-.5, 0, 1]] },
      { rol: 'costado-der', n: [1, 0, 0], v: [[.5, 1, 0], [.5, 1, 1], [.5, 0, 1], [.5, 0, 0]] },
    ]
    const cam = POSICION_CAMARA
    const caras = defs.map(d => {
      const vs = d.v.map(([u, v, w]) => pt(u, v, w))
      const cen = vs.reduce((a, q) => [a[0] + q[0] / 4, a[1] + q[1] / 4, a[2] + q[2] / 4], [0, 0, 0])
      const n = dir(...d.n)
      const visible = n[0] * (cam[0] - cen[0]) + n[1] * (cam[1] - cen[1]) + n[2] * (cam[2] - cen[2]) > 0
      return { rol: d.rol, v: vs as Vec3[], visible }
    })
    return { pt, dir, caras: caras.filter(q => q.visible) }
  }

  /** Matriz afín (a b c d e f de SVG) que lleva coordenadas de glifo (viewBox 32×22) al techo. */
  function matrizGlifo(X: number, y: number, ancho = 0.5, profundo = 0.52): string {
    // El glifo ocupa x ∈ [2, 30] (28 u) y su centro vertical es 11.
    const kx = ancho / 28
    const kz = profundo / 18
    const o = p([X, y, 0.5])
    const ex = p([X + kx, y, 0.5])
    const ey = p([X, y, 0.5 - kz])
    const a = ex[0] - o[0]
    const b = ex[1] - o[1]
    const c = ey[0] - o[0]
    const d = ey[1] - o[1]
    const e = o[0] - 16 * a - 11 * c
    const fy = o[1] - 16 * b - 11 * d
    return `matrix(${a.toFixed(5)} ${b.toFixed(5)} ${c.toFixed(5)} ${d.toFixed(5)} ${e.toFixed(3)} ${fy.toFixed(3)})`
  }

  function caja(puntos: readonly Vec3[]): { x0: number; y0: number; x1: number; y1: number } {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const P of puntos) {
      const [x, y] = p(P)
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
    return { x0, y0, x1, y1 }
  }


  return { POSICION_CAMARA, FOCAL, p, pts, pxPorW, carasCubo, girar, matrizGlifo, caja }
}

export type Escena = ReturnType<typeof crearEscena>

// Utilidades de color para los degradados.
function aRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)]
}
export function mezclar(hex: string, con: string, t: number): string {
  const a = aRgb(hex)
  const b = aRgb(con)
  const m = a.map((c, i) => Math.round(c + (b[i] - c) * t))
  return `#${m.map(c => c.toString(16).padStart(2, '0')).join('')}`
}
export const aclarar = (hex: string, t: number) => mezclar(hex, '#ffffff', t)
export const oscurecer = (hex: string, t: number) => mezclar(hex, '#000000', t)

// El detalle de cada movimiento de un intento: lo que había para elegir, lo que
// se eligió y qué calidad tuvo (ec. 3.3, 3.4 y 3.7).
//
// Es la tabla que necesita quien quiera reanalizar una sesión sin abrir la
// aplicación, o cortar la señal del EEG por movimiento: cada fila trae el
// grado de libertad, las distancias a la meta de la mejor, la peor y la
// elegida, y si fue un punto de decisión. Con ella se reproducen todas las
// métricas del intento.
//
// NO sustituye a `juzgarMovimiento` (que es la que usan el cálculo de las
// métricas, la mediación y el motor PPA): repite su regla para poder devolver
// las distancias, y `scripts/verificarPaquete.ts` comprueba que las dos dan
// exactamente la misma calidad y el mismo número de opciones en cada
// movimiento. Si alguna vez dejaran de coincidir, la publicación se detiene.

import { buildStateGraph } from './stateGraph'

export type DetalleMovimiento = {
  k: number // número de movimiento dentro del intento (1…L)
  nodoPrevio: number // estado s_{k-1}
  nodo: number // estado s_k
  opciones: number // δ_k: jugadas legales (sin volver al estado anterior)
  dMin: number | null // distancia a la meta de la mejor opción
  dMax: number | null // ... de la peor
  dElegida: number | null // ... de la elegida
  elegidaSinSalida: boolean // la elegida llevaba a un callejón sin salida
  esDecision: boolean // pertenece a K
  calidad: number | null // C_k; null si no es punto de decisión
  sinElegir: 'unica' | 'equivalente' | null // por qué no fue decisión
  retorno: boolean // el estado ya había sido visitado antes en el intento
}

export function detalleMovimientos(pares: number, recorrido: number[]): DetalleMovimiento[] {
  const g = buildStateGraph(pares)
  const vistos = new Set<number>(recorrido.length ? [recorrido[0]] : [])
  const out: DetalleMovimiento[] = []
  for (let k = 1; k < recorrido.length; k++) {
    const estado = recorrido[k - 1]
    const anterior = k >= 2 ? recorrido[k - 2] : 0
    const elegido = recorrido[k]
    const opts = g.vecinos(estado).filter(w => w !== anterior)
    const dists = opts.map(w => g.distFinDesde(w, estado))
    const finitas = dists.filter(d => d >= 0)
    const retorno = vistos.has(elegido)
    vistos.add(elegido)
    const base = { k, nodoPrevio: estado, nodo: elegido, opciones: opts.length, retorno }
    const dEleg = g.distFinDesde(elegido, estado)
    if (finitas.length === 0) {
      out.push({ ...base, dMin: null, dMax: null, dElegida: null, elegidaSinSalida: dEleg < 0, esDecision: false, calidad: null, sinElegir: opts.length < 2 ? 'unica' : 'equivalente' })
      continue
    }
    const peor = Math.max(...finitas)
    const valor = (d: number) => (d < 0 ? peor + 1 : d)
    const vals = dists.map(valor)
    const dMin = Math.min(...vals)
    const dMax = Math.max(...vals)
    const dElegida = valor(dEleg)
    if (opts.length < 2 || dMax === dMin) {
      out.push({ ...base, dMin, dMax, dElegida, elegidaSinSalida: dEleg < 0, esDecision: false, calidad: null, sinElegir: opts.length < 2 ? 'unica' : 'equivalente' })
      continue
    }
    out.push({ ...base, dMin, dMax, dElegida, elegidaSinSalida: dEleg < 0, esDecision: true, calidad: (dElegida - dMin) / (dMax - dMin), sinElegir: null })
  }
  return out
}

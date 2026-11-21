// Genera las sesiones de ejemplo que trae la aplicación.
//
// Son SINTÉTICAS: las juega un jugador simulado con el mismo motor de reglas
// que usa la aplicación, a partir de una semilla fija, así que se pueden
// regenerar idénticas. No contienen datos de ningún participante. Sustituyen a
// las bitácoras reales que se incluían antes como ejemplo (retiradas el
// 2026-11-20 por protección de datos; ver PENDIENTES_TESIS.md).
//
// El jugador simulado elige, con probabilidad `pericia`, la jugada que más lo
// acerca a la meta (distancia en el grafo, respetando la Regla 2) y, si no,
// una jugada legal al azar. Con probabilidad `pFalla` intenta antes una jugada
// imposible, que la bitácora registra como falla. Así aparecen recorridos
// óptimos, desvíos, bucles, bloqueos y fallas, que es lo que el informe debe
// saber mostrar.
//
// Uso: npm run sesiones:generar   (escribe src/assets/sesiones/*.json)
import { writeFileSync, mkdirSync } from 'node:fs'
import {
  createInitialBoard, computeWinBoard, boardsEqual, applyMove, allLegalMoves, isStuck,
  type Board,
} from '../src/core/simulation/laEscaleraRules'
import { buildStateGraph } from '../src/core/simulation/stateGraph'
import { metricasDeIntento } from '../src/core/simulation/metricas'

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Ev = Record<string, unknown>
const posiciones = (b: Board) => b.map(c => c?.id ?? null)
const ERRORES = ['ocupada', 'lejos', 'salto_propio', 'salto_hueco']

// Perfiles ilustrativos por OBJETIVO en el plano (R, β). Las métricas son las
// de la aplicación (core/simulation/metricas.ts, ecs. 3.7 y 3.10):
//   R = media de q_k = (d_elegida − d_min)/(d_max − d_min) en los puntos de decisión
//   β = retornos / L, con retornos = (L + 1) − |estados distintos|
// Para cada intento se simulan recorridos con una política al azar (pericia y
// tendencia a volver sobre estados visitados sorteadas) y se toma el primero
// cuyas R y β, calculadas con esas mismas fórmulas, caen en la región pedida.
// Así cada perfil ilustra una combinación concreta de las dos métricas.
type Objetivo = { R: [number, number]; beta: [number, number]; gana: boolean }
type Perfil = {
  pericia: number; pFalla: number; pensarMs: [number, number]
  // Un objetivo por intento dentro de cada nivel; el último se repite.
  objetivos?: Objetivo[]
}

function buscarRecorrido(pares: number, obj: Objetivo, semilla: number): { from: number; to: number }[] {
  const rnd = mulberry32(semilla)
  const g = buildStateGraph(pares)
  const ini = createInitialBoard(pares), fin = computeWinBoard(ini)
  const dentro = (x: number, [a, b]: [number, number]) => x >= a - 1e-9 && x <= b + 1e-9
  for (let intento = 0; intento < 200000; intento++) {
    const pericia = rnd(), pVuelta = rnd()
    let b: Board = ini, prev: Board | null = null
    const rec = [g.nodeIdOf(b)], vis = new Set(rec), plan: { from: number; to: number }[] = []
    let gano = false
    for (let p = 0; p < 4 * (pares * pares + 2 * pares); p++) {
      const movs = allLegalMoves(b, prev); if (!movs.length) break
      const aqui = rec[rec.length - 1]
      const dst = (m: typeof movs[0]) => g.nodeIdOf(applyMove(b, m.from, m.to))
      const vivas = movs.filter(m => g.distFinDesde(dst(m), aqui) >= 0)
      const cand = obj.gana && vivas.length ? vivas : movs
      const vuelta = cand.filter(m => vis.has(dst(m)))
      let e = cand[Math.floor(rnd() * cand.length)]
      if (vuelta.length && rnd() < pVuelta) e = vuelta[Math.floor(rnd() * vuelta.length)]
      else if (rnd() < pericia) {
        let mj = Infinity
        for (const m of cand) { const d = g.distFinDesde(dst(m), aqui); if (d >= 0 && d < mj) { mj = d; e = m } }
      }
      const nb = applyMove(b, e.from, e.to)
      prev = b; b = nb; plan.push({ from: e.from, to: e.to }); rec.push(g.nodeIdOf(b)); vis.add(rec[rec.length - 1])
      if (boardsEqual(b, fin)) { gano = true; break }
      if (isStuck(b, fin, prev)) break
    }
    if (gano !== obj.gana) continue
    const m = metricasDeIntento(pares, rec)
    if (m.ramificacion === null) continue
    if (dentro(m.ramificacion, obj.R) && dentro(m.buclicidad, obj.beta)) return plan
  }
  throw new Error(`Sin recorrido para n=${pares} con objetivo ${JSON.stringify(obj)}`)
}

function sesion(opts: {
  seccion: 'tutorial' | 'libre'; participante: string; semilla: number; inicio: string;
  niveles: number[]; intentosPorNivel: number; perfil: Perfil;
  // Seguir jugando el nivel aunque ya se haya superado (para ver tendencias).
  seguirTrasSuperar?: boolean;
}): Ev[] {
  const rnd = mulberry32(opts.semilla)
  const evs: Ev[] = []
  let t = Date.parse(opts.inicio)
  const version = opts.seccion === 'tutorial' ? 'tutorial-niveles-v1' : 'sim-config-v0.2'
  const base = (pares: number, b: Board, nodo: number, extra: Ev): Ev => ({
    timestamp: new Date(t).toISOString(), esSimulacion: true, operadorId: '(sin asignar)',
    participanteId: opts.participante, versionConfiguracion: version, pares,
    posiciones: posiciones(b), nodoGrafo: nodo,
    ...(opts.seccion === 'tutorial' ? { nivel: pares } : {}),
    ...extra,
  })
  const espera = () => { t += Math.round(opts.perfil.pensarMs[0] + rnd() * (opts.perfil.pensarMs[1] - opts.perfil.pensarMs[0])) }
  let intentoNum = 0

  for (const pares of opts.niveles) {
    const g = buildStateGraph(pares)
    const ini = createInitialBoard(pares)
    const fin = computeWinBoard(ini)
    let superado = false
    for (let k = 0; k < opts.intentosPorNivel && (!superado || opts.seguirTrasSuperar); k++) {
      superado = false
      intentoNum++
      let b = ini
      let prev: Board | null = null
      let nodo = g.nodeIdOf(b)
      let nodoPrev = 0
      let fallasSeguidas = 0
      const objs = opts.perfil.objetivos
      const plan = objs ? buscarRecorrido(pares, objs[Math.min(k, objs.length - 1)], opts.semilla * 1000 + pares * 50 + k) : null
      let iPlan = 0
      t += 4000
      evs.push(base(pares, b, nodo, { intentoNum, tipo: 'intento_iniciado', detalle: `Intento #${intentoNum} iniciado (${pares} par${pares > 1 ? 'es' : ''}) · sesión sintética de ejemplo` }))
      if (opts.seccion === 'libre') { t += 3000; evs.push(base(pares, b, nodo, { intentoNum, tipo: 'juego_listo', detalle: 'Tablero disponible' })) }
      for (let paso = 0; paso < 6 * (pares * pares + 2 * pares); paso++) {
        espera()
        if (rnd() < opts.perfil.pFalla) {
          fallasSeguidas++
          const errorTipo = ERRORES[Math.floor(rnd() * ERRORES.length)]
          evs.push(base(pares, b, nodo, { intentoNum, tipo: 'falla', errorTipo, detalle: `Jugada inválida (${errorTipo})` }))
          if (opts.seccion === 'libre' && fallasSeguidas >= 2) {
            t += 400
            evs.push(base(pares, b, nodo, { intentoNum, tipo: 'sugerencia_ppa', fase: 'pausar', motivo: 'dos fallas consecutivas', detalle: 'Sugerencia de Pausar emitida' }))
            t += 1500
            const ok = rnd() < 0.7
            evs.push(base(pares, b, nodo, {
              intentoNum, tipo: 'decision_ppa', fase: 'pausar', motivo: 'dos fallas consecutivas',
              decision: ok ? 'confirmada' : 'descartada', activacionEfectiva: ok,
              ...(ok ? {} : { motivoDescarte: 'el jugador ya había corregido' }),
              detalle: ok ? 'Pausar confirmada' : 'Pausar descartada',
            }))
            fallasSeguidas = 0
          }
          continue
        }
        fallasSeguidas = 0
        const movs = allLegalMoves(b, prev)
        if (!movs.length) break
        let elegido = movs[Math.floor(rnd() * movs.length)]
        if (plan) {
          if (iPlan >= plan.length) break
          const sig = plan[iPlan++]
          elegido = movs.find(m => m.from === sig.from && m.to === sig.to) ?? elegido
        } else if (rnd() < opts.perfil.pericia) {
          let mejor = Infinity
          for (const m of movs) {
            const d = g.distFinDesde(g.nodeIdOf(applyMove(b, m.from, m.to)), nodo)
            if (d >= 0 && d < mejor) { mejor = d; elegido = m }
          }
        }
        const nb = applyMove(b, elegido.from, elegido.to)
        prev = b; b = nb; nodoPrev = nodo; nodo = g.nodeIdOf(b)
        evs.push(base(pares, b, nodo, { intentoNum, tipo: 'movimiento', detalle: `Ficha ${b[elegido.to]?.id} de ${elegido.from + 1} a ${elegido.to + 1}` }))
        if (boardsEqual(b, fin)) {
          t += 300
          evs.push(base(pares, b, nodo, { intentoNum, tipo: opts.seccion === 'tutorial' ? 'nivel_superado' : 'victoria', detalle: 'Meta alcanzada' }))
          superado = true
          break
        }
        if (isStuck(b, fin, prev)) {
          t += 300
          evs.push(base(pares, b, nodo, { intentoNum, tipo: opts.seccion === 'tutorial' ? 'callejon_sin_salida' : 'derrota', detalle: 'Bloqueo: la única jugada deshace la anterior' }))
          break
        }
      }
      void nodoPrev
      if (!superado && opts.seccion === 'libre' && evs[evs.length - 1].tipo !== 'derrota') {
        t += 500
        evs.push(base(pares, b, nodo, { intentoNum, tipo: 'reinicio', detalle: 'Reinicio' }))
      }
    }
  }
  return evs
}

const DESTINO = process.env.DESTINO_SESIONES ?? 'src/assets/sesiones'
mkdirSync(DESTINO, { recursive: true })
const archivos: [string, Ev[]][] = [
  ['ejemplo-a-tutorial.json', sesion({ seccion: 'tutorial', participante: 'EJEMPLO-A', semilla: 11, inicio: '2026-01-15T14:00:00.000Z', niveles: [1, 2, 3, 4, 5], intentosPorNivel: 3, perfil: { pericia: 0.7, pFalla: 0.08, pensarMs: [900, 5200] } })],
  ['ejemplo-a-practica-libre.json', sesion({ seccion: 'libre', participante: 'EJEMPLO-A', semilla: 23, inicio: '2026-01-15T14:40:00.000Z', niveles: [1, 2, 3, 4, 5], intentosPorNivel: 3, perfil: { pericia: 0.8, pFalla: 0.1, pensarMs: [800, 4600] } })],
  ['ejemplo-b-practica-libre.json', sesion({ seccion: 'libre', participante: 'EJEMPLO-B', semilla: 37, inicio: '2026-01-16T15:00:00.000Z', niveles: [1, 2, 3, 4], intentosPorNivel: 4, perfil: { pericia: 0.55, pFalla: 0.14, pensarMs: [1200, 7000] } })],
  // Perfiles ilustrativos: uno por combinación de ramificación (R) y
  // buclicidad (β), para ver en las gráficas que miden cosas distintas.
  // SIM-EXPERTO      R = 0, β = 0: siempre la mejor jugada y nunca repite; ruta mínima.
  // SIM-DESVIOS      R media, β = 0: decide peor de lo posible pero no vuelve atrás.
  // SIM-EN-BUCLE     R baja, β alta: decide bien donde decide, pero recorre ciclos.
  // SIM-ERRATICO     R alta, β alta: decide mal y vuelve sobre sí mismo; no gana.
  // SIM-APRENDIZ     R y β bajan intento a intento dentro de cada nivel (tendencia).
  ['perfil-experto.json', sesion({ seccion: 'libre', participante: 'SIM-EXPERTO', semilla: 101, inicio: '2026-02-02T14:00:00.000Z', niveles: [2, 3, 4, 5], intentosPorNivel: 3, seguirTrasSuperar: true,
    perfil: { pericia: 1, pFalla: 0.02, pensarMs: [700, 2600], objetivos: [{ R: [0, 0], beta: [0, 0], gana: true }] } })],
  ['perfil-desvios.json', sesion({ seccion: 'libre', participante: 'SIM-DESVIOS', semilla: 202, inicio: '2026-02-03T14:00:00.000Z', niveles: [3, 4], intentosPorNivel: 4, seguirTrasSuperar: true,
    perfil: { pericia: 0, pFalla: 0.05, pensarMs: [900, 4200], objetivos: [{ R: [0.25, 0.6], beta: [0, 0], gana: true }] } })],
  ['perfil-en-bucle.json', sesion({ seccion: 'libre', participante: 'SIM-EN-BUCLE', semilla: 303, inicio: '2026-02-04T14:00:00.000Z', niveles: [3, 4], intentosPorNivel: 4, seguirTrasSuperar: true,
    perfil: { pericia: 0, pFalla: 0.05, pensarMs: [900, 4200], objetivos: [{ R: [0, 0.15], beta: [0.12, 0.6], gana: true }] } })],
  ['perfil-erratico.json', sesion({ seccion: 'libre', participante: 'SIM-ERRATICO', semilla: 404, inicio: '2026-02-05T14:00:00.000Z', niveles: [3, 4], intentosPorNivel: 4, seguirTrasSuperar: true,
    perfil: { pericia: 0, pFalla: 0.15, pensarMs: [500, 3000], objetivos: [{ R: [0.5, 1], beta: [0.12, 1], gana: false }] } })],
  ['perfil-aprendiz.json', sesion({ seccion: 'libre', participante: 'SIM-APRENDIZ', semilla: 505, inicio: '2026-02-06T14:00:00.000Z', niveles: [3, 4], intentosPorNivel: 6, seguirTrasSuperar: true,
    perfil: { pericia: 0, pFalla: 0.06, pensarMs: [1200, 6000], objetivos: [
      { R: [0.5, 0.8], beta: [0.15, 1], gana: false },
      { R: [0.35, 0.5], beta: [0.1, 0.25], gana: false },
      { R: [0.2, 0.35], beta: [0.05, 0.12], gana: true },
      { R: [0.1, 0.2], beta: [0, 0.06], gana: true },
      { R: [0.01, 0.1], beta: [0, 0], gana: true },
      { R: [0, 0], beta: [0, 0], gana: true },
    ] } })],
]
for (const [nombre, evs] of archivos) {
  writeFileSync(`${DESTINO}/${nombre}`, JSON.stringify(evs, null, 2) + '\n', 'utf8')
  const tipos: Record<string, number> = {}
  for (const e of evs) tipos[e.tipo as string] = (tipos[e.tipo as string] ?? 0) + 1
  console.log(`${nombre}: ${evs.length} eventos · ${JSON.stringify(tipos)}`)
}

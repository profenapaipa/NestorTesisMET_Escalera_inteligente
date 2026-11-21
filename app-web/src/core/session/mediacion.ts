// Efecto de la mediación Pausar–Pensar–Actuar sobre la jugada siguiente.
//
// Es la pregunta central de la investigación, y hasta ahora los informes no
// la respondían: las activaciones quedaban registradas pero nadie las
// cruzaba con lo que el aprendiz hizo después.
//
// El procedimiento es el que permite un diseño de caso único: comparar, dentro
// de la misma sesión y del mismo aprendiz, las decisiones que vinieron
// inmediatamente después de una señal con las que no.
//
// Hay TRES grupos de decisiones, y el que importa para la comparación principal
// no es el que parece:
//
//   · con señal            — la primera decisión real tras una señal confirmada;
//   · sugerida y descartada — la primera decisión real tras una sugerencia que el
//                             operador descartó: el criterio de sugerencia se
//                             cumplió y NO hubo señal;
//   · sin señal            — todas las demás decisiones.
//
// Por qué la segunda es el mejor control: las señales no se reparten al azar, se
// sugieren cuando se cumple un criterio de dificultad (dos fallas seguidas, un
// tiempo largo). Las decisiones que vienen después de una señal parten, por
// construcción, de un estado distinto al de las decisiones «sin señal», y
// comparar contra todas ellas mezcla el efecto de la señal con el del momento en
// que se sugirió. Una sugerencia descartada arranca del MISMO estado y no recibe
// señal, así que la diferencia entre ambos grupos es lo más cercano a un efecto
// de la señal que permite un diseño sin aleatorización. Sigue sin ser un
// contraste causal: el operador decide qué descartar.
//
// Se miden dos cosas en cada decisión:
//
//   · la calidad del movimiento (ec. 3.7): si la señal ayudó a elegir mejor;
//   · el tiempo que la precede (ec. 3.17): si la señal hizo que se detuviera
//     a pensar, que es lo que «Pausar» pretende.
//
// Y el tiempo se mide de dos maneras. Desde la jugada anterior (como siempre) y
// desde que la señal TERMINÓ: durante la señal el aprendiz está parado por
// diseño, así que el tiempo desde la jugada anterior incluye lo que dura la
// señal y sale mayor por construcción. El que dice cuánto tardó en decidir una
// vez libre es el segundo.

import { buildStateGraph } from '../simulation/stateGraph'
import { juzgarMovimiento } from '../simulation/metricas'
import { AUTO_OFF_MS } from '../ppa/ppaColors'
import { MOTIVO_NO_ENVIADA } from '../ppa/motorPpa'
import type { EventoSesion, Seccion } from './sesion'

export type Fase = 'pausar' | 'pensar' | 'actuar'
export type GrupoMediacion = 'con_senal' | 'sugerida_descartada' | 'sin_senal'

export type Grupo = {
  n: number // decisiones en el grupo
  calidad: number | null // calidad media (0 = la mejor jugada)
  latencia: number | null // ms medios antes de decidir, desde la jugada anterior
  // ms medios desde que la señal terminó (o desde que se descartó la sugerencia).
  // null en «sin señal», que no tiene señal de la que contar.
  latenciaDesdeSenal: number | null
  // Desviación estándar muestral de la calidad; null con menos de dos decisiones.
  sd: number | null
}

export type Comparacion = {
  n1: number
  n2: number
  // Diferencia de calidad media (primer grupo menos segundo); negativa = el
  // primero eligió mejor. null si algún grupo está vacío.
  diferencia: number | null
  // Intervalo del 95 % por remuestreo (bootstrap, semilla fija). null con menos
  // de dos decisiones en algún grupo: con una sola no hay variación que remuestrear.
  intervalo: [number, number] | null
}

// Una fila por decisión real: es lo que se exporta (mediacion_decisiones.csv).
export type DecisionMediada = {
  seccion: Seccion
  intentoNum: number | null
  k: number // número de movimiento dentro del intento
  nodo: number
  ts: string
  grupo: GrupoMediacion
  fase: Fase | null // fase de la señal o sugerencia que abrió la ventana
  origen: 'sugerencia' | 'iniciativa' | null
  calidad: number
  latenciaMs: number | null
  latenciaDesdeSenalMs: number | null
}

export type EfectoMediacion = {
  activaciones: number // señales confirmadas dentro de un intento
  descartadas: number // sugerencias descartadas que abrieron su propia ventana de comparación
  // Descartes que NO abren ventana porque llegaron con una señal vigente (p. ej.
  // el Pensar encadenado que se deja pasar tras enviar Pausar): la decisión que
  // sigue es de la señal, no del control. Se cuentan aparte para que el informe
  // no los pierda ni los mezcle con el grupo de comparación.
  descartadasAbsorbidas: number
  // Sugerencias que otra fase ocupó (el operador envió otra, o dos fallas hicieron que
  // Pausar reemplazara a Actuar o Pensar). No son un «no intervenir»: no abren ventana
  // de comparación ni suman a `descartadas`.
  descartadasReemplazadas: number
  fueraDeIntento: number // confirmadas antes de abrirse ningún intento: no se atribuyen
  porFase: Record<Fase, number>
  conSenal: Grupo
  descartada: Grupo
  // Las demás decisiones de los mismos intentos: la línea base del propio aprendiz.
  sinSenal: Grupo
  // Comparación principal: mismas condiciones de partida, con y sin señal.
  conVsDescartada: Comparacion
  // Comparación de referencia: contra todo lo demás (con la salvedad de arriba).
  conVsSin: Comparacion
  decisiones: DecisionMediada[]
  // Si no hay con qué comparar, el informe debe decirlo en vez de dibujar una
  // diferencia que no se sostiene.
  comparable: boolean // con señal frente a sin señal
  comparableDescartada: boolean // con señal frente a sugerencia descartada
}

const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const desv = (xs: number[]) => {
  if (xs.length < 2) return null
  const m = xs.reduce((a, b) => a + b, 0) / xs.length
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1))
}

// Cuántos movimientos sigue vigente una señal mientras no aparezca una
// decisión. No basta con mirar la jugada inmediatamente posterior: en el
// grafo de este juego muchas posiciones ofrecen una sola jugada legal, así
// que la jugada que sigue a una señal puede estar forzada —no hay nada que
// decidir, así que no hay nada que medir—. La mediación pretende mejorar DECISIONES, de modo que lo que se
// observa es la primera decisión real que llega tras la señal. Se acota a
// tres movimientos porque atribuir a una señal una decisión muy posterior
// sería atribuirle lo que ya no le corresponde.
const VENTANA = 3

// Remuestreo con semilla fija: el mismo conjunto de datos da siempre el mismo
// intervalo, que es lo que permite verificarlo y reproducirlo.
function generador(semilla: number) {
  let a = semilla >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function comparar(xs: number[], ys: number[]): Comparacion {
  const mx = media(xs)
  const my = media(ys)
  const dif = mx !== null && my !== null ? mx - my : null
  if (dif === null || xs.length < 2 || ys.length < 2) {
    return { n1: xs.length, n2: ys.length, diferencia: dif, intervalo: null }
  }
  const rnd = generador(20261120)
  const B = 2000
  const difs: number[] = []
  const remuestra = (v: number[]) => {
    let s = 0
    for (let i = 0; i < v.length; i++) s += v[Math.floor(rnd() * v.length)]
    return s / v.length
  }
  for (let b = 0; b < B; b++) difs.push(remuestra(xs) - remuestra(ys))
  difs.sort((p, q) => p - q)
  return {
    n1: xs.length, n2: ys.length, diferencia: dif,
    intervalo: [difs[Math.floor(0.025 * B)], difs[Math.min(B - 1, Math.floor(0.975 * B))]],
  }
}

// Qué bitácoras cuentan el anillo lleno que no se envió.
//
// ppa-v2 (2026-11-20, tarde) registra `sugerencia_ppa` en el instante en que el
// anillo se llena y escribe el «descartada» cuando el operador lo deja pasar, que
// puede ser DESPUÉS de la jugada del aprendiz. Para esas bitácoras la jugada hecha
// con el anillo lleno es del grupo de comparación y se cuenta desde que el anillo
// se llenó (el `pendiente` de abajo).
//
// En las bitácoras anteriores (ppa-v1, o sin versión) las sugerencias esperaban la
// decisión del operador y eran él quien las confirmaba, a veces tarde, después de
// una jugada. Si se les aplicara la regla del pendiente, una sugerencia confirmada
// tras la jugada pasaría a «descartada» y las cifras de un reanálisis cambiarían
// sin que nada hubiera cambiado en la sesión. Por eso se conservan tal cual: la
// sugerencia se ignora y solo cuentan las decisiones del operador. Lo único que se
// corrigió también para ellas es que un descarte no sustituya la ventana de una
// señal vigente.
const esV2 = (e: EventoSesion) => (e.versionPpa ?? '').startsWith('ppa-v2')

export function efectoMediacion(eventos: EventoSesion[], seccion?: Seccion): EfectoMediacion {
  const porFase: Record<Fase, number> = { pausar: 0, pensar: 0, actuar: 0 }
  let activaciones = 0
  let descartadas = 0
  let descartadasAbsorbidas = 0
  let descartadasReemplazadas = 0
  let fueraDeIntento = 0
  const decisiones: DecisionMediada[] = []

  // Estado por sección: las pestañas pueden alternarse dentro de una sesión.
  type Ventana = {
    grupo: 'con_senal' | 'sugerida_descartada'
    fase: Fase | null
    origen: 'sugerencia' | 'iniciativa' | null
    // Instante (ms) desde el que se cuenta el tiempo «libre»: el fin de la señal,
    // o el momento en que se descartó la sugerencia.
    libreDesde: number
  }
  type Abierto = {
    pares: number; anterior: number; actual: number; tUltimo: number | null
    tras: number; ventana: Ventana | null; intentoNum: number | null; k: number
    // Anillo lleno (sugerencia) que el operador aún no envió ni dejó pasar. Solo
    // en bitácoras ppa-v2 (ver `esV2`).
    pendiente: { fase: Fase | null; t: number } | null
    // Qué pasó con esa sugerencia cuando todavía no se había resuelto, para que el
    // «descartada» que la bitácora escribe después no abra una ventana falsa:
    //   'ventana'   — la jugada del aprendiz ya abrió su ventana de comparación;
    //   'absorbido' — había una señal vigente (o se envió otra fase) y la decisión
    //                 siguiente es de esa señal.
    cubierto: 'ventana' | 'absorbido' | null
  }
  const abiertos = new Map<Seccion, Abierto>()

  for (const e of eventos) {
    if (seccion && e.seccion !== seccion) continue
    const t = Date.parse(e.ts)

    if (e.tipo === 'intento_iniciado') {
      abiertos.set(e.seccion, {
        pares: e.pares ?? 0, anterior: 0, actual: e.nodoGrafo ?? 0, tUltimo: null, tras: 0,
        ventana: null, intentoNum: e.intentoNum ?? null, k: 0, pendiente: null, cubierto: null,
      })
      continue
    }

    const esDecisionPpa = e.tipo === 'decision_ppa'
    const a = abiertos.get(e.seccion)
    if (!a) {
      if (esDecisionPpa && e.decision !== 'descartada') fueraDeIntento++
      continue
    }

    // El tablero queda jugable: origen de tiempos (ver ec. 3.17).
    if (e.tipo === 'juego_listo') { a.tUltimo = t; continue }

    // Un anillo se llenó. Solo las bitácoras ppa-v2 guardan el instante en que se
    // llenó y lo usan: en ppa-v1 la sugerencia no cambia el análisis (ver `esV2`).
    if (e.tipo === 'sugerencia_ppa') {
      if (esV2(e)) { a.pendiente = { fase: e.fase ?? null, t }; a.cubierto = null }
      continue
    }

    if (esDecisionPpa) {
      const fase = e.fase ?? null
      const origen = e.origen ?? null
      if (e.decision === 'descartada' && e.motivoDescarte === MOTIVO_NO_ENVIADA.reemplazada) {
        // Otra fase ocupó el anillo: la sugerencia no se cumplió como «criterio sin
        // señal», así que no abre ventana de comparación ni cuenta como descartada.
        // La decisión que siga será de la fase que la reemplazó (o, si esa tampoco se
        // envía, de la nueva sugerencia pendiente). Vale para toda versión.
        descartadasReemplazadas++
        if (a.pendiente && a.pendiente.fase === fase) a.pendiente = null
        continue
      }
      if (e.decision === 'descartada') {
        // Una señal VIGENTE manda: la decisión que sigue es suya, y un descarte que
        // llega con ella (típicamente el Pensar encadenado que se deja pasar tras
        // enviar Pausar) no puede quitarle la ventana. Valía para toda versión:
        // sustituir la ventana de una señal real por la del control pasaba la
        // decisión que siguió a la señal al grupo de comparación.
        const viva = a.tras > 0 && a.ventana?.grupo === 'con_senal'
        if (a.cubierto === 'ventana') {
          // La jugada ya abrió (y contó) su ventana: el descarte que llega después
          // solo la confirma.
        } else if (a.cubierto === 'absorbido' || viva) {
          descartadasAbsorbidas++
        } else {
          // La sugerencia se cumplió y el operador no activó nada: arranca la
          // ventana del grupo de comparación.
          descartadas++
          a.tras = VENTANA
          a.ventana = { grupo: 'sugerida_descartada', fase, origen, libreDesde: t }
        }
        a.pendiente = null
        a.cubierto = null
      } else {
        // Se envió otra fase que la de la sugerencia aún sin resolver (p. ej. el
        // operador manda Pausar con el anillo de Actuar lleno): el descarte de
        // aquella llegará después y no debe abrir ventana.
        a.cubierto = a.pendiente && a.pendiente.fase !== fase ? 'absorbido' : null
        a.pendiente = null
        activaciones++
        if (fase) porFase[fase]++
        // La señal queda «vigente» durante los siguientes movimientos, y el
        // aprendiz queda libre cuando termina (se apaga sola, ver AUTO_OFF_MS).
        a.tras = VENTANA
        a.ventana = { grupo: 'con_senal', fase, origen, libreDesde: t + AUTO_OFF_MS }
      }
      continue
    }

    // Un movimiento es cualquier evento que deja al aprendiz en otra posición
    // del grafo. Se detecta así, y no por el tipo, porque cada vista nombra
    // sus eventos de forma distinta: la simulación registra «movimiento» y
    // Control, la actualización de posiciones que llega del tablero físico.
    const nodo = e.nodoGrafo
    if (!nodo || nodo <= 0 || nodo === a.actual || !a.pares) continue

    // ppa-v2: el aprendiz jugó con un anillo lleno que el operador no envió.
    //  · Sin señal vigente, esa jugada ya es del grupo de comparación (criterio
    //    cumplido, sin señal) y su tiempo «libre» se cuenta desde que el anillo se
    //    llenó; el «descartada» que la bitácora escribe al cerrarla llega con la
    //    jugada y no abre otra ventana.
    //  · Con una señal vigente (Pausar enviado y Pensar encadenado sin enviar), la
    //    jugada es de la señal: el anillo pendiente queda absorbido y su
    //    «descartada» posterior no abre una ventana falsa sobre la jugada siguiente.
    if (a.pendiente) {
      if (a.tras > 0 && a.ventana?.grupo === 'con_senal') {
        a.cubierto = 'absorbido'
      } else {
        descartadas++
        a.tras = VENTANA
        a.ventana = { grupo: 'sugerida_descartada', fase: a.pendiente.fase, origen: 'sugerencia', libreDesde: a.pendiente.t }
        a.cubierto = 'ventana'
      }
      a.pendiente = null
    }

    const g = buildStateGraph(a.pares)
    const { calidad } = juzgarMovimiento(g, a.actual, a.anterior, nodo)
    a.k++
    if (calidad !== null) {
      const v = a.tras > 0 ? a.ventana : null
      const latencia = a.tUltimo !== null && t - a.tUltimo >= 0 ? t - a.tUltimo : null
      // Desde que la señal terminó: solo cuenta si la decisión llegó DESPUÉS del
      // fin de la señal; una jugada hecha con la señal encendida no tiene «tiempo
      // libre» que medir.
      const desde = v && a.tUltimo !== null ? Math.max(a.tUltimo, v.libreDesde) : null
      const latenciaDesdeSenal = v && desde !== null && t >= desde ? t - desde : null
      decisiones.push({
        seccion: e.seccion, intentoNum: a.intentoNum, k: a.k, nodo, ts: e.ts,
        grupo: v ? v.grupo : 'sin_senal', fase: v ? v.fase : null, origen: v ? v.origen : null,
        calidad, latenciaMs: latencia, latenciaDesdeSenalMs: latenciaDesdeSenal,
      })
      // La señal se gasta al llegar la primera decisión: lo que viene después
      // ya no se le puede atribuir.
      a.tras = 0
      a.ventana = null
    } else if (a.tras > 0) {
      // Movimiento forzado: no consume la señal, pero acorta su vigencia.
      a.tras--
      if (a.tras === 0) a.ventana = null
    }
    a.anterior = a.actual
    a.actual = nodo
    a.tUltimo = t
  }

  const delGrupo = (g: GrupoMediacion) => decisiones.filter(d => d.grupo === g)
  const grupo = (g: GrupoMediacion): Grupo => {
    const ds = delGrupo(g)
    const cal = ds.map(d => d.calidad)
    return {
      n: ds.length,
      calidad: media(cal),
      latencia: media(ds.flatMap(d => (d.latenciaMs === null ? [] : [d.latenciaMs]))),
      latenciaDesdeSenal: media(ds.flatMap(d => (d.latenciaDesdeSenalMs === null ? [] : [d.latenciaDesdeSenalMs]))),
      sd: desv(cal),
    }
  }
  const conSenal = grupo('con_senal')
  const sinSenal = grupo('sin_senal')
  const descartada = grupo('sugerida_descartada')
  const cal = (g: GrupoMediacion) => delGrupo(g).map(d => d.calidad)
  return {
    activaciones, descartadas, descartadasAbsorbidas, descartadasReemplazadas, fueraDeIntento, porFase,
    conSenal, sinSenal, descartada,
    conVsDescartada: comparar(cal('con_senal'), cal('sugerida_descartada')),
    conVsSin: comparar(cal('con_senal'), cal('sin_senal')),
    decisiones,
    comparable: conSenal.n > 0 && sinSenal.n > 0,
    comparableDescartada: conSenal.n > 0 && descartada.n > 0,
  }
}

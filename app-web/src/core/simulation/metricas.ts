// Métricas de trayectoria del juego La Escalera, según las ecuaciones de
// main.tex, sección "Fundamento matemático de las métricas de análisis"
// (3.2 a 3.17). Se calculan sobre el recorrido del aprendiz proyectado
// sobre el grafo de estados: el paseo W = (s0, s1, …, sL).
//
// Tres familias independientes, porque miden conductas distintas:
//   · Circuidad    — cuánto se desvió la ruta de la mínima posible.
//   · Ramificación — qué tan buenas fueron sus decisiones, allí donde decidió.
//   · Buclicidad   — cuántas veces volvió sobre sus pasos.
//
// Una trayectoria puede alejarse mucho del recorrido más corto sin repetir jamás
// un estado, o repetir mucho sin alejarse: por eso no se agregan en un índice
// único.
//
// Ninguna de las tres compara el paseo contra una ruta óptima de referencia, y
// no por comodidad: del Inicio al Fin hay DOS recorridos mínimos (ver
// stateGraph.ts), así que apartarse de uno puede ser seguir el otro. La
// circuidad compara longitudes y la ramificación compara distancias; ambas dan
// lo mismo se tome el recorrido mínimo que se tome.

import { buildStateGraph, type StateGraph } from './stateGraph'

export type MetricasIntento = {
  pares: number
  movimientos: number // L_i
  optimo: number // D*(n) = n² + 2n
  // Circuidad Q_i = L_i / D*(n). Vale 1 en una partida óptima (ec. 3.5).
  // Solo tiene sentido en un intento que alcanzó la meta: en uno bloqueado o
  // abandonado el recorrido no llegó a destino y el cociente no es comparable.
  circuidad: number
  // Eficiencia E_i = D*(n) / L_i, la recíproca de la circuidad (ec. 3.6). Es la
  // forma en que esta magnitud se reporta en la literatura de tareas de torre
  // —Faber, Kühnpast, Sürer, Hinz y Danek (2009) la llaman «efficiency»— y
  // tiene una ventaja práctica sobre Q: está acotada en (0, 1], así que puede
  // dibujarse en el mismo eje que la ramificación, la tasa de acierto y la
  // buclicidad. 1 = partida mínima.
  eficiencia: number
  // Ramificación R_i: calidad media de las decisiones, en [0,1]. 0 = siempre
  // eligió lo mejor disponible (ec. 3.8). `null` si el intento no tuvo ningún
  // punto de decisión: no hay nada que promediar, y un 0 sería «perfecto».
  ramificacion: number | null
  // Tasa de acierto α_i en puntos críticos, en [0,1] (ec. 3.9). `null` por la
  // misma razón que la ramificación.
  tasaAcierto: number | null
  // Grado de libertad medio del recorrido (ec. 3.10).
  gradoLibertadMedio: number
  puntosDecision: number // |K|
  aciertos: number
  // Perfil: la secuencia de C_k a lo largo del intento. El promedio resume;
  // el perfil muestra en qué tramo se concentraron los errores.
  perfil: { movimiento: number; calidad: number }[]
  // Retornos ν_i (ec. 3.11) y su versión normalizada β_i (ec. 3.12).
  retornos: number
  buclicidad: number
  // Ciclos independientes μ_i = |E(W)| − |V(W)| + 1 (número ciclomático, ec. 3.13).
  ciclosIndependientes: number
  // Tamaño de cada bucle observado. Por el cuello del grafo, nunca menor que 6.
  tamanosBucle: number[]
  estadosDistintos: number
  // Las jugadas que no fueron punto de decisión, separadas por la razón: solo
  // había una jugada legal, o había varias pero todas dejaban la misma
  // distancia (p. ej. el espejo del estado inicial). Las dos son «sin elección
  // real», pero no son lo mismo, y el tiempo antes de ellas se agrupa junto.
  jugadasSinElegir: { unica: number; equivalentes: number }
  // ── Tiempos (ec. 3.17) ───────────────────────────────────────────────────
  //
  // Solo se calculan si la bitácora guarda el instante de cada jugada; si no,
  // quedan en null y el informe lo dice en vez de inventar un cero.
  //
  // `latenciaInicial` es el «initiation time» de la literatura de tareas de
  // torre: el tiempo desde que se presenta el problema hasta el primer
  // movimiento, que Faber, Kühnpast, Sürer, Hinz y Danek (2009) describen
  // como «the time needed for planning».
  //
  // Las otras dos separan lo que ningún total de tiempo distingue: cuánto
  // tardó donde había algo que decidir y cuánto donde la jugada estaba
  // forzada. Un participante puede ser lento en todo —y eso es velocidad
  // motriz— o lento solo donde había que elegir, que es deliberación.
  latenciaInicial: number | null // ms hasta el primer movimiento
  latenciaDecision: number | null // ms medios antes de un punto de decisión
  latenciaForzada: number | null // ms medios antes de una jugada sin elección
}

// Juzga UN movimiento sobre el grafo: cuántas opciones había y qué calidad
// tuvo la elegida (ec. 3.7), o null si en esa posición no había nada que
// decidir —una sola jugada, o todas dejando la misma distancia—.
//
// Está aparte porque no solo la usa el cálculo de las métricas del intento:
// el análisis de la mediación (core/session/mediacion.ts) necesita juzgar
// jugadas sueltas, las que siguen a una señal del ciclo.
export function juzgarMovimiento(
  g: StateGraph, estado: number, anterior: number, elegido: number,
): { opciones: number; calidad: number | null } {
  // Grados de libertad: los vecinos, menos el estado anterior (Regla 2).
  const opciones = g.vecinos(estado).filter(w => w !== anterior)
  const dists = opciones.map(w => g.distFinDesde(w, estado))
  // Un callejón sin salida (distancia -1) es el peor resultado posible, no
  // un valor menor: se normaliza por encima del máximo alcanzable.
  const finitas = dists.filter(d => d >= 0)
  if (finitas.length === 0) return { opciones: opciones.length, calidad: null }
  const peorFinita = Math.max(...finitas)
  const valor = (d: number) => (d < 0 ? peorFinita + 1 : d)
  const vals = dists.map(valor)
  const dMin = Math.min(...vals)
  const dMax = Math.max(...vals)
  // Punto de decisión: más de una opción y no todas equivalentes (ec. 3.4).
  if (opciones.length < 2 || dMax === dMin) return { opciones: opciones.length, calidad: null }
  return {
    opciones: opciones.length,
    calidad: (valor(g.distFinDesde(elegido, estado)) - dMin) / (dMax - dMin),
  }
}

const vacias = (pares: number): MetricasIntento => ({
  pares, movimientos: 0, optimo: pares * pares + 2 * pares, circuidad: 0, eficiencia: 0,
  ramificacion: null, tasaAcierto: null, gradoLibertadMedio: 0, puntosDecision: 0,
  aciertos: 0, perfil: [], retornos: 0, buclicidad: 0, ciclosIndependientes: 0,
  tamanosBucle: [], estadosDistintos: 0, jugadasSinElegir: { unica: 0, equivalentes: 0 },
  latenciaInicial: null, latenciaDecision: null, latenciaForzada: null,
})

// `recorrido` es la lista de IDs de nodo del grafo, en orden, empezando por el
// estado inicial. Es exactamente lo que ya guardan las pestañas de simulación.
// `tiempos` son los milisegundos transcurridos desde el inicio del intento
// hasta cada movimiento: uno por movimiento, de modo que su longitud es la del
// recorrido menos uno. Es opcional porque no todas las bitácoras lo guardan.
export function metricasDeIntento(pares: number, recorrido: number[], tiempos?: number[]): MetricasIntento {
  const g: StateGraph = buildStateGraph(pares)
  const L = recorrido.length - 1
  if (L <= 0) return vacias(pares)
  // Solo se usan si cuadran con el recorrido: una bitácora a medias daría
  // latencias desplazadas, que es peor que no darlas.
  const ts = tiempos && tiempos.length === L ? tiempos : null

  const optimo = pares * pares + 2 * pares
  const calidades: number[] = []
  const perfil: MetricasIntento['perfil'] = []
  const decision: boolean[] = [] // decision[k] = el movimiento k fue punto de decisión
  let sumaGrados = 0
  const sinElegir = { unica: 0, equivalentes: 0 }

  for (let k = 1; k <= L; k++) {
    const r = juzgarMovimiento(g, recorrido[k - 1], k >= 2 ? recorrido[k - 2] : 0, recorrido[k])
    sumaGrados += r.opciones
    if (r.calidad === null) {
      if (r.opciones < 2) sinElegir.unica++
      else sinElegir.equivalentes++
      continue
    }
    decision[k] = true
    calidades.push(r.calidad)
    perfil.push({ movimiento: k, calidad: r.calidad })
  }

  // Buclicidad sobre el paseo.
  const estados = new Set(recorrido)
  const aristas = new Set<string>()
  for (let i = 1; i <= L; i++) {
    const a = recorrido[i - 1], b = recorrido[i]
    aristas.add(a < b ? `${a}-${b}` : `${b}-${a}`)
  }
  const retornos = (L + 1) - estados.size

  // Tamaño de cada bucle: distancia al paso previo en que se visitó ese estado.
  const ultimaVisita = new Map<number, number>()
  const tamanosBucle: number[] = []
  recorrido.forEach((id, i) => {
    const previa = ultimaVisita.get(id)
    if (previa !== undefined) tamanosBucle.push(i - previa)
    ultimaVisita.set(id, i)
  })

  // Latencias: el intervalo que precede a cada movimiento, separado según si
  // en esa posición había algo que decidir.
  let latenciaInicial: number | null = null
  let latenciaDecision: number | null = null
  let latenciaForzada: number | null = null
  if (ts) {
    latenciaInicial = ts[0]
    const conEleccion: number[] = []
    const forzadas: number[] = []
    // Desde el SEGUNDO movimiento. El intervalo que precede al primero es la
    // latencia inicial, que ya se reporta aparte y además arrastra el tiempo
    // que la interfaz tarda en dejar jugar; mezclarlo en estas dos medias las
    // falsea. Y lo falsea siempre en el mismo sentido: en el estado inicial
    // las dos jugadas posibles son imagen especular y dejan la misma
    // distancia, así que nunca es punto de decisión y el primer intervalo
    // caería entero del lado de las jugadas forzadas.
    for (let k = 2; k <= L; k++) {
      const intervalo = ts[k - 1] - ts[k - 2]
      if (intervalo < 0) continue // marcas de tiempo desordenadas: se descarta
      ;(decision[k] ? conEleccion : forzadas).push(intervalo)
    }
    const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
    latenciaDecision = media(conEleccion)
    latenciaForzada = media(forzadas)
  }

  const aciertos = calidades.filter(c => c === 0).length
  return {
    pares,
    movimientos: L,
    optimo,
    circuidad: L / optimo,
    eficiencia: optimo / L,
    ramificacion: calidades.length ? calidades.reduce((a, b) => a + b, 0) / calidades.length : null,
    tasaAcierto: calidades.length ? aciertos / calidades.length : null,
    gradoLibertadMedio: sumaGrados / L,
    puntosDecision: calidades.length,
    aciertos,
    perfil,
    retornos,
    buclicidad: retornos / L,
    ciclosIndependientes: Math.max(0, aristas.size - estados.size + 1),
    tamanosBucle,
    estadosDistintos: estados.size,
    jugadasSinElegir: sinElegir,
    latenciaInicial,
    latenciaDecision,
    latenciaForzada,
  }
}

export type IntentoRegistrado = {
  numero: number
  pares: number
  resultado: 'victoria' | 'bloqueo' | 'reiniciado'
  segundos: number
  errores: number
  metricas: MetricasIntento
}

export type MetricasSesion = {
  intentos: number
  victorias: number
  bloqueos: number
  // ── Agregación entre intentos ────────────────────────────────────────────
  //
  // Hay dos formas de resumir un conjunto de intentos, y NO dan lo mismo.
  //
  //   · La media por intento (ec. 3.14): promedia los valores ya promediados
  //     de cada intento. Un intento con un solo punto de decisión pesa igual
  //     que uno con cuarenta. Describe «cómo le fue en un intento típico».
  //   · La agregada o ponderada (ec. 3.15): junta primero y divide después.
  //     Equivale a promediar TODAS las decisiones de la sesión, no las medias.
  //     Describe «cómo decidió en la sesión».
  //
  // La diferencia puede ser grande: cuando los intentos cortos arrastran la
  // media, la ramificación ponderada puede quedar en la mitad de la media por
  // intento; cuando los retornos se concentran en los intentos largos, la
  // buclicidad agregada puede triplicar la media (las cifras de ejemplo están
  // en la sección «Agregación e interpretación» de la tesis, calculadas con
  // las sesiones sintéticas). Como la cifra puede cambiar de categoría en el informe, se
  // calculan y se muestran las dos, y la ponderada es la que titula.
  circuidadMedia: number // solo sobre los intentos ganados (ver `circuidad`)
  eficienciaMedia: number // E media por intento, solo sobre los ganados (lectura auxiliar)
  // E agregada: ΣD* / ΣL sobre los intentos ganados. «El mínimo total entre lo
  // que se usó en total», la misma lógica de «juntar primero y dividir
  // después» de la ec. 3.15, y la única que se puede leer como «usó X veces el
  // mínimo» aunque los intentos sean de niveles distintos.
  eficienciaAgregada: number | null
  ramificacionMedia: number // media por intento de R (ec. 3.14)
  buclicidadMedia: number // media por intento de β (ec. 3.14)
  // Ponderadas (ec. 3.15): Σ(|K_j|·R_j)/Σ|K_j| y Σν_j/ΣL_j.
  ramificacionPonderada: number
  buclicidadAgregada: number
  // Cuántas decisiones reales sostienen la cifra ponderada. Sin esto no se
  // puede juzgar si un valor es sólido o viene de tres jugadas.
  puntosDecisionTotales: number
  tasaAciertoMedia: number
  tasaAciertoPonderada: number
  retornosTotales: number
  movimientosTotales: number
  erroresTotales: number
  segundosTotales: number
}

const promedio = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const suma = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
// Media ponderada: Σ(p_j·x_j)/Σp_j. Si no hay peso, devuelve 0 en vez de NaN.
const ponderada = (xs: number[], ps: number[]) => {
  const t = suma(ps)
  return t > 0 ? suma(xs.map((x, k) => x * ps[k])) / t : 0
}

export function metricasDeSesion(intentos: IntentoRegistrado[]): MetricasSesion {
  const jugados = intentos.filter(i => i.metricas.movimientos > 0)
  const ganados = jugados.filter(i => i.resultado === 'victoria')
  const conDecisiones = jugados.filter(i => i.metricas.puntosDecision > 0)
  const pesos = conDecisiones.map(i => i.metricas.puntosDecision)
  const rs = conDecisiones.map(i => i.metricas.ramificacion ?? 0)
  const movGanados = suma(ganados.map(i => i.metricas.movimientos))
  return {
    intentos: intentos.length,
    victorias: ganados.length,
    bloqueos: intentos.filter(i => i.resultado === 'bloqueo').length,
    circuidadMedia: promedio(ganados.map(i => i.metricas.circuidad)),
    eficienciaMedia: promedio(ganados.map(i => i.metricas.eficiencia)),
    eficienciaAgregada: movGanados > 0 ? suma(ganados.map(i => i.metricas.optimo)) / movGanados : null,
    ramificacionMedia: promedio(rs),
    buclicidadMedia: promedio(jugados.map(i => i.metricas.buclicidad)),
    ramificacionPonderada: ponderada(rs, pesos),
    buclicidadAgregada: suma(jugados.map(i => i.metricas.movimientos)) > 0
      ? suma(jugados.map(i => i.metricas.retornos)) / suma(jugados.map(i => i.metricas.movimientos))
      : 0,
    puntosDecisionTotales: suma(pesos),
    tasaAciertoMedia: promedio(conDecisiones.map(i => i.metricas.tasaAcierto ?? 0)),
    tasaAciertoPonderada: ponderada(conDecisiones.map(i => i.metricas.tasaAcierto ?? 0), pesos),
    retornosTotales: jugados.reduce((a, i) => a + i.metricas.retornos, 0),
    movimientosTotales: jugados.reduce((a, i) => a + i.metricas.movimientos, 0),
    erroresTotales: intentos.reduce((a, i) => a + i.errores, 0),
    segundosTotales: intentos.reduce((a, i) => a + i.segundos, 0),
  }
}

// Agregación estratificada por nivel (ec. 3.16).
//
// Promediar entre niveles mezcla cosas que no son comparables: el grado de
// libertad medio y el número de puntos de decisión cambian con el tamaño del
// tablero, de modo que una ramificación de 0,20 en dos pares y otra de 0,20 en
// cinco no describen la misma conducta. El estudio del iso-efecto en la Torre
// de Londres (Faber, Kühnpast, Sürer, Hinz y Danek, 2009) compara por esa
// razón dentro de problemas de la misma longitud, nunca entre longitudes
// distintas.
export type ResumenNivel = {
  pares: number
  optimo: number
  intentos: number
  ganados: number
  mejorMovimientos: number | null // la mejor partida ganada
  eficienciaMejor: number | null // D* / mejor
  eficienciaAgregada: number | null // ΣD* / ΣL sobre los ganados
  ramificacionPonderada: number
  buclicidadAgregada: number
  puntosDecision: number
}

export function metricasPorNivel(intentos: IntentoRegistrado[]): ResumenNivel[] {
  const jugados = intentos.filter(i => i.metricas.movimientos > 0)
  const niveles = [...new Set(jugados.map(i => i.pares))].sort((a, b) => a - b)
  return niveles.map(pares => {
    const del = jugados.filter(i => i.pares === pares)
    const ganados = del.filter(i => i.resultado === 'victoria')
    const optimo = pares * pares + 2 * pares
    const mejor = ganados.length ? Math.min(...ganados.map(i => i.metricas.movimientos)) : null
    const conK = del.filter(i => i.metricas.puntosDecision > 0)
    const pesos = conK.map(i => i.metricas.puntosDecision)
    const total = pesos.reduce((a, b) => a + b, 0)
    const movs = del.reduce((a, i) => a + i.metricas.movimientos, 0)
    return {
      pares, optimo, intentos: del.length, ganados: ganados.length,
      mejorMovimientos: mejor,
      eficienciaMejor: mejor ? optimo / mejor : null,
      eficienciaAgregada: ganados.length ? (optimo * ganados.length) / ganados.reduce((a, i) => a + i.metricas.movimientos, 0) : null,
      ramificacionPonderada: total > 0
        ? conK.reduce((a, i) => a + (i.metricas.ramificacion ?? 0) * i.metricas.puntosDecision, 0) / total
        : 0,
      buclicidadAgregada: movs > 0 ? del.reduce((a, i) => a + i.metricas.retornos, 0) / movs : 0,
      puntosDecision: total,
    }
  })
}

// Pendiente de la recta de mínimos cuadrados de `ys` contra su orden (1, 2, …).
//
// La tendencia dejada en un gráfico es una impresión; esto es el número. Dice
// cuánto cambia el indicador por cada intento (o cada sesión) que pasa, y su
// signo es lo que sostiene la afirmación de que hubo aprendizaje. Devuelve
// null con menos de tres puntos, porque con dos cualquier recta pasa exacta.
export function pendiente(ys: number[]): number | null {
  const n = ys.length
  if (n < 3) return null
  const mx = (n + 1) / 2
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, den = 0
  ys.forEach((y, k) => { const dx = (k + 1) - mx; num += dx * (y - my); den += dx * dx })
  return den === 0 ? null : num / den
}

// La pendiente (ec. 3.16) con su error estándar, para poder decir «sube», «baja»
// o «sin cambio distinguible» sin inventar un umbral: una pendiente se
// considera distinta de cero cuando supera dos veces su error estándar. Con
// menos de cuatro puntos no hay grados de libertad para estimar ese error, y
// el informe lo dice en lugar de afirmar un sentido.
export type TendenciaNum = {
  n: number
  pendiente: number | null // por intento (o por sesión); null con menos de 3 puntos
  error: number | null // error estándar de la pendiente; null con menos de 4 puntos
  sentido: 'sube' | 'baja' | 'sin_cambio' | 'insuficiente'
}

export function tendenciaDe(ys: number[]): TendenciaNum {
  const n = ys.length
  const b = pendiente(ys)
  if (b === null || n < 4) return { n, pendiente: b, error: null, sentido: 'insuficiente' }
  const mx = (n + 1) / 2
  const my = ys.reduce((a, c) => a + c, 0) / n
  const sxx = ys.reduce((a, _, k) => a + ((k + 1) - mx) ** 2, 0)
  const a0 = my - b * mx
  const sse = ys.reduce((a, y, k) => a + (y - (a0 + b * (k + 1))) ** 2, 0)
  const error = Math.sqrt(sse / (n - 2) / sxx)
  const distinta = error === 0 ? b !== 0 : Math.abs(b) > 2 * error
  return { n, pendiente: b, error, sentido: !distinta ? 'sin_cambio' : b > 0 ? 'sube' : 'baja' }
}

// Una tendencia por nivel: comparar dentro del mismo nivel y nunca entre niveles
// distintos (ver «Estratificación por nivel» en main.tex). Los intentos se
// toman en el orden en que vienen.
export function tendenciasPorNivel(
  intentos: IntentoRegistrado[], valor: (i: IntentoRegistrado) => number | null,
): { pares: number; tendencia: TendenciaNum }[] {
  const niveles = [...new Set(intentos.filter(i => i.metricas.movimientos > 0).map(i => i.pares))].sort((a, b) => a - b)
  return niveles.map(pares => ({
    pares,
    tendencia: tendenciaDe(intentos.filter(i => i.pares === pares && i.metricas.movimientos > 0)
      .map(valor).filter((x): x is number => x !== null)),
  }))
}

// Una sesión guardada por una versión anterior trae R = 0 y α = 1 en los
// intentos sin decisiones. Aquí se llevan al significado actual (`null`), para
// que lo que se exporta no diga «perfecto» donde no hubo nada que medir.
export function normalizarMetricas(m: MetricasIntento): MetricasIntento {
  const sinK = m.puntosDecision === 0
  const falta = m.jugadasSinElegir === undefined
  if (!(sinK && (m.ramificacion !== null || m.tasaAcierto !== null)) && !falta) return m
  return {
    ...m,
    ramificacion: sinK ? null : m.ramificacion,
    tasaAcierto: sinK ? null : m.tasaAcierto,
    jugadasSinElegir: m.jugadasSinElegir ?? { unica: 0, equivalentes: 0 },
  }
}

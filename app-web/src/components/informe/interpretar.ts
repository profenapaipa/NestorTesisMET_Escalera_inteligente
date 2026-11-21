import { metricasDeSesion, tendenciaDe, tendenciasPorNivel, type MetricasIntento, type TendenciaNum } from '../../core/simulation/metricas'
import { NOMBRE_SECCION, REGLA_DE_ERROR, type IntentoSesion, type Seccion } from '../../core/session/sesion'

// Lectura en lenguaje llano de las métricas del informe.
//
// Un número suelto (R = 0,214) no le dice nada a quien acompaña la sesión, y
// el informe lo tiene que leer el tutor, el observador y la familia, no solo
// quien escribió las ecuaciones. Aquí se traduce cada métrica a una frase, y
// el conjunto a una síntesis de dos o tres líneas.
//
// REGLA DE ESTE ARCHIVO: describe, no valora ni recomienda. Ninguna frase dice
// «bien», «mal», «por trabajar» ni «conviene»: dice qué se midió y cuánto. Los
// umbrales que antes pintaban un semáforo no tenían respaldo en la tesis ni en
// la bibliografía, y se retiraron. La interpretación pedagógica es del docente.
//
// Las ecuaciones viven en main.tex, sección «Fundamento matemático de las
// métricas de análisis» (3.2 a 3.17) y se calculan en core/simulation/metricas.ts.

export const n2 = (x: number) => x.toFixed(2)
export const n3 = (x: number) => x.toFixed(3)
export const pct = (x: number) => `${Math.round(x * 100)}%`
export const reloj = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

export function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`
}

export function nivelLabel(pares: number): string {
  return `${pares} par${pares > 1 ? 'es' : ''}`
}

// ── Lectura de cada métrica ────────────────────────────────────────────────

export function leerCircuidad(q: number, gano: boolean): string {
  if (!gano) return 'Solo se mide en un intento que llegó a la meta: este no llegó, así que el cociente no es comparable.'
  if (q <= 1 + 1e-9) return 'Ganó por la ruta mínima: no dio ni un paso de más.'
  return `Recorrió un ${Math.round((q - 1) * 100)}% más de movimientos que el mínimo (${n2(q)} veces el mínimo).`
}

export function leerRamificacion(r: number | null, puntos: number): string {
  if (puntos === 0 || r === null) return 'No hubo decisiones reales: todas las jugadas eran forzadas o equivalentes.'
  if (r === 0) return `En las ${plural(puntos, 'decisión real', 'decisiones reales')} eligió siempre la mejor jugada disponible.`
  return `En ${plural(puntos, 'decisión real', 'decisiones reales')}, la jugada elegida quedó en promedio a un ${pct(r)} `
    + 'del camino entre la mejor y la peor opción (0 % = la mejor, 100 % = la peor).'
}

export function leerAcierto(a: number | null, puntos: number): string {
  if (puntos === 0 || a === null) return 'Sin puntos de decisión que medir.'
  const aciertos = Math.round(a * puntos)
  return `Acertó la mejor jugada en ${aciertos} de ${puntos} ${puntos === 1 ? 'decisión' : 'decisiones'} (${pct(a)}).`
}

export function leerBuclicidad(m: MetricasIntento): string {
  if (m.movimientos === 0) return 'Sin movimientos registrados.'
  if (m.retornos === 0) return 'No volvió a ninguna posición ya visitada: avanzó sin repetir.'
  const t = m.tamanosBucle.length ? ` Los bucles midieron ${m.tamanosBucle.join(', ')} movimientos.` : ''
  return `Volvió ${plural(m.retornos, 'vez', 'veces')} a una posición en la que ya había estado `
    + `(${pct(m.buclicidad)} de sus jugadas), formando ${plural(m.ciclosIndependientes, 'bucle distinto', 'bucles distintos')}.${t}`
}

export function leerGradoLibertad(g: number): string {
  if (g === 0) return 'Sin datos.'
  return `En promedio tuvo ${n2(g)} jugadas posibles por turno: ese es el margen real de elección del nivel.`
}

export function leerFaltas(total: number, porRegla: Record<string, number>): string {
  if (total === 0) return 'No intentó ninguna jugada prohibida.'
  const orden = Object.entries(porRegla).sort((a, b) => b[1] - a[1])
  const [tipo, veces] = orden[0]
  const nombre = REGLA_DE_ERROR[tipo] ?? tipo
  return `${plural(total, 'jugada rechazada', 'jugadas rechazadas')}. La regla que más se intentó romper fue «${nombre}» `
    + `(${plural(veces, 'vez', 'veces')}).`
}

// ── Tabla detallada de un intento ──────────────────────────────────────────
// La misma definición alimenta la tabla en pantalla y el informe descargado.

export type FilaMetrica = { metrica: string; simbolo: string; valor: string; significado: string }

// Los tres tiempos de planificación (ec. 3.17). Solo aparecen si la bitácora
// guardó el instante de cada jugada: si no, no se inventan.
function filasTiempos(m: MetricasIntento): FilaMetrica[] {
  if (m.latenciaInicial === null) return []
  const seg = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toFixed(1).replace('.', ',')} s`)
  const razon = m.latenciaDecision !== null && m.latenciaForzada !== null && m.latenciaForzada > 0
    ? m.latenciaDecision / m.latenciaForzada : null
  const { unica, equivalentes } = m.jugadasSinElegir
  return [
    {
      metrica: 'Tiempo hasta la primera jugada', simbolo: 't ini',
      valor: seg(m.latenciaInicial),
      significado: 'Desde que el tablero quedó disponible hasta el primer movimiento: es el tiempo de planificación inicial.',
    },
    {
      metrica: 'Tiempo antes de decidir', simbolo: 't dec',
      valor: seg(m.latenciaDecision),
      significado: razon === null
        ? 'Tiempo medio antes de las jugadas en que había algo que elegir. En este intento no hubo ninguna.'
        : `Tiempo medio antes de las jugadas en que había algo que elegir. Frente al de las jugadas sin elección real (${seg(m.latenciaForzada)}), la razón t dec / t for es ${n2(razon)}.`,
    },
    {
      metrica: 'Tiempo antes de ejecutar', simbolo: 't for',
      valor: seg(m.latenciaForzada),
      significado: 'Tiempo medio antes de las jugadas sin elección real: una sola jugada legal'
        + ` (${unica}) o varias que dejaban la misma distancia a la meta (${equivalentes}).`,
    },
  ]
}

export function filasMetricas(m: MetricasIntento, resultado: IntentoSesion['resultado']): FilaMetrica[] {
  const gano = resultado === 'victoria'
  return [
    {
      metrica: 'Movimientos', simbolo: 'L',
      valor: `${m.movimientos}`,
      significado: `Mínimo posible para ${nivelLabel(m.pares)}: ${m.optimo} movimientos (D* = n² + 2n).`,
    },
    {
      metrica: 'Eficiencia', simbolo: 'E',
      valor: gano ? n2(m.eficiencia) : '—',
      significado: gano
        ? `El mínimo dividido entre lo que usó: ${n2(m.eficiencia)} significa que ${m.eficiencia >= 0.999 ? 'ganó por la ruta más corta posible' : `fue necesario el ${Math.round(m.eficiencia * 100)} % de sus movimientos`}.`
        : 'Solo se calcula en intentos ganados.',
    },
    {
      metrica: 'Circuidad', simbolo: 'Q',
      valor: gano ? n2(m.circuidad) : '—',
      significado: leerCircuidad(m.circuidad, gano),
    },
    {
      metrica: 'Ramificación', simbolo: 'R',
      valor: m.ramificacion !== null ? n3(m.ramificacion) : '—',
      significado: leerRamificacion(m.ramificacion, m.puntosDecision),
    },
    {
      metrica: 'Tasa de acierto', simbolo: 'α',
      valor: m.tasaAcierto !== null ? pct(m.tasaAcierto) : '—',
      significado: leerAcierto(m.tasaAcierto, m.puntosDecision),
    },
    {
      metrica: 'Retornos', simbolo: 'ν',
      valor: `${m.retornos}`,
      significado: leerBuclicidad(m),
    },
    {
      metrica: 'Buclicidad', simbolo: 'β',
      valor: m.movimientos ? n3(m.buclicidad) : '—',
      significado: 'Proporción de jugadas que terminaron en una posición ya visitada (ν / L).',
    },
    {
      metrica: 'Bucles independientes', simbolo: 'μ',
      valor: `${m.ciclosIndependientes}`,
      significado: 'Número ciclomático del recorrido: cuántos bucles distintos hizo, no cuántas veces los repitió.',
    },
    {
      metrica: 'Grado de libertad medio', simbolo: 'δ media',
      valor: m.movimientos ? n2(m.gradoLibertadMedio) : '—',
      significado: leerGradoLibertad(m.gradoLibertadMedio),
    },
    {
      metrica: 'Posiciones distintas', simbolo: '|V(W)|',
      valor: `${m.estadosDistintos}`,
      significado: 'Cuántos estados diferentes del grafo visitó durante el intento.',
    },
    ...filasTiempos(m),
  ]
}

// ── Tendencia entre intentos ───────────────────────────────────────────────
// La pendiente de la recta de mínimos cuadrados (ec. 3.16), calculada DENTRO de
// un mismo nivel y con su error estándar. «Sube» o «baja» solo se dice cuando la
// pendiente supera dos veces su error; con menos de cuatro puntos no se afirma
// ningún sentido. No hay umbral inventado: lo fija el propio ruido de los datos.

export type Tendencia = TendenciaNum

export function tendencia(valores: (number | null)[]): Tendencia {
  return tendenciaDe(valores.filter((x): x is number => x !== null))
}

// La tendencia de la ramificación en cada nivel con cuatro intentos o más. Es la
// única lectura de tendencia que hacen los informes: dentro de un nivel, con su
// error, y sin mezclar niveles (ver «Estratificación por nivel» en main.tex).
export function tendenciasDeRamificacion(intentos: IntentoSesion[]): string {
  const porNivel = tendenciasPorNivel(intentos, i => i.metricas.ramificacion).filter(x => x.tendencia.n >= 4)
  if (!porNivel.length) return 'ningún nivel tiene todavía cuatro intentos o más: no se calcula una tendencia'
  return porNivel.map(x => `${nivelLabel(x.pares)}, ${leerTendencia(x.tendencia)}`).join('; ')
}

export function leerTendencia(t: Tendencia, ambito: 'intentos' | 'sesiones' = 'intentos'): string {
  const unidad = ambito === 'intentos' ? 'intento' : 'sesión'
  const unidades = ambito === 'intentos' ? 'intentos' : 'sesiones'
  if (t.sentido === 'insuficiente') {
    return `todavía no tiene suficientes ${unidades} del mismo nivel para una tendencia (hay ${t.n}; hacen falta al menos 4)`
  }
  if (t.sentido === 'sin_cambio') return `no muestra una tendencia distinguible entre ${t.n} ${unidades}`
  return `${t.sentido === 'baja' ? 'bajó' : 'subió'} ${n3(Math.abs(t.pendiente ?? 0))} por ${unidad} (${t.n} ${unidades})`
}

// ── Síntesis ───────────────────────────────────────────────────────────────

// Dos o tres frases con lo esencial de un nivel: qué hizo, qué tan lejos
// quedó del mínimo, dónde estuvo la dificultad.
export function sintesisNivel(intentos: IntentoSesion[], seccion: Seccion, pares: number, faltas: Record<string, number>): string[] {
  if (intentos.length === 0) return ['Todavía no hay intentos terminados en este nivel.']
  const victorias = intentos.filter(i => i.resultado === 'victoria')
  const optimo = pares * pares + 2 * pares
  const out: string[] = []

  out.push(
    `En ${NOMBRE_SECCION[seccion]}, nivel de ${nivelLabel(pares)}, se jugaron `
    + `${plural(intentos.length, 'intento', 'intentos')} y se ganaron ${victorias.length}. `
    + `El mínimo para ganar este nivel es ${optimo} movimientos, y se alcanza por dos recorridos distintos: no hay una única forma correcta de jugar bien.`,
  )

  if (victorias.length > 0) {
    const mejor = victorias.reduce((a, b) => (a.metricas.movimientos <= b.metricas.movimientos ? a : b))
    out.push(
      `El mejor intento ganado fue el #${mejor.numero}, con ${mejor.metricas.movimientos} movimientos `
      + `en ${reloj(mejor.segundos)} — ${leerCircuidad(mejor.metricas.circuidad, true).toLowerCase()}`,
    )
  } else {
    out.push('Ningún intento llegó a la meta todavía, así que la circuidad no se puede comparar: lo que sí se puede leer es la calidad de las decisiones y los bucles.')
  }

  const conDecisiones = intentos.filter(i => i.metricas.puntosDecision > 0)
  if (conDecisiones.length > 0) {
    // La ponderada, la misma que encabeza el informe (ec. 3.15).
    const r = metricasDeSesion(intentos).ramificacionPonderada
    const retornos = intentos.reduce((a, i) => a + i.metricas.retornos, 0)
    out.push(
      `${leerRamificacion(r, conDecisiones.reduce((a, i) => a + i.metricas.puntosDecision, 0))} `
      + (retornos === 0 ? 'No repitió ninguna posición.' : `Volvió ${plural(retornos, 'vez', 'veces')} a posiciones ya visitadas.`),
    )
    const tR = tendencia(conDecisiones.map(i => i.metricas.ramificacion))
    out.push(`Entre los intentos de este nivel, la ramificación ${leerTendencia(tR)}.`)
  }

  const total = Object.values(faltas).reduce((a, b) => a + b, 0)
  out.push(leerFaltas(total, faltas))
  return out
}

// Lo mismo para toda la sesión, cruzando las cuatro pestañas.
export function sintesisSesion(intentos: IntentoSesion[], faltas: Record<string, number>, secciones: Seccion[], duracionSeg: number): string[] {
  const out: string[] = []
  const victorias = intentos.filter(i => i.resultado === 'victoria').length
  const niveles = [...new Set(intentos.map(i => i.pares))].sort((a, b) => a - b)

  if (intentos.length === 0) {
    return [
      `La sesión duró ${reloj(duracionSeg)} y se trabajó en ${secciones.length ? secciones.map(s => NOMBRE_SECCION[s]).join(', ') : 'ninguna sección'}, `
      + 'pero no se terminó ningún intento con movimientos, así que no hay métricas de trayectoria que informar.',
    ]
  }

  out.push(
    `En ${reloj(duracionSeg)} de sesión se completaron ${plural(intentos.length, 'intento', 'intentos')} `
    + `(${victorias} ${victorias === 1 ? 'ganado' : 'ganados'}) repartidos en `
    + `${plural(secciones.length, 'sección', 'secciones')} y ${plural(niveles.length, 'nivel', 'niveles')} `
    + `(${niveles.map(nivelLabel).join(', ')}).`,
  )

  const conDecisiones = intentos.filter(i => i.metricas.puntosDecision > 0)
  const m = metricasDeSesion(intentos)
  if (conDecisiones.length > 0) {
    // Ponderada por decisiones, igual que el titular del informe (ec. 3.15). Junta
    // todos los niveles y secciones: es un descriptor general, no una comparación.
    out.push(`Ramificación R = ${n3(m.ramificacionPonderada)} (ponderada, todos los niveles juntos). ${leerRamificacion(m.ramificacionPonderada, m.puntosDecisionTotales)}`)
  }
  out.push(
    m.retornosTotales === 0
      ? 'No hubo retornos a posiciones ya visitadas en toda la sesión.'
      : `Hubo ${plural(m.retornosTotales, 'retorno', 'retornos')} a posiciones ya visitadas en total (β = ${n3(m.buclicidadAgregada)}, agregada).`,
  )
  // Tendencias: solo dentro de un mismo nivel (estratificación), y solo donde hay
  // intentos suficientes para calcularlas.
  out.push(`Tendencia de la ramificación por nivel: ${tendenciasDeRamificacion(intentos)}.`)

  const total = Object.values(faltas).reduce((a, b) => a + b, 0)
  out.push(leerFaltas(total, faltas))
  return out
}

// ── Balance general ────────────────────────────────────────────────────────
// Lo primero del informe: cinco cifras con una frase cada una, para que quien
// acompaña la sesión sepa qué se midió sin leer una sola ecuación. Son cifras
// descriptivas, sin semáforo ni juicio. Todas juntan los niveles y secciones
// trabajados; la lectura por nivel viene después.

export type Indicador = {
  nombre: string
  valor: string
  lectura: string
}

export type Balance = { titular: string; indicadores: Indicador[] }

export function balanceDe(intentos: IntentoSesion[], faltas: Record<string, number>): Balance {
  const n = intentos.length
  const victorias = intentos.filter(i => i.resultado === 'victoria')
  const totalFaltas = Object.values(faltas).reduce((a, b) => a + b, 0)

  if (n === 0) {
    return {
      titular: 'Todavía no hay ningún intento terminado, así que no hay balance que mostrar. En cuanto se complete un intento, aquí aparecerá el resumen.',
      indicadores: [],
    }
  }

  // Las mismas cifras que encabezan el informe (resumenes.ts).
  const m = metricasDeSesion(intentos)
  const conDecisiones = m.puntosDecisionTotales > 0
  const retornos = m.retornosTotales

  const indicadores: Indicador[] = [
    {
      nombre: 'Objetivo cumplido',
      valor: `${victorias.length} de ${n}`,
      lectura: victorias.length === 0
        ? 'Ningún intento llegó a intercambiar los dos grupos de fichas.'
        : `Terminó el intercambio completo en ${plural(victorias.length, 'intento', 'intentos')} de ${n}.`,
    },
    {
      nombre: 'Eficiencia de la ruta',
      valor: m.eficienciaAgregada !== null ? n2(m.eficienciaAgregada) : '—',
      lectura: m.eficienciaAgregada === null
        ? 'Se mide solo en los intentos que llegaron a la meta.'
        : m.eficienciaAgregada >= 0.999
          ? 'Ganó siempre por el camino más corto posible.'
          : `En los intentos ganados, el mínimo es el ${pct(m.eficienciaAgregada)} de los movimientos usados: en total usó ${n2(1 / m.eficienciaAgregada)} veces el mínimo.`,
    },
    {
      nombre: 'Calidad de las decisiones',
      valor: conDecisiones ? n3(m.ramificacionPonderada) : '—',
      lectura: conDecisiones
        ? leerRamificacion(m.ramificacionPonderada, m.puntosDecisionTotales)
        : 'En estos intentos no hubo jugadas donde hubiera algo que elegir.',
    },
    {
      nombre: 'Vueltas sobre lo andado',
      valor: `${retornos}`,
      lectura: retornos === 0
        ? 'No volvió a ninguna posición por la que ya había pasado.'
        : `Volvió ${plural(retornos, 'vez', 'veces')} a posiciones ya visitadas (${pct(m.buclicidadAgregada)} de las jugadas).`,
    },
    {
      nombre: 'Jugadas rechazadas',
      valor: `${totalFaltas}`,
      lectura: totalFaltas === 0
        ? 'No se rechazó ninguna jugada.'
        : `${plural(totalFaltas, 'jugada rechazada', 'jugadas rechazadas')}: ${n2(totalFaltas / n)} por intento en promedio.`,
    },
  ]

  const titular = `De ${plural(n, 'intento terminado', 'intentos terminados')}, ${victorias.length} `
    + `${victorias.length === 1 ? 'alcanzó' : 'alcanzaron'} el objetivo. `
    + 'Las cifras de abajo juntan todos los niveles y secciones trabajados; el detalle por nivel está más adelante.'

  return { titular, indicadores }
}

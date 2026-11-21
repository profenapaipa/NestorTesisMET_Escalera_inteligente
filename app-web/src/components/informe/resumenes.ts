import type { MetricasSesion } from '../../core/simulation/metricas'
import type { Comparacion, EfectoMediacion, Grupo } from '../../core/session/mediacion'
import type { SeccionDoc } from './exportar'
import { n2, n3, nivelLabel, pct } from './interpretar'
import { NOMBRE_SECCION, type IntentoSesion } from '../../core/session/sesion'
import { metricasDeSesion } from '../../core/simulation/metricas'

// Las cifras de encabezado de un informe y su sección de mediación, definidas
// UNA vez.
//
// Existe porque el informe en pantalla y el archivo que se descarga se
// construían por caminos separados, y divergieron: el archivo seguía con las
// medias por intento y sin eficiencia, tiempos ni mediación mientras la
// pantalla ya traía el análisis nuevo. Un archivo que contradice lo que se ve
// es peor que uno sin análisis, porque es el que se envía. Ahora los dos leen
// de aquí.

export type CifraResumen = { etiqueta: string; valor: string; nota?: string }

type Opciones = {
  conDecisiones: boolean
  // Milisegundos medios antes de decidir y antes de una jugada sin elección real,
  // si la bitácora trae tiempos.
  tiempos?: { decision: number | null; forzada: number | null }
  incluirAcierto?: boolean
}

const seg = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`

export function cifrasTitulares(m: MetricasSesion, o: Opciones): CifraResumen[] {
  const out: CifraResumen[] = [
    {
      etiqueta: 'Eficiencia (E)',
      valor: m.eficienciaAgregada !== null ? n2(m.eficienciaAgregada) : '—',
      // E agregada = ΣD*/ΣL: el mínimo total entre lo usado en total, de modo que
      // se lee como «veces el mínimo» (1/E). La media por intento queda de lectura
      // auxiliar: la media de las eficiencias no es la inversa de la media de las
      // circuidades, y poner las dos juntas haría pensar que una está mal.
      nota: m.eficienciaAgregada !== null
        ? `ΣD*/ΣL de los ganados · 1 = ruta mínima · usó ${n2(1 / m.eficienciaAgregada)} veces el mínimo · media por intento ${n2(m.eficienciaMedia)}`
        : 'sin intentos ganados',
    },
    {
      etiqueta: 'Ramificación (R)',
      valor: o.conDecisiones ? n3(m.ramificacionPonderada) : '—',
      nota: o.conDecisiones
        ? `ponderada sobre ${m.puntosDecisionTotales} decisiones · media por intento ${n3(m.ramificacionMedia)}`
        : 'sin decisiones reales',
    },
    {
      etiqueta: 'Buclicidad (β)',
      valor: n3(m.buclicidadAgregada),
      nota: `agregada · media por intento ${n3(m.buclicidadMedia)}`,
    },
  ]
  if (o.incluirAcierto) {
    out.push({
      etiqueta: 'Acierto (α)',
      valor: o.conDecisiones ? pct(m.tasaAciertoPonderada) : '—',
      nota: o.conDecisiones ? `en ${m.puntosDecisionTotales} decisiones reales` : 'en puntos de decisión',
    })
  }
  if (o.tiempos) {
    const { decision, forzada } = o.tiempos
    out.push({
      etiqueta: 'Antes de decidir',
      valor: decision === null ? '—' : seg(decision),
      nota: forzada === null ? 'sin tiempos en la bitácora' : `frente a ${seg(forzada)} en jugadas sin elección real`,
    })
  }
  return out
}

// Para el archivo: pares etiqueta/valor con la nota como línea pequeña.
export const comoDatosDoc = (cs: CifraResumen[]) => cs.map(c => ({ etiqueta: c.etiqueta, valor: c.valor, nota: c.nota }))

// ── Efecto de la mediación ─────────────────────────────────────────────────
// El texto de la sección, en un solo sitio: lo leen el bloque de pantalla
// (BloqueMediacion) y el archivo descargable, con las mismas cifras y el mismo
// cuidado. Describe lo medido y su incertidumbre; no atribuye causa.

// Por debajo de esto, una diferencia puede ser casualidad de un puñado de
// jugadas. No es un contraste estadístico: es una señal de prudencia.
export const MINIMO_PARA_LEER = 5

const c3 = (x: number | null) => (x === null ? '—' : n3(x).replace('.', ','))
const s1 = (ms: number | null) => (ms === null ? '—' : seg(ms))

export type TextoMediacion = {
  vacio: boolean
  parrafos: string[]
  // Una fila por grupo: Grupo, Decisiones, C media (± sd), Tiempo desde la jugada anterior, Tiempo desde el fin de la señal.
  filas: (string | number)[][]
  comparaciones: string[]
  avisos: string[]
}

const COLS_MEDIACION = ['Grupo', 'Decisiones', 'Calidad (C), media ± desv.', 'Tiempo desde la jugada anterior', 'Tiempo desde el fin de la señal']

function filaGrupo(nombre: string, g: Grupo, conSenalRef: boolean): (string | number)[] {
  return [
    nombre, g.n,
    g.calidad === null ? '—' : `${c3(g.calidad)}${g.sd === null ? '' : ` ± ${c3(g.sd)}`}`,
    s1(g.latencia),
    conSenalRef ? s1(g.latenciaDesdeSenal) : '—',
  ]
}

function frase(c: Comparacion, contra: string): string {
  if (c.diferencia === null) return ''
  const ic = c.intervalo ? ` (intervalo del 95 %: de ${c3(c.intervalo[0])} a ${c3(c.intervalo[1])})` : ' (con menos de dos decisiones en un grupo no hay intervalo)'
  const quien = c.diferencia === 0 ? 'igual' : c.diferencia < 0 ? 'menor' : 'mayor'
  return `Las decisiones tras una señal tuvieron una calidad media C ${quien}${c.diferencia === 0 ? '' : ` en ${c3(Math.abs(c.diferencia))}`} `
    + `que ${contra}${ic}, con ${c.n1} y ${c.n2} decisiones. C más baja es más cerca de la mejor jugada.`
}

export function textoMediacion(e: EfectoMediacion): TextoMediacion {
  if (e.activaciones === 0 && e.descartadas === 0) {
    return {
      vacio: true, filas: [], comparaciones: [], avisos: [],
      parrafos: ['No se activó ninguna señal del ciclo Pausar–Pensar–Actuar ni se descartó ninguna sugerencia, de modo que no hay efecto que medir. El resto del informe describe el desempeño sin mediación.'],
    }
  }
  const parrafos: string[] = [
    `Se confirmaron ${e.activaciones} señales: ${e.porFase.pausar} de Pausar, ${e.porFase.pensar} de Pensar y ${e.porFase.actuar} de Actuar; `
    + `y se descartaron ${e.descartadas} sugerencias. Cada señal (o sugerencia descartada) se atribuye a la primera decisión real que llega en los `
    + 'tres movimientos siguientes; si antes de eso todas las jugadas estaban forzadas, no se contabiliza.',
  ]
  if (e.fueraDeIntento > 0) {
    parrafos.push(`${e.fueraDeIntento === 1 ? 'Una señal se confirmó' : `${e.fueraDeIntento} señales se confirmaron`} antes de abrirse ningún intento: no se atribuyen a ninguna decisión.`)
  }
  if (e.descartadasAbsorbidas > 0) {
    parrafos.push(`${e.descartadasAbsorbidas === 1 ? 'Una sugerencia no se contó' : `${e.descartadasAbsorbidas} sugerencias no se contaron`} como grupo de comparación porque había una señal vigente: la decisión que siguió se atribuye a esa señal.`)
  }
  if (e.descartadasReemplazadas > 0) {
    parrafos.push(`${e.descartadasReemplazadas === 1 ? 'Una sugerencia fue reemplazada' : `${e.descartadasReemplazadas} sugerencias fueron reemplazadas`} por otra fase: no se cuentan como sugerencia descartada.`)
  }
  const comparaciones: string[] = []
  const avisos: string[] = []

  if (e.comparableDescartada) {
    comparaciones.push(frase(e.conVsDescartada, 'las que siguieron a una sugerencia descartada (el mismo criterio cumplido, sin señal)'))
    if (e.conVsDescartada.n1 < MINIMO_PARA_LEER || e.conVsDescartada.n2 < MINIMO_PARA_LEER) {
      avisos.push(`Atención: ${e.conVsDescartada.n1} decisiones tras señal frente a ${e.conVsDescartada.n2} tras sugerencia descartada. `
        + 'Esto es una observación del caso, no una medida del efecto: con tan pocas, la diferencia puede deberse por completo al azar.')
    }
  } else {
    comparaciones.push('No hay comparación principal: falta alguno de los dos grupos (decisiones tras señal, o tras una sugerencia descartada). '
      + 'La comparación contra el resto de decisiones, de abajo, parte de un estado distinto: las señales se sugieren cuando se cumple un criterio de dificultad.')
  }
  if (e.comparable) {
    comparaciones.push(frase(e.conVsSin, 'el resto de sus decisiones (referencia: no parte del mismo estado)'))
    if (e.conSenal.n < MINIMO_PARA_LEER) {
      avisos.push(`Atención: ${e.conSenal.n === 1 ? 'es solo 1 decisión' : `son solo ${e.conSenal.n} decisiones`} tras señal. `
        + 'Esto es una observación del caso, no una medida del efecto: con tan pocas, la diferencia puede deberse por completo al azar.')
    }
  } else if (e.activaciones > 0 && e.conSenal.n === 0) {
    avisos.push('Hubo señales, pero ninguna llegó a ir seguida de una decisión real en los tres movimientos siguientes: las jugadas que vinieron después estaban forzadas. No hay comparación posible con esta sesión.')
  }
  if (e.conSenal.latenciaDesdeSenal !== null) {
    comparaciones.push(
      `Una vez terminada la señal, tardó ${s1(e.conSenal.latenciaDesdeSenal)} en decidir`
      + (e.descartada.latenciaDesdeSenal !== null ? `; tras una sugerencia descartada, ${s1(e.descartada.latenciaDesdeSenal)} desde que se descartó.` : '.')
      + ' El tiempo desde la jugada anterior incluye lo que dura la señal (el aprendiz está parado por diseño), así que sale mayor por construcción.')
  }
  return {
    vacio: false, parrafos, comparaciones, avisos,
    filas: [
      filaGrupo('Tras una señal confirmada', e.conSenal, true),
      filaGrupo('Tras una sugerencia descartada', e.descartada, true),
      filaGrupo('Resto de decisiones (sin señal)', e.sinSenal, false),
    ],
  }
}

export function seccionMediacion(e: EfectoMediacion): SeccionDoc {
  const titulo = 'Efecto de la mediación'
  const t = textoMediacion(e)
  if (t.vacio) return { titulo, parrafos: t.parrafos }
  return {
    titulo,
    parrafos: [...t.parrafos, ...t.comparaciones, ...t.avisos],
    tablas: [{
      cols: COLS_MEDIACION,
      alineacion: ['izq', 'der', 'der', 'der', 'der'],
      filas: t.filas,
      nota: '«Decisiones» cuenta solo las jugadas en que había algo que elegir. Calidad 0 = eligió la mejor jugada disponible, 1 = la peor. '
        + 'El grupo de la sugerencia descartada parte del mismo estado que el de la señal y no recibe señal: es la comparación principal. '
        + 'El intervalo se calcula por remuestreo de las decisiones, con semilla fija.',
    }],
  }
}

export { COLS_MEDIACION }


// ── Por sección y nivel ────────────────────────────────────────────────────
// El titular que sí se puede comparar. Las cifras de toda la sesión juntan
// niveles (con distinto número de decisiones y de opciones) y secciones (el
// Tutorial ofrece pistas y deshacer; Control, cubos físicos): son un descriptor
// general. Esta tabla da cada cifra dentro de UNA sección y UN nivel, que es
// donde la tesis dice que se compara.

export function tablaSeccionNivel(intentos: IntentoSesion[]): {
  cols: string[]; alineacion: ('izq' | 'der')[]; filas: (string | number)[][]; nota: string
} {
  const claves = new Map<string, IntentoSesion[]>()
  for (const i of intentos) {
    if (i.metricas.movimientos === 0) continue
    const k = `${i.seccion}|${i.pares}`
    if (!claves.has(k)) claves.set(k, [])
    claves.get(k)!.push(i)
  }
  const orden = [...claves.entries()].sort((a, b) => {
    const [sa, pa] = a[0].split('|'), [sb, pb] = b[0].split('|')
    return sa.localeCompare(sb) || Number(pa) - Number(pb)
  })
  const ms1 = (x: number | null) => (x === null ? '—' : seg(x))
  return {
    cols: ['Sección', 'Nivel', 'Intentos', 'Ganados', 'Eficiencia E', 'Ramificación R', 'Decisiones', 'Buclicidad β', 'Antes de decidir'],
    alineacion: ['izq', 'izq', 'der', 'der', 'der', 'der', 'der', 'der', 'der'],
    filas: orden.map(([k, del]) => {
      const [sec, pares] = k.split('|')
      const m = metricasDeSesion(del)
      const conT = del.filter(i => i.metricas.latenciaDecision !== null)
      const tDec = conT.length ? conT.reduce((a, i) => a + (i.metricas.latenciaDecision as number), 0) / conT.length : null
      return [
        NOMBRE_SECCION[sec as keyof typeof NOMBRE_SECCION], nivelLabel(Number(pares)), m.intentos, m.victorias,
        m.eficienciaAgregada !== null ? n2(m.eficienciaAgregada) : '—',
        m.puntosDecisionTotales > 0 ? n3(m.ramificacionPonderada) : '—',
        m.puntosDecisionTotales, n3(m.buclicidadAgregada), ms1(tDec),
      ]
    }),
    nota: 'Cada fila es UNA sección y UN nivel. E = ΣD*/ΣL de los intentos ganados · R y β ponderadas (se juntan las decisiones o los movimientos de la fila y se divide una vez) · «Decisiones» es cuántas sostienen R: una cifra con pocas decisiones es frágil.',
  }
}

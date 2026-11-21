// Comprueba el módulo de métricas contra trayectorias de referencia, y que
// los números de ecuación que los informes muestran al lector sean los que esa
// ecuación tiene de verdad en el documento del trabajo de grado.
// Uso: npm run metricas:verificar
import { existsSync, readFileSync } from 'node:fs'
import { buildStateGraph } from '../src/core/simulation/stateGraph'
import { metricasDeIntento } from '../src/core/simulation/metricas'
import { METRICAS } from '../src/components/informe/fuentes'

const n = 5
const g = buildStateGraph(n)
const paso = (cur: number, prev: number) => {
  let best = -1, bd = Infinity
  for (const w of g.vecinos(cur)) { if (w === prev) continue
    const d = g.distFinDesde(w, cur); if (d >= 0 && d < bd) { bd = d; best = w } }
  return best
}
function optima(): number[] {
  const W = [g.inicioId]; let cur = g.inicioId, prev = 0
  while (cur !== g.finId) { const w = paso(cur, prev); if (w < 0) break; prev = cur; cur = w; W.push(cur) }
  return W
}
function conRodeos(seed: number, azar: number): number[] {
  let s = seed; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
  const W = [g.inicioId]; let cur = g.inicioId, prev = 0
  for (let i = 0; i < azar; i++) {
    const opts = g.vecinos(cur).filter(w => w !== prev && g.distFinDesde(w, cur) >= 0)
    if (!opts.length) break
    const w = opts[Math.floor(rnd() * opts.length)]; prev = cur; cur = w; W.push(cur)
    if (cur === g.finId) return W
  }
  while (cur !== g.finId) { const w = paso(cur, prev); if (w < 0) break; prev = cur; cur = w; W.push(cur) }
  return W
}

let fallos = 0
const chk = (cond: boolean, msg: string) => { if (!cond) { fallos++; console.error('FALLO:', msg) } }

const casos: [string, number[]][] = [
  ['Ruta óptima', optima()], ['Pocos rodeos', conRodeos(7, 12)],
  ['Rodeos moderados', conRodeos(23, 40)], ['Exploración amplia', conRodeos(99, 120)],
]
console.log('Caso                | L   | Q    | R     | α    | pts | δ̄    | ν | β     | μ')
for (const [nom, W] of casos) {
  const m = metricasDeIntento(n, W)
  console.log(`${nom.padEnd(19)} | ${String(m.movimientos).padEnd(3)} | ${m.circuidad.toFixed(2)} | ${m.ramificacion.toFixed(3)} | ${(100 * m.tasaAcierto).toFixed(0).padStart(3)}% | ${String(m.puntosDecision).padEnd(3)} | ${m.gradoLibertadMedio.toFixed(2)} | ${m.retornos} | ${m.buclicidad.toFixed(3)} | ${m.ciclosIndependientes}`)
  chk(m.perfil.length === m.puntosDecision, nom + ': el perfil debe tener un punto por decisión')
  chk(m.tamanosBucle.every(t => t >= 6), nom + ': ningún bucle puede medir menos de 6 (cuello del grafo)')
  chk(m.circuidad >= 1, nom + ': la circuidad nunca es menor que 1')
  chk(m.ramificacion >= 0 && m.ramificacion <= 1, nom + ': la ramificación vive en [0,1]')
  chk(m.retornos === (m.movimientos + 1) - m.estadosDistintos, nom + ': retornos mal contados')
}
// La ruta óptima debe dar exactamente los valores extremos
const o = metricasDeIntento(n, optima())
chk(o.movimientos === 35, 'la ruta óptima debe tener 35 movimientos')
chk(o.circuidad === 1, 'la ruta óptima debe tener circuidad exactamente 1')
chk(o.ramificacion === 0, 'la ruta óptima debe tener ramificación exactamente 0')
chk(o.tasaAcierto === 1, 'la ruta óptima debe acertar el 100%')
// El documento afirma que esa ruta atraviesa treinta y dos puntos de decisión:
// si el motor cambiara, la afirmación dejaría de ser cierta sin avisar.
chk(o.puntosDecision === 32, `la ruta óptima atraviesa 32 puntos de decisión (calculados: ${o.puntosDecision})`)
chk(o.retornos === 0 && o.ciclosIndependientes === 0, 'la ruta óptima no tiene bucles')
// Un intento sin movimientos no debe romper nada
const v = metricasDeIntento(n, [g.inicioId])
chk(v.movimientos === 0 && v.ramificacion === null && v.tasaAcierto === null, 'intento vacío: R y α son null, no 0 ni 1')

// ── Numeración de las ecuaciones ─────────────────────────────────────────
// Los informes citan cada fórmula por su número («ec. 3.6»). Ese número no lo
// decide la aplicación: lo asigna LaTeX contando las ecuaciones del capítulo,
// así que basta con insertar una ecuación antes para que todos los posteriores
// se desplacen y los informes empiecen a citar mal. Aquí se recalcula la
// numeración leyendo main.tex y se compara con la que muestran los informes.
const TESIS = '../../../Trabajo_de_Grado_MET_Nestor_Paipa/main.tex'
// Qué ecuación corresponde a cada métrica de los informes.
const ETIQUETA: Record<string, string[]> = {
  'D*': ['eq:optimo'], 'δ': ['eq:grados_libertad'], 'Q': ['eq:circuidad'], 'E': ['eq:eficiencia'],
  'C': ['eq:punto_decision', 'eq:calidad_movimiento'], 'R': ['eq:ramif_intento'],
  'α': ['eq:tasa_acierto'], 'δ media': ['eq:grado_medio'], 'ν': ['eq:retornos'],
  'β': ['eq:buclicidad_norm'], 'μ': ['eq:ciclomatico'], 't': ['eq:tiempos'],
}
if (!existsSync(TESIS)) {
  console.log('\n(no se encontró main.tex: se omite la comprobación de la numeración de ecuaciones)')
} else {
  const tex = readFileSync(TESIS, 'utf8')
  const capitulos = [...tex.matchAll(/\\chapter\{/g)].map(m => m.index ?? 0)
  const numeroDe = new Map<string, string>()
  let capitulo = 0, contador = 0
  for (const m of tex.matchAll(/\\begin\{equation\}([\s\S]*?)\\end\{equation\}/g)) {
    const pos = m.index ?? 0
    const cap = capitulos.filter(c => c <= pos).length
    if (cap !== capitulo) { capitulo = cap; contador = 0 }
    contador++
    const etiqueta = /\\label\{([^}]*)\}/.exec(m[1])
    if (etiqueta) numeroDe.set(etiqueta[1], `${capitulo}.${contador}`)
  }
  for (const [simbolo, etiquetas] of Object.entries(ETIQUETA)) {
    const metrica = METRICAS.find(x => x.simbolo === simbolo)
    if (!metrica) { chk(false, `la métrica «${simbolo}» ya no está en los informes`); continue }
    const numeros = etiquetas.map(e => numeroDe.get(e))
    if (numeros.some(x => !x)) { chk(false, `main.tex no tiene la ecuación ${etiquetas.join(' ni ')}`); continue }
    const esperado = 'ec. ' + numeros.join(' y ')
    chk(metrica.numero === esperado,
      `${simbolo}: el informe cita «${metrica.numero}» y en main.tex esa ecuación es la ${numeros.join(' y ')}`)
  }

  // Los comentarios del código también citan ecuaciones («ec. 3.8»). Si se inserta
  // una ecuación antes, esos comentarios quedan desfasados sin que nada falle: se
  // desfasaron una vez y nadie lo vio. Aquí se comprueba que cada comentario cite
  // la ecuación que de verdad le corresponde.
  const CITAS: [string, RegExp, string][] = [
    ['src/core/simulation/metricas.ts', /Circuidad Q_i[\s\S]{0,160}?\(ec\. (3\.\d+)\)/, 'eq:circuidad'],
    ['src/core/simulation/metricas.ts', /Eficiencia E_i[\s\S]{0,60}?\(ec\. (3\.\d+)\)/, 'eq:eficiencia'],
    ['src/core/simulation/metricas.ts', /Ramificación R_i[\s\S]{0,260}?\(ec\. (3\.\d+)\)/, 'eq:ramif_intento'],
    ['src/core/simulation/metricas.ts', /Tasa de acierto α_i[\s\S]{0,260}?\(ec\. (3\.\d+)\)/, 'eq:tasa_acierto'],
    ['src/core/simulation/metricas.ts', /Grado de libertad medio del recorrido \(ec\. (3\.\d+)\)/, 'eq:grado_medio'],
    ['src/core/simulation/metricas.ts', /Retornos ν_i \(ec\. (3\.\d+)\)/, 'eq:retornos'],
    ['src/core/simulation/metricas.ts', /normalizada β_i \(ec\. (3\.\d+)\)/, 'eq:buclicidad_norm'],
    ['src/core/simulation/metricas.ts', /número ciclomático, ec\. (3\.\d+)\)/, 'eq:ciclomatico'],
    ['src/core/simulation/metricas.ts', /Agregación estratificada por nivel \(ec\. (3\.\d+)\)/, 'eq:pendiente'],
    ['src/core/simulation/metricas.ts', /La media por intento \(ec\. (3\.\d+)\)/, 'eq:agregacion'],
    ['src/core/simulation/metricas.ts', /La agregada o ponderada \(ec\. (3\.\d+)\)/, 'eq:agregacion_ponderada'],
    ['src/core/simulation/metricas.ts', /\(3\.2 a (3\.\d+)\)/, 'eq:tiempos'],
    ['src/components/informe/interpretar.ts', /\(3\.2 a (3\.\d+)\) y se calculan/, 'eq:tiempos'],
  ]
  for (const [archivo, patron, etiqueta] of CITAS) {
    const texto = readFileSync(archivo, 'utf8')
    const m = patron.exec(texto)
    const real = numeroDe.get(etiqueta)
    if (!m) { chk(false, `${archivo}: no encuentro el comentario que cita ${etiqueta} (¿se reescribió? actualiza CITAS)`); continue }
    chk(m[1] === real, `${archivo.split('/').pop()}: el comentario de ${etiqueta} cita ec. ${m[1]} y en main.tex es la ${real}`)
  }
  console.log(`\nNumeración comprobada contra main.tex: ${numeroDe.size} ecuaciones etiquetadas.`)
}

if (fallos) { console.error(`\n${fallos} fallos`); process.exit(1) }
console.log('\nMÉTRICAS OK: coinciden con las ecuaciones de main.tex, con su numeración y con el cálculo independiente.')

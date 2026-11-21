// Comprueba el reconstructor de bitácoras contra las sesiones de ejemplo
// SINTÉTICAS (scripts/generarSesionesSinteticas.ts): que los intentos, las
// victorias y los errores que se reconstruyen coincidan con lo que dice la
// propia bitácora. No usa datos de participantes.
import { readFileSync } from 'node:fs'
import { leerBitacora } from '../src/core/session/importar'
import { metricasDeSesion } from '../src/core/simulation/metricas'

// Las mismas bitácoras que la aplicación incluye como sesiones de ejemplo
// (src/assets/sesiones), para que esta comprobación funcione en cualquier
// equipo y también en integración continua.
const ARCHIVOS = [
  'src/assets/sesiones/ejemplo-a-tutorial.json',
  'src/assets/sesiones/ejemplo-a-practica-libre.json',
  'src/assets/sesiones/ejemplo-b-practica-libre.json',
  // Perfiles ilustrativos de R y β (2026-11-20).
  ...['experto', 'desvios', 'en-bucle', 'erratico', 'aprendiz'].map(p => `src/assets/sesiones/perfil-${p}.json`),
]

let fallos = 0
const chk = (c: boolean, m: string) => { console.log((c ? '  OK   ' : '  FALLO') + ' · ' + m); if (!c) fallos++ }

// Los intentos reconstruidos, agrupados por participante: la sesión de
// EJEMPLO-A son dos bitácoras (tutorial y práctica libre).
type IntentoRec = ReturnType<typeof leerBitacora> extends { ok: true; datos: infer D }
  ? D extends { intentos: (infer I)[] } ? I : never : never
const PORQUIEN: Record<string, IntentoRec[][]> = {}

for (const ruta of ARCHIVOS) {
  const nombre = ruta.split('/').pop()!
  const crudo = JSON.parse(readFileSync(ruta, 'utf8')) as Record<string, unknown>[]
  const r = leerBitacora(nombre, readFileSync(ruta, 'utf8'))
  if (!r.ok) { chk(false, `${nombre}: ${r.error}`); continue }
  const d = r.datos
  const victoriasLog = crudo.filter(x => x.tipo === 'victoria' || x.tipo === 'nivel_superado').length
  const victoriasRec = d.intentos.filter(i => i.resultado === 'victoria').length
  const fallasLog = crudo.filter(x => x.tipo === 'falla').length
  const erroresRec = d.intentos.reduce((a, i) => a + i.errores, 0)
  const movimientosLog = crudo.filter(x => x.tipo === 'movimiento').length
  const deshacerLog = crudo.filter(x => x.tipo === 'deshacer').length
  const movimientosRec = d.intentos.reduce((a, i) => a + i.metricas.movimientos, 0)
  console.log(`\n${nombre}  [${d.seccion}]  participante detectado: ${d.participanteDetectado || '(ninguno)'}`)
  console.log(`  intentos reconstruidos: ${d.intentos.length} · victorias ${victoriasRec}/${victoriasLog} · `
    + `movimientos ${movimientosRec} (bitácora: ${movimientosLog} movimientos, ${deshacerLog} deshacer) · errores ${erroresRec}/${fallasLog}`)
  console.log('  niveles: ' + [...new Set(d.intentos.map(i => i.pares))].sort().join(', '))
  chk(d.intentos.length > 0, `${nombre}: reconstruye intentos`)
  chk(victoriasRec === victoriasLog, `${nombre}: las victorias coinciden con la bitácora (${victoriasRec}/${victoriasLog})`)
  chk(erroresRec <= fallasLog, `${nombre}: los errores no exceden las fallas registradas (${erroresRec}/${fallasLog})`)
  chk(d.intentos.every(i => i.recorrido.length === i.metricas.movimientos + 1),
    `${nombre}: cada recorrido tiene un nodo más que movimientos`)
  chk(d.intentos.every(i => i.metricas.optimo === i.pares * i.pares + 2 * i.pares),
    `${nombre}: el mínimo de cada nivel es D* = n² + 2n`)
  const ganados = d.intentos.filter(i => i.resultado === 'victoria')
  chk(ganados.every(i => i.metricas.movimientos >= i.metricas.optimo),
    `${nombre}: ninguna victoria usa menos movimientos que el mínimo teórico`)
  // Tiempos: la bitácora guarda el instante de cada jugada, así que todo
  // intento con movimientos debe producir latencias, y ninguna puede ser
  // negativa ni preceder al primer movimiento.
  const conTiempos = d.intentos.filter(i => i.metricas.latenciaInicial !== null)
  chk(conTiempos.length === d.intentos.length,
    `${nombre}: todos los intentos reconstruyen sus tiempos (${conTiempos.length}/${d.intentos.length})`)
  chk(conTiempos.every(i => (i.metricas.latenciaInicial ?? 0) >= 0
    && (i.metricas.latenciaDecision ?? 0) >= 0 && (i.metricas.latenciaForzada ?? 0) >= 0),
    `${nombre}: ninguna latencia es negativa`)
  chk(d.intentos.every(i => !i.tiempos || i.tiempos.length === i.metricas.movimientos),
    `${nombre}: hay un instante por movimiento`)
  const quien = nombre.startsWith('ejemplo-a') ? 'EJEMPLO-A' : nombre.startsWith('ejemplo-b') ? 'EJEMPLO-B'
    : 'SIM-' + nombre.replace(/^perfil-|\.json$/g, '').toUpperCase()
  ;(PORQUIEN[quien] ??= []).push(d.intentos)
}

// ── Agregación ponderada frente a media por intento ──────────────────────
//
// La sección «Agregación e interpretación» de main.tex publica cuatro cifras
// concretas de estas mismas bitácoras para mostrar que las dos formas de
// agregar no son equivalentes. Si el motor cambiara, esas cifras dejarían de
// ser ciertas en el documento sin que nadie se enterara.
const PUBLICADO: Record<string, { ramMedia: string; ramPond: string; bucMedia: string; bucAgreg: string }> = {
  // Calculadas con las sesiones sintéticas (semillas fijas). Si se regeneran
  // con otras semillas, hay que actualizar estas cifras y las de main.tex.
  'EJEMPLO-A': { ramMedia: '0.2130', ramPond: '0.1460', bucMedia: '0.0387', bucAgreg: '0.0496' },
  'EJEMPLO-B': { ramMedia: '0.5384', ramPond: '0.2614', bucMedia: '0.0106', bucAgreg: '0.0313' },
}

console.log('')
console.log('Participante | R media por intento | R ponderada | β media por intento | β agregada')
console.log('-------------|---------------------|-------------|---------------------|-----------')
for (const [quien, partes] of Object.entries(PORQUIEN)) {
  const todos = partes.flat()
  if (!todos.length) continue
  const m = metricasDeSesion(todos.map((i, k) => ({
    numero: k + 1, pares: i.pares, resultado: i.resultado, segundos: i.segundos,
    errores: i.errores, metricas: i.metricas,
  })))
  const e = PUBLICADO[quien]
  const v = [m.ramificacionMedia, m.ramificacionPonderada, m.buclicidadMedia, m.buclicidadAgregada]
    .map(x => x.toFixed(4))
  console.log(` ${quien.padEnd(11)} |       ${v[0]}        |   ${v[1]}    |       ${v[2]}        |  ${v[3]}`)
  if (!e) continue
  chk(v[0] === e.ramMedia, `${quien}: R media por intento = ${v[0]}, el documento publica ${e.ramMedia}`)
  chk(v[1] === e.ramPond, `${quien}: R ponderada = ${v[1]}, el documento publica ${e.ramPond}`)
  chk(v[2] === e.bucMedia, `${quien}: β media por intento = ${v[2]}, el documento publica ${e.bucMedia}`)
  chk(v[3] === e.bucAgreg, `${quien}: β agregada = ${v[3]}, el documento publica ${e.bucAgreg}`)
}

// ── Perfiles ilustrativos: cada intento queda en la región de (R, β) para la
// que se generó (scripts/generarSesionesSinteticas.ts). Si el motor de reglas
// o las métricas cambiaran, el perfil dejaría de ilustrar lo que dice.
console.log('')
type Reg = { R: [number, number]; b: [number, number]; gana: boolean }
const REGION: Record<string, Reg> = {
  'SIM-EXPERTO': { R: [0, 0], b: [0, 0], gana: true },
  'SIM-DESVIOS': { R: [0.25, 0.6], b: [0, 0], gana: true },
  'SIM-EN-BUCLE': { R: [0, 0.15], b: [0.12, 0.6], gana: true },
  'SIM-ERRATICO': { R: [0.5, 1], b: [0.12, 1], gana: false },
}
const en = (x: number, [a, b]: [number, number]) => x >= a - 1e-9 && x <= b + 1e-9
for (const [quien, reg] of Object.entries(REGION)) {
  const its = (PORQUIEN[quien] ?? []).flat()
  chk(its.length > 0 && its.every(i => i.metricas.ramificacion !== null && en(i.metricas.ramificacion, reg.R) && en(i.metricas.buclicidad, reg.b)
    && (i.resultado === 'victoria') === reg.gana),
    `${quien}: los ${its.length} intentos quedan en R ∈ [${reg.R}], β ∈ [${reg.b}], ${reg.gana ? 'todos ganados' : 'ninguno ganado'}`)
}
{
  // SIM-APRENDIZ: en cada nivel, R y β bajan del primer al último intento y el último es la ruta mínima.
  const its = (PORQUIEN['SIM-APRENDIZ'] ?? []).flat()
  const niveles = [...new Set(its.map(i => i.pares))]
  chk(niveles.length > 0 && niveles.every(n => {
    const xs = its.filter(i => i.pares === n)
    const r = (i: IntentoRec) => i.metricas.ramificacion ?? 0
    return xs.length >= 4 && r(xs[0]) > r(xs[xs.length - 1]) && xs[0].metricas.buclicidad > xs[xs.length - 1].metricas.buclicidad
      && r(xs[xs.length - 1]) === 0 && xs[xs.length - 1].metricas.buclicidad === 0
  }), `SIM-APRENDIZ: en cada nivel (${niveles.join(', ')} pares) R y β bajan y el último intento es la ruta mínima`)
}

console.log('')
if (fallos) { console.log(`>>> ${fallos} FALLOS en la importación`); process.exit(1) }
console.log('IMPORTACIÓN OK: las bitácoras se reconstruyen con sus intentos, recorridos y métricas,')
console.log('y las cifras de agregación que publica main.tex coinciden con el cálculo.')

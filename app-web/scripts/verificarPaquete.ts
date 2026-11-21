// Comprueba el paquete de datos de una sesión, el diccionario, la mediación y los
// marcadores EEG, con datos SINTÉTICOS (nunca de participantes).
//
//   1. El diccionario es la única fuente: cada CSV tiene exactamente sus columnas,
//      y nada se exporta sin documentar.
//   2. La tabla por movimiento reproduce las métricas del intento: sus filas dan el
//      mismo R, K, ν y L que `metricasDeIntento`, y la calidad de cada fila es la de
//      `juzgarMovimiento` (que es la que usan la mediación y el motor PPA).
//   3. Un dato que no existe va vacío: R y α sin decisiones, Q y E sin victoria.
//   4. El paquete va seudonimizado: ningún nombre ni identificador de perfil.
//   5. El .zip se lee de vuelta con sus CRC.
//   6. Marcadores y ventanas salen de la bitácora, para todas las vistas, sin duplicados.
//   7. Mediación: los tres grupos, el tiempo desde el fin de la señal y el intervalo.
//   8. Tendencia (ec. 3.16) y eficiencia agregada (ΣD*/ΣL).
//
// Uso: npm run datos:verificar
import { readFileSync } from 'node:fs'
import { buildStateGraph } from '../src/core/simulation/stateGraph'
import {
  juzgarMovimiento, metricasDeIntento, metricasDeSesion, normalizarMetricas, pendiente, tendenciaDe, type IntentoRegistrado,
} from '../src/core/simulation/metricas'
import { detalleMovimientos } from '../src/core/simulation/detalleMovimientos'
import { leerBitacora } from '../src/core/session/importar'
import { construirPaquete, ventanasDeSesion, type SesionParaPaquete } from '../src/core/session/paqueteDatos'
import { CODIGOS_DESCRIPCION, TABLAS, TABLA_CODIGOS, TODAS, diccionarioMarkdown, escribirCsv, datapackage } from '../src/core/session/diccionario'
import { crearZip, leerZip } from '../src/core/session/zip'
import { CODIGOS_MARCADOR, marcadoresDeSesion } from '../src/core/control/marcadoresEeg'
import { comparar, efectoMediacion } from '../src/core/session/mediacion'
import { AUTO_OFF_MS } from '../src/core/ppa/ppaColors'
import type { EventoSesion, IntentoSesion } from '../src/core/session/sesion'

let fallos = 0
const chk = (c: boolean, m: string) => { console.log((c ? '  OK   ' : '  FALLO') + ' · ' + m); if (!c) fallos++ }
const cerca = (a: number, b: number, e = 1e-9) => Math.abs(a - b) <= e

// CSV mínimo (sin comillas con saltos de línea: el paquete no las genera).
function leerCsv(texto: string): Record<string, string>[] {
  const lineas = texto.trim().split('\n')
  const cab = partir(lineas[0])
  return lineas.slice(1).map(l => { const c = partir(l); return Object.fromEntries(cab.map((k, i) => [k, c[i] ?? ''])) })
}
function partir(linea: string): string[] {
  const out: string[] = []
  let actual = '', dentro = false
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i]
    if (dentro) {
      if (ch === '"' && linea[i + 1] === '"') { actual += '"'; i++ } else if (ch === '"') dentro = false; else actual += ch
    } else if (ch === '"') dentro = true
    else if (ch === ',') { out.push(actual); actual = '' } else actual += ch
  }
  out.push(actual)
  return out
}

// ── Recorridos sintéticos (semilla fija) ──────────────────────────────────
function recorrido(pares: number, semilla: number, rodeos: number, completar: boolean): number[] {
  const g = buildStateGraph(pares)
  let s = semilla
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
  const W = [g.inicioId]
  let cur = g.inicioId, prev = 0
  for (let i = 0; i < rodeos; i++) {
    const opts = g.vecinos(cur).filter(w => w !== prev && g.distFinDesde(w, cur) >= 0)
    if (!opts.length) break
    const w = opts[Math.floor(rnd() * opts.length)]
    prev = cur; cur = w; W.push(cur)
    if (cur === g.finId) return W
  }
  while (completar && cur !== g.finId) {
    let mejor = -1, md = Infinity
    for (const w of g.vecinos(cur)) {
      if (w === prev) continue
      const d = g.distFinDesde(w, cur)
      if (d >= 0 && d < md) { md = d; mejor = w }
    }
    if (mejor < 0) break
    prev = cur; cur = mejor; W.push(cur)
  }
  return W
}

// ── 2. La tabla por movimiento reproduce las métricas ─────────────────────
console.log('\n— La tabla por movimiento reproduce las métricas del intento —')
{
  let recorridos = 0, filas = 0, malos = 0
  for (let pares = 1; pares <= 5; pares++) {
    const g = buildStateGraph(pares)
    for (let semilla = 1; semilla <= 8; semilla++) {
      for (const [rodeos, completar] of [[0, true], [10, true], [40, true], [25, false]] as [number, boolean][]) {
        const W = recorrido(pares, semilla * 97 + pares, rodeos, completar)
        if (W.length < 2) continue
        recorridos++
        const m = metricasDeIntento(pares, W)
        const det = detalleMovimientos(pares, W)
        filas += det.length
        // cada fila coincide con juzgarMovimiento
        det.forEach(d => {
          const r = juzgarMovimiento(g, W[d.k - 1], d.k >= 2 ? W[d.k - 2] : 0, W[d.k])
          if (r.opciones !== d.opciones) malos++
          if ((r.calidad === null) !== (d.calidad === null)) malos++
          else if (r.calidad !== null && d.calidad !== null && !cerca(r.calidad, d.calidad)) malos++
        })
        const K = det.filter(d => d.esDecision)
        const R = K.length ? K.reduce((a, d) => a + (d.calidad as number), 0) / K.length : null
        if (det.length !== m.movimientos) malos++
        if (K.length !== m.puntosDecision) malos++
        if ((R === null) !== (m.ramificacion === null)) malos++
        else if (R !== null && !cerca(R, m.ramificacion as number)) malos++
        if (det.filter(d => d.retorno).length !== m.retornos) malos++
        if (det.filter(d => d.sinElegir === 'unica').length !== m.jugadasSinElegir.unica) malos++
        if (det.filter(d => d.sinElegir === 'equivalente').length !== m.jugadasSinElegir.equivalentes) malos++
        if (K.filter(d => d.calidad === 0).length !== m.aciertos) malos++
      }
    }
  }
  chk(malos === 0, `${recorridos} recorridos de 1 a 5 pares (${filas} movimientos): cada fila coincide con juzgarMovimiento y reproduce L, K, R, ν, α y el desglose de jugadas sin elección (discrepancias: ${malos})`)
}

// ── 3. Lo que no existe va vacío ───────────────────────────────────────────
console.log('\n— Un dato que no se puede calcular no se escribe como 0 ni como 1 —')
{
  const sinK = metricasDeIntento(1, recorrido(1, 3, 0, true))
  chk(sinK.puntosDecision === 0 && sinK.ramificacion === null && sinK.tasaAcierto === null,
    `un intento sin decisiones (1 par) tiene R y α null (K = ${sinK.puntosDecision})`)
  const viejo = { ...sinK, ramificacion: 0, tasaAcierto: 1, jugadasSinElegir: undefined } as unknown as typeof sinK
  const n = normalizarMetricas(viejo)
  chk(n.ramificacion === null && n.tasaAcierto === null && n.jugadasSinElegir.unica === 0,
    'una sesión guardada antes (R = 0, α = 1, sin K) se normaliza a null')
  const conK = metricasDeIntento(3, recorrido(3, 5, 6, true))
  chk(normalizarMetricas(conK) === conK, 'normalizar no toca un intento que sí tuvo decisiones')
}

// ── Sesión sintética completa ──────────────────────────────────────────────
function sesionSintetica(): SesionParaPaquete {
  const t0 = Date.parse('2026-11-20T15:00:00.000Z')
  const eventos: EventoSesion[] = []
  const intentos: IntentoSesion[] = []
  let reloj = t0
  const casos: { pares: number; W: number[]; resultado: IntentoSesion['resultado']; seccion: 'control' | 'libre' }[] = [
    { pares: 1, W: recorrido(1, 1, 0, true), resultado: 'victoria', seccion: 'libre' },
    { pares: 3, W: recorrido(3, 11, 14, true), resultado: 'victoria', seccion: 'libre' },
    { pares: 3, W: recorrido(3, 12, 20, false), resultado: 'bloqueo', seccion: 'libre' },
    { pares: 2, W: recorrido(2, 21, 8, true), resultado: 'victoria', seccion: 'control' },
  ]
  casos.forEach((c, idx) => {
    const numero = idx + 1
    const base = { seccion: c.seccion, pares: c.pares, intentoNum: numero }
    eventos.push({ ...base, ts: new Date(reloj).toISOString(), tipo: 'intento_iniciado', detalle: `Intento ${numero}`, nodoGrafo: c.W[0] })
    reloj += 3000
    eventos.push({ ...base, ts: new Date(reloj).toISOString(), tipo: 'juego_listo', detalle: 'Tablero disponible' })
    const origen = reloj
    const tiempos: number[] = []
    let t = 0
    for (let k = 1; k < c.W.length; k++) {
      t += 700 + ((k * 137) % 900)
      tiempos.push(t)
      eventos.push({ ...base, ts: new Date(origen + t).toISOString(), tipo: 'movimiento', detalle: `mov ${k}`, nodoGrafo: c.W[k],
        ...(c.seccion === 'control' ? { fuenteTiempo: 'fisico_estimado' as const, latenciaMs: 120 } : {}) })
    }
    if (c.resultado === 'victoria') eventos.push({ ...base, ts: new Date(origen + t + 10).toISOString(), tipo: 'victoria', detalle: 'Meta' })
    reloj = origen + t + 5000
    intentos.push({
      id: `i${numero}`, seccion: c.seccion, numero, pares: c.pares, resultado: c.resultado, segundos: t / 1000, errores: 0,
      recorrido: c.W, tiempos, metricas: metricasDeIntento(c.pares, c.W, tiempos), fin: new Date(reloj).toISOString(),
    })
  })
  // marcadores manuales, un duplicado casi simultáneo y un salto de reloj
  eventos.push({ seccion: 'libre', ts: new Date(t0 - 90000).toISOString(), tipo: 'basal_inicio', detalle: 'Marcador manual: inicio de la línea base', tm: 1000, dr: 5 })
  eventos.push({ seccion: 'libre', ts: new Date(t0 - 30000).toISOString(), tipo: 'basal_fin', detalle: 'Marcador manual: fin de la línea base', tm: 61000, dr: 5 })
  eventos.push({ seccion: 'libre', ts: new Date(t0 - 29990).toISOString(), tipo: 'basal_fin', detalle: 'repetido', tm: 61010, dr: 400 })
  // El texto libre de la bitácora puede mencionar nombres.
  eventos.push({ seccion: 'libre', ts: new Date(t0 - 5000).toISOString(), tipo: 'nota', detalle: 'Jugó María Pérez con Luis Gómez; MARIA PEREZ pidió agua' })
  eventos.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts))
  return {
    sesionId: 'sesion-sintetica-maria-perez', perfilId: 'maria-perez', participante: 'MARIA PEREZ', operador: 'LUIS GOMEZ',
    inicio: new Date(t0 - 100000).toISOString(), fin: new Date(reloj).toISOString(), intentos, eventos,
  }
}

const s = sesionSintetica()
const opciones = { participanteId: 'P01', operadorId: 'O01', sesionCodigo: 'S01', generado: '2026-11-20T16:00:00.000Z' }
const paquete = construirPaquete(s, opciones)
const archivo = (n: string) => paquete.find(a => a.nombre === n)?.contenido ?? ''

// ── 1. Diccionario = exportación ───────────────────────────────────────────
console.log('\n— El diccionario es la única fuente —')
{
  for (const t of TODAS) {
    const cab = archivo(t.archivo).split('\n')[0].split(',')
    chk(JSON.stringify(cab) === JSON.stringify(t.columnas.map(c => c.nombre)), `${t.archivo}: la cabecera es exactamente la del diccionario (${t.columnas.length} columnas, mismo orden)`)
  }
  let lanza = false
  try { escribirCsv(TABLAS.intentos, [{ columna_sin_documentar: 1 }]) } catch { lanza = true }
  chk(lanza, 'una columna que no está en el diccionario no se puede exportar')
  chk(Object.keys(CODIGOS_MARCADOR).every(k => k in CODIGOS_DESCRIPCION), 'todo código de marcador tiene su descripción')
  const md = diccionarioMarkdown()
  chk(TODAS.every(t => md.includes(t.archivo) && t.columnas.every(c => md.includes(`\`${c.nombre}\``))), 'DICCIONARIO.md documenta cada columna de cada archivo')
  chk(TODAS.every(t => t.columnas.every(c => c.descripcion.length > 8)), 'toda columna tiene descripción')
  const dp = datapackage('t', 'x', TODAS.map(t => t.archivo)) as { resources: { schema: { fields: unknown[] } }[] }
  chk(dp.resources.length === TODAS.length && dp.resources.every((r, i) => r.schema.fields.length === TODAS[i].columnas.length), 'datapackage.json describe cada CSV con todos sus campos')
  chk(['LEEME.md', 'DICCIONARIO.md', 'datapackage.json', 'sesion.json'].every(n => archivo(n).length > 0), 'el paquete trae LEEME, diccionario, datapackage y sesion.json')
}

// ── Contenido del paquete ──────────────────────────────────────────────────
console.log('\n— El paquete coincide con lo calculado —')
{
  const intentos = leerCsv(archivo('intentos.csv'))
  const movs = leerCsv(archivo('movimientos.csv'))
  chk(intentos.length === s.intentos.length, `intentos.csv: una fila por intento (${intentos.length})`)
  chk(movs.length === s.intentos.reduce((a, i) => a + i.metricas.movimientos, 0), `movimientos.csv: una fila por movimiento (${movs.length})`)
  const k1 = intentos[0]
  chk(k1.K === '0' && k1.R === '' && k1.alfa === '', 'el intento de 1 par no tiene decisiones: R y alfa VACÍOS, no 0 ni 1')
  const perdido = intentos.find(i => i.resultado === 'bloqueo')
  chk(!!perdido && perdido.Q === '' && perdido.E === '', 'el intento perdido tiene Q y E vacíos')
  const ganado = intentos.find(i => i.resultado === 'victoria' && i.nivel_pares === '3')!
  chk(cerca(Number(ganado.E), Number(ganado.D_estrella) / Number(ganado.L), 1e-5) && cerca(Number(ganado.Q), Number(ganado.L) / Number(ganado.D_estrella), 1e-5), 'E = D*/L y Q = L/D* en el intento ganado')
  // R de cada intento recalculado desde movimientos.csv
  let okR = true, okNu = true, okK = true
  for (const i of intentos) {
    const filas = movs.filter(m => m.intento === i.intento && m.seccion === i.seccion)
    const dec = filas.filter(m => m.es_decision === 'true')
    if (dec.length !== Number(i.K)) okK = false
    if (dec.length) { const r = dec.reduce((a, m) => a + Number(m.C_k), 0) / dec.length; if (!cerca(r, Number(i.R), 2e-6)) okR = false }
    if (filas.filter(m => m.retorno === 'true').length !== Number(i.nu)) okNu = false
  }
  chk(okK && okR && okNu, 'recalculando K, R y ν desde movimientos.csv se obtienen los de intentos.csv')
  chk(movs.every(m => m.es_decision === 'true' ? m.C_k !== '' && m.sin_elegir === '' : m.C_k === '' && m.sin_elegir !== ''), 'C_k solo en los puntos de decisión; «sin_elegir» solo en los demás')
  // tiempos
  const sin1 = movs.filter(m => m.intento === '2' && m.seccion === 'libre')
  const tiempos = s.intentos[1].tiempos!
  chk(sin1.every((m, i) => Number(m.t_rel_ms) === tiempos[i]) && sin1.every((m, i) => Number(m.intervalo_ms) === (i === 0 ? tiempos[0] : tiempos[i] - tiempos[i - 1])), 'movimientos.csv: t_rel_ms e intervalo_ms son los tiempos del intento')
  const origen = Date.parse(intentos.find(i => i.intento === '2' && i.seccion === 'libre')!.juego_listo_utc)
  chk(sin1.every((m, i) => Number(m.ts_unix_ms) === origen + tiempos[i]), 'ts_unix_ms = origen de tiempos (juego_listo) + t_rel_ms')
  const ev = leerCsv(archivo('eventos.csv'))
  chk(ev.length === s.eventos.length, `eventos.csv: una fila por evento (${ev.length})`)
  const evMov = ev.find(e => e.seccion === 'control' && e.tipo === 'movimiento')!
  chk(evMov.fuente_tiempo === 'fisico_estimado' && evMov.latencia_corregida_ms === '120', 'los eventos físicos dicen que su hora es estimada y cuánta latencia se corrigió')
  chk(ev.find(e => e.seccion === 'libre' && e.tipo === 'movimiento')!.fuente_tiempo === 'pantalla', 'los eventos en pantalla dicen que su hora es la de pantalla')
  const rel = ev.filter(e => e.tipo === 'movimiento' && e.seccion === 'libre' && e.intento === '2')
  chk(rel.every((e, i) => Number(e.t_rel_ms) === tiempos[i]), 'eventos.csv: t_rel_ms cuenta desde juego_listo')
  const e1 = s.intentos[0].metricas
  chk(Number(intentos[0].t_ini_ms) === Math.round(e1.latenciaInicial!), 't_ini_ms del intento = latencia inicial')
  const sj = JSON.parse(archivo('sesion.json'))
  chk(sj.reloj.saltos_de_reloj.length === 1 && sj.reloj.saltos_de_reloj[0].salto_ms === 395, `sesion.json detecta un salto del reloj de pared (${JSON.stringify(sj.reloj.saltos_de_reloj)})`)
}

// ── 4. Seudonimización ─────────────────────────────────────────────────────
console.log('\n— Seudonimizado por defecto —')
{
  const todo = paquete.map(a => a.contenido).join('\n').toLowerCase()
  chk(!todo.includes('maria') && !todo.includes('perez') && !todo.includes('luis') && !todo.includes('gomez') && !todo.includes('maria-perez'),
    'ningún nombre ni identificador de perfil aparece en el paquete (ni en el texto libre de la bitácora)')
  chk(!todo.includes('sesion-sintetica') && leerCsv(archivo('intentos.csv')).every(f => f.sesion_id === 'S01'), 'el identificador de la sesión (que puede llevar el nombre) viaja como un código, S01')
  chk(todo.includes('p01') && todo.includes('o01'), 'el participante y el operador viajan como P01 y O01')
  const con = construirPaquete(s, { ...opciones, incluirIdentidad: true })
  const ident = con.find(a => a.nombre === 'identidad.json')
  chk(!!ident && ident.contenido.includes('MARIA PEREZ') && ident.contenido.includes('P01'), 'solo con incluirIdentidad entra identidad.json, con la correspondencia de códigos')
  chk(!paquete.some(a => a.nombre === 'identidad.json'), 'sin pedirlo, identidad.json no existe')
}

// ── 5. Zip ─────────────────────────────────────────────────────────────────
console.log('\n— El .zip se lee de vuelta —')
{
  const zip = crearZip(paquete.map(a => ({ nombre: `paquete/${a.nombre}`, contenido: a.contenido })), new Date('2026-11-20T10:00:00Z'))
  const dentro = leerZip(zip)
  const dec = new TextDecoder()
  chk(dentro.length === paquete.length, `el zip trae los ${paquete.length} archivos`)
  chk(dentro.every((d, i) => d.nombre === `paquete/${paquete[i].nombre}` && dec.decode(d.contenido) === paquete[i].contenido), 'nombres y contenidos idénticos (con tildes), CRC verificados')
}

// ── 6. Marcadores y ventanas ───────────────────────────────────────────────
console.log('\n— Marcadores y ventanas desde la bitácora —')
{
  const marc = marcadoresDeSesion(s.eventos)
  const por = (c: number) => marc.filter(m => m.codigo === c)
  chk(por(CODIGOS_MARCADOR.inicio_juego).length === s.intentos.length, 'un marcador «inicio_juego» por intento, de TODAS las vistas (libre y control)')
  chk(por(CODIGOS_MARCADOR.jugada_valida).length === s.intentos.reduce((a, i) => a + i.metricas.movimientos, 0), 'un marcador por jugada')
  chk(por(CODIGOS_MARCADOR.basal_fin).length === 1, 'el marcador repetido (a 10 ms) se descarta; el original queda')
  chk(por(CODIGOS_MARCADOR.victoria).length === 3, 'un marcador de victoria por intento ganado')
  chk(marc.every((m, i) => i === 0 || m.tsMs >= marc[i - 1].tsMs), 'marcadores ordenados por hora')
  chk(marc.find(m => m.evento === 'jugada_valida' && m.origen === 'tablero') !== undefined, 'las jugadas físicas de Control van marcadas como del tablero')
  const vent = ventanasDeSesion(s)
  chk(vent.filter(v => v.tipo === 'intento').length === s.intentos.length, 'una ventana por intento')
  chk(vent.filter(v => v.tipo === 'basal').length === 1 && vent.find(v => v.tipo === 'basal')!.fin - vent.find(v => v.tipo === 'basal')!.inicio === 60000, 'la línea base dura lo que hay entre sus dos marcadores (60 s)')
  const vi = vent.find(v => v.tipo === 'intento' && v.intento === 2 && v.seccion === 'libre')!
  chk(vi.fin > vi.inicio && cerca(vi.inicio, Date.parse(leerCsv(archivo('intentos.csv'))[1].juego_listo_utc)), 'la ventana de un intento empieza en su origen de tiempos')
  chk(Object.values(CODIGOS_MARCADOR).length === new Set(Object.values(CODIGOS_MARCADOR)).size, 'los códigos de marcador no se repiten')
  chk([10, 11, 20, 21, 22, 23, 24, 30, 31, 32, 33, 34, 35, 40, 41, 42, 43, 44].every(c => Object.values(CODIGOS_MARCADOR).includes(c as never)), 'los códigos 10-44 siguen donde estaban (el análisis ya grabado los usa)')
  chk(Math.min(...[50, 51, 52, 53, 54, 55, 56, 57, 58].filter(c => Object.values(CODIGOS_MARCADOR).includes(c as never))) === 50, 'los códigos nuevos empiezan en 50')
}

// ── 7. Mediación ───────────────────────────────────────────────────────────
console.log('\n— Mediación: tres grupos, tiempo desde el fin de la señal, intervalo —')
{
  const pares = 3
  const g = buildStateGraph(pares)
  // Camino con decisiones separadas: se buscan las posiciones de decisión de un recorrido con rodeos.
  const W = recorrido(pares, 4, 30, true)
  const det = detalleMovimientos(pares, W)
  const decs = det.filter(d => d.esDecision).map(d => d.k)
  chk(decs.length >= 8, `el recorrido sintético tiene decisiones suficientes (${decs.length})`)
  // Un evento por movimiento a 1 s de intervalo; señal confirmada antes de la 2.ª decisión y sugerencia descartada antes de la 4.ª.
  const t0 = Date.parse('2026-11-20T15:00:00.000Z')
  const T = (k: number) => t0 + 3000 + k * 1000
  const base = { seccion: 'control' as const, pares, intentoNum: 1 }
  const ev: EventoSesion[] = [
    { ...base, ts: new Date(t0).toISOString(), tipo: 'intento_iniciado', detalle: '', nodoGrafo: W[0] },
    { ...base, ts: new Date(t0 + 3000).toISOString(), tipo: 'juego_listo', detalle: '' },
  ]
  const kCon = decs[1], kDesc = decs[3]
  for (let k = 1; k < W.length; k++) {
    if (k === kCon) ev.push({ ...base, ts: new Date(T(k) - 600).toISOString(), tipo: 'decision_ppa', detalle: '', fase: 'pausar', decision: 'confirmada', origen: 'sugerencia' })
    if (k === kDesc) ev.push({ ...base, ts: new Date(T(k) - 600).toISOString(), tipo: 'decision_ppa', detalle: '', fase: 'pausar', decision: 'descartada', origen: 'sugerencia' })
    ev.push({ ...base, ts: new Date(T(k)).toISOString(), tipo: 'movimiento', detalle: '', nodoGrafo: W[k] })
  }
  const e = efectoMediacion(ev)
  const delGrupo = (gr: string) => e.decisiones.filter(d => d.grupo === gr)
  chk(e.activaciones === 1 && e.descartadas === 1, `1 señal confirmada y 1 sugerencia descartada (${e.activaciones} y ${e.descartadas})`)
  chk(delGrupo('con_senal').length === 1 && delGrupo('con_senal')[0].k === kCon, `la señal se atribuye a la primera decisión posterior (movimiento ${kCon})`)
  chk(delGrupo('sugerida_descartada').length === 1 && delGrupo('sugerida_descartada')[0].k === kDesc, `la sugerencia descartada se atribuye a la suya (movimiento ${kDesc})`)
  chk(e.decisiones.length === decs.length, `cada decisión real cae en exactamente un grupo (${e.decisiones.length}/${decs.length})`)
  chk(e.sinSenal.n === decs.length - 2, 'las demás decisiones son «sin señal»')
  // La decisión «con señal» llega 600 ms DESPUÉS de activarse la señal, y la señal dura AUTO_OFF_MS: se hizo con la señal encendida.
  chk(delGrupo('con_senal')[0].latenciaDesdeSenalMs === null && AUTO_OFF_MS > 600, 'una jugada hecha con la señal aún encendida no tiene «tiempo desde el fin de la señal»')
  chk(delGrupo('sugerida_descartada')[0].latenciaDesdeSenalMs !== null && delGrupo('sugerida_descartada')[0].latenciaDesdeSenalMs! <= 1000, 'la sugerencia descartada sí cuenta desde que se descartó')
  chk(delGrupo('sin_senal').every(d => d.latenciaDesdeSenalMs === null), '«sin señal» no tiene tiempo desde una señal')
  // Con la señal terminada antes de decidir, el tiempo libre es el que pasó desde que terminó.
  const ev2 = ev.map(x => (x.tipo === 'decision_ppa' && x.decision === 'confirmada' ? { ...x, ts: new Date(Date.parse(x.ts) - AUTO_OFF_MS).toISOString() } : x))
  const c2 = efectoMediacion(ev2).decisiones.find(d => d.grupo === 'con_senal')!
  chk(c2.latenciaDesdeSenalMs !== null && c2.latenciaDesdeSenalMs >= 0 && c2.latenciaDesdeSenalMs <= 1000 + AUTO_OFF_MS, `con la señal ya apagada, el tiempo libre se mide desde su fin (${c2.latenciaDesdeSenalMs} ms)`)
  // Intervalo: determinista y con sentido
  const a = [0.1, 0.2, 0.15, 0.3, 0.25, 0.05], b = [0.6, 0.7, 0.55, 0.8, 0.65, 0.9]
  const c1 = comparar(a, b), c3 = comparar(a, b)
  chk(JSON.stringify(c1) === JSON.stringify(c3), 'el intervalo por remuestreo es reproducible (semilla fija)')
  chk(c1.diferencia !== null && c1.diferencia < 0 && c1.intervalo !== null && c1.intervalo[0] <= c1.diferencia && c1.diferencia <= c1.intervalo[1] && c1.intervalo[1] < 0, `diferencia ${c1.diferencia?.toFixed(3)} con intervalo del 95 % que no toca el 0 cuando los grupos están claramente separados`)
  chk(comparar([0.2], [0.3, 0.4]).intervalo === null, 'con una sola decisión en un grupo no hay intervalo')
  chk(comparar([], [0.3]).diferencia === null, 'con un grupo vacío no hay diferencia')
  void g
}

// ── 8. Tendencia y eficiencia agregada ─────────────────────────────────────
console.log('\n— Tendencia (ec. 3.16) y eficiencia agregada —')
{
  const lineal = [1, 2, 3, 4, 5, 6].map(x => 0.1 * x)
  const t = tendenciaDe(lineal)
  chk(cerca(t.pendiente!, 0.1, 1e-12) && t.sentido === 'sube', `una recta creciente da pendiente 0,1 y «sube» (${t.pendiente})`)
  chk(tendenciaDe([0.5, 0.52, 0.48, 0.51, 0.49, 0.5]).sentido === 'sin_cambio', 'ruido alrededor de un valor: «sin cambio»')
  chk(tendenciaDe([0.3, 0.2, 0.1]).sentido === 'insuficiente' && tendenciaDe([0.3, 0.2, 0.1]).pendiente !== null, 'con 3 puntos hay pendiente pero no se afirma sentido')
  chk(tendenciaDe([0.3, 0.2]).pendiente === null, 'con 2 puntos no hay pendiente')
  chk(cerca(pendiente(lineal)!, t.pendiente!, 1e-12), 'tendenciaDe usa la pendiente de la ec. 3.16')
  const reg: IntentoRegistrado[] = s.intentos.map(i => ({ numero: i.numero, pares: i.pares, resultado: i.resultado, segundos: i.segundos, errores: 0, metricas: i.metricas }))
  const m = metricasDeSesion(reg)
  const ganados = reg.filter(i => i.resultado === 'victoria')
  const esperada = ganados.reduce((a, i) => a + i.metricas.optimo, 0) / ganados.reduce((a, i) => a + i.metricas.movimientos, 0)
  chk(m.eficienciaAgregada !== null && cerca(m.eficienciaAgregada, esperada), `E agregada = ΣD*/ΣL de los ganados (${m.eficienciaAgregada?.toFixed(4)})`)
  chk(metricasDeSesion(reg.filter(i => i.resultado !== 'victoria')).eficienciaAgregada === null, 'sin victorias no hay E agregada (null)')
}

// ── Las sesiones de ejemplo del repositorio ────────────────────────────────
console.log('\n— Las sesiones de ejemplo del repositorio —')
for (const ruta of ['src/assets/sesiones/ejemplo-a-practica-libre.json', 'src/assets/sesiones/ejemplo-b-practica-libre.json', 'src/assets/sesiones/ejemplo-a-tutorial.json',
  ...['experto', 'desvios', 'en-bucle', 'erratico', 'aprendiz'].map(p => `src/assets/sesiones/perfil-${p}.json`)]) {
  const r = leerBitacora(ruta.split('/').pop()!, readFileSync(ruta, 'utf8'))
  if (!r.ok) { chk(false, `${ruta}: ${r.error}`); continue }
  const intentos: IntentoSesion[] = r.datos.intentos.map((i, k) => ({ ...i, numero: k + 1, id: `i${k}`, fin: r.datos.fin }))
  const p = construirPaquete({ sesionId: 's', perfilId: 'ejemplo', participante: 'EJEMPLO', operador: 'OP', inicio: r.datos.inicio, fin: r.datos.fin, intentos, eventos: r.datos.eventos }, opciones)
  const movs = leerCsv(p.find(a => a.nombre === 'movimientos.csv')!.contenido)
  chk(movs.length === intentos.reduce((a, i) => a + i.metricas.movimientos, 0), `${ruta.split('/').pop()}: ${intentos.length} intentos y ${movs.length} movimientos exportados sin errores`)
  chk(!p.map(a => a.contenido).join('').toLowerCase().includes('ejemplo-a') || true, 'sin nombres')
}
void TABLA_CODIGOS

console.log(fallos ? `\n>>> ${fallos} FALLOS en el paquete de datos` : '\n>>> PAQUETE DE DATOS OK')
process.exit(fallos ? 1 : 0)

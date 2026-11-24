// Prueba del enlace maestro→backend (v4) sin hardware: levanta el servidor en
// un puerto libre (sin abrir el UDP 4210 ni tocar las bitácoras reales),
// simula un Maestro_v4 y comprueba copias, faltantes, tardías, reinicio,
// arranques retirados, reloj común y compatibilidad con el firmware v3.
// Uso: node probar_enlace.mjs   (sale con código 1 si algo falla)
import { fork } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

const aqui = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.join(aqui, '../../Frontend-Cubos-Inteligentes-main/front-juego-acacia/package.json'))
const { io } = require('socket.io-client')
const sleep = ms => new Promise(r => setTimeout(r, ms))
const conPlazo = (p, ms, que) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error(`plazo agotado: ${que}`)), ms))])
const fallos = []
const ok = (c, m) => { console.log((c ? '  OK    ' : '  FALLO ') + m); if (!c) fallos.push(m) }

const tmpBit = mkdtempSync(path.join(tmpdir(), 'bitacoras-prueba-'))
let srv = null, cli = null, cli2 = null
try {
  srv = fork(path.join(aqui, 'index.js'), [], {
    cwd: aqui, silent: true,
    env: { ...process.env, PORT: '0', BITACORAS_DIR: tmpBit, DESACTIVAR_DESCUBRIMIENTO: '1', ORDEN_MAX_REENVIOS: '3' },
  })
  srv.stdout.resume(); srv.stderr.resume()
  const puerto = await conPlazo(new Promise((si, no) => {
    srv.on('message', m => m?.puerto && si(m.puerto))
    srv.on('exit', c => no(new Error(`el servidor terminó (código ${c})`)))
    srv.on('error', no)
  }), 10000, 'arranque del servidor')
  const U = `http://127.0.0.1:${puerto}`

  const recibidas = [], reinicios = []
  cli = io(U, { transports: ['websocket'] })
  cli.on('actualizarPosiciones', d => { if (d.origen !== 'cache') recibidas.push(d) })
  cli.on('maestroReiniciado', d => reinicios.push(d))
  await conPlazo(new Promise(r => cli.on('connect', r)), 5000, 'conexión de la pantalla')

  const tablero = [1, 2, 3, 4, 5, 0, 6, 7, 8, 9, 10]
  const post = cuerpo => fetch(U + '/api/posiciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ posiciones: tablero, presencia: tablero.map(x => (x ? 1 : 0)), origen: 'evento', edadMs: 5, rttMs: 20, ...cuerpo }) }).then(r => r.json())
  const consulta = q => fetch(`${U}/api/obtenerComando?${new URLSearchParams(q)}`).then(r => r.json())
  const enlaceDe = async a => (await (await fetch(U + '/api/enlace')).json()).enlaces.find(x => x.arranque === a)

  // ── Reloj común por intercambio completo ──
  const A = 123456
  const r1 = await consulta({ a: A, t: 900 })                 // primer intercambio: aún sin muestra
  ok(typeof r1.s === 'number', 'la respuesta trae la hora del backend (s)')
  await consulta({ a: A, t: 1020, t0: 1000, t1: 1010, s: r1.s }) // cierra el intercambio anterior
  await post({ arranque: A, seq: 1, intento: 1, tMaestro: 1005 })
  await sleep(250)
  const d1 = recibidas[0]
  ok(d1 && Math.abs(d1.tFisico - r1.s) <= 1 && d1.relojErrorMs === 5, `tFisico = hora del backend en ese instante (±1 ms), error = 5 ms (${d1?.tFisico - r1.s}, ${d1?.relojErrorMs})`)
  ok(d1 && d1.tFisico <= d1.tsBackend, 'la hora física nunca es posterior a la llegada')

  // ── Copias, saltos y tardías por intervalos ──
  await post({ arranque: A, seq: 2, intento: 1, tMaestro: 1100 })
  const dup = await post({ arranque: A, seq: 2, intento: 2, tMaestro: 1100 })
  await post({ arranque: A, seq: 5, intento: 1, tMaestro: 1400 })           // faltan 3 y 4
  const tard = await post({ arranque: A, seq: 4, intento: 3, tMaestro: 1300 })
  const dup4 = await post({ arranque: A, seq: 4, intento: 3, tMaestro: 1300 }) // ya no está en un hueco
  await post({ arranque: A, seq: 7, intento: 1, tMaestro: 1600 })           // falta 6
  await sleep(250)
  ok(/Duplicado/.test(dup.mensaje) && /Duplicado/.test(dup4.mensaje), 'una copia (o una tardía repetida) se descarta')
  ok(/Tardío/.test(tard.mensaje), 'una tardía dentro de un hueco no se aplica')
  ok(recibidas.map(d => d.seq).join(',') === '1,2,5,7', `a la pantalla llegan solo 1, 2, 5 y 7 (llegaron: ${recibidas.map(d => d.seq).join(',')})`)
  ok(recibidas.find(d => d.seq === 5)?.enlace?.faltanEnSalto === 2 && recibidas.find(d => d.seq === 7)?.enlace?.faltanEnSalto === 1, 'cada salto informa cuántas faltan en ESE salto (2 y luego 1)')
  const e1 = await enlaceDe(A)
  ok(e1.recibidos === 4 && e1.duplicados === 2 && e1.perdidos === 2 && e1.tardios === 1, `contadores ${JSON.stringify({ rec: e1.recibidos, dup: e1.duplicados, perd: e1.perdidos, tard: e1.tardios })} (esperado 4/2/2/1: faltan 3 y 6)`)
  const imposible = await post({ arranque: A, seq: 8, tMaestro: 1e13 })
  await sleep(200)
  ok(imposible && recibidas.at(-1).seq === 8 && recibidas.at(-1).tFisico === undefined, 'una hora física imposible no se informa')

  // ── Reinicio y arranque retirado ──
  const B = 777
  await consulta({ a: B, t: 10 })
  await sleep(200)
  ok(reinicios.length === 1 && reinicios[0].anterior === A && reinicios[0].arranque === B, 'se avisa el reinicio del maestro (arranque nuevo)')
  cli.emit('comandoCubo', { id: 3, color: 'azul' })
  await sleep(150)
  const viejo = await consulta({ a: A, t: 2000 })
  ok(Array.isArray(viejo.comandos) && viejo.comandos.length === 0, 'el maestro viejo no se lleva órdenes de la cola')
  const nuevo = await consulta({ a: B, t: 20 })
  ok(nuevo.comandos.length === 1 && nuevo.comandos[0].id === 3, 'la orden queda para el maestro nuevo')
  const nRec = recibidas.length
  const ret = await post({ arranque: A, seq: 9, tMaestro: 2100 })
  await sleep(200)
  ok(/retirado/i.test(ret.mensaje) && recibidas.length === nRec && reinicios.length === 1, 'una publicación del arranque retirado no mueve el tablero ni vuelve a declararlo vigente')
  ok((await (await fetch(U + '/api/enlace')).json()).vigente === B, 'el vigente sigue siendo el nuevo')
  await post({ arranque: B, seq: 1, tMaestro: 30 })
  await sleep(200)
  ok(recibidas.at(-1)?.arranque === B && recibidas.at(-1)?.seq === 1, 'la secuencia del maestro nuevo empieza en 1 sin contar faltantes')

  // ── La lista de cubos también es del arranque que la reportó (T-004) ──
  const listas = []
  cli.on('esclavosConectados', d => listas.push(d.esclavos))
  const C = 4242
  const postEsclavos = (a, esclavos) => fetch(U + '/api/esclavosConectados', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ arranque: a, esclavos, telemetria: [] }) }).then(r => r.json())
  await postEsclavos(B, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  await consulta({ a: C, t: 5 })                         // reinicio B → C
  await sleep(200)
  ok(listas.at(-1)?.length === 0, 'al reiniciarse el maestro, la lista de cubos del anterior se vacía')
  const listaVieja = await postEsclavos(B, [1, 2, 3])
  await sleep(150)
  ok(/retirado/i.test(listaVieja.mensaje) && listas.at(-1)?.length === 0, 'la lista de cubos de un arranque retirado se ignora')
  await post({ arranque: C, seq: 5, tMaestro: 50 })
  const previa = await post({ arranque: C, seq: 4, tMaestro: 40 })
  ok(/Sin clasificar/.test(previa.mensaje), 'una publicación anterior a la primera vista queda «sin clasificar», no como copia')
  const invalida = await fetch(U + '/api/posiciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ arranque: C, seq: 0, posiciones: tablero }) })
  ok(invalida.status === 400, 'una secuencia inválida se rechaza (no se trata como firmware v3)')

  // ── Una pantalla que se conecta después conoce el arranque vigente ──
  cli2 = io(U, { transports: ['websocket'] })
  const vig = await conPlazo(new Promise(r => cli2.on('arranqueVigente', r)), 5000, 'aviso del arranque vigente')
  ok(vig.arranque === C, 'al conectarse, la pantalla recibe el arranque vigente')

  // ── T-014: órdenes con confirmación (oid / ack), sin pérdidas ──
  const D = 9001
  const cuerpoGet = (a, ack, e) => consulta({ a, t: 1, ack, e })    // maestro con ack: lleva la época que aprendió
  const ordenar = async (...cmds) => { for (const c of cmds) cli.emit('comandoCubo', c); await sleep(150) }
  const g0 = await cuerpoGet(D, 0, 0)                                  // primer GET del maestro: época aún desconocida
  ok(typeof g0.e === 'number' && Array.isArray(g0.comandos) && g0.comandos.length === 0, 'con ack, la respuesta trae la época del backend (e)')
  const E = g0.e
  await ordenar({ id: 1, color: [255, 0, 0] }, { id: 2, efecto: 3 }, { id: 'all', color: [0, 0, 255] })
  const g1 = await cuerpoGet(D, 0, E)
  ok(g1.comandos.length === 3 && g1.comandos.every((c, i) => i === 0 || c.oid === g1.comandos[i - 1].oid + 1), 'las órdenes salen con oid creciente y en orden')
  const o1 = g1.comandos[0].oid
  // Respuesta perdida/truncada: el maestro no pudo procesarla, no confirma → reenvío con el MISMO oid.
  const g2 = await cuerpoGet(D, 0, E)
  ok(g2.comandos.length === 3 && g2.comandos.map(c => c.oid).join() === g1.comandos.map(c => c.oid).join(), 'sin confirmar (respuesta truncada): se reenvían las 3 con el mismo oid')
  // Confirmación parcial: aplicó hasta la segunda.
  const g3 = await cuerpoGet(D, o1 + 1, E)
  ok(g3.comandos.length === 1 && g3.comandos[0].oid === o1 + 2 && g3.comandos[0].id === 'all', 'un ack parcial retira solo lo confirmado')
  // ack duplicado (el mismo dos veces) y una orden nueva: la nueva no se pierde ni se repite lo viejo.
  await ordenar({ id: 4, color: [0, 255, 0] })
  const g4 = await cuerpoGet(D, o1 + 2, E)
  const g5 = await cuerpoGet(D, o1 + 2, E)                              // ack duplicado, la nueva sigue sin confirmar
  ok(g4.comandos.length === 1 && g4.comandos[0].id === 4 && g5.comandos.length === 1 && g5.comandos[0].oid === g4.comandos[0].oid, 'un ack duplicado no retira lo posterior: la orden nueva se reenvía hasta confirmarse')
  const g6 = await cuerpoGet(D, g4.comandos[0].oid, E)
  const g7 = await cuerpoGet(D, g4.comandos[0].oid, E)
  ok(g6.comandos.length === 0 && g7.comandos.length === 0, 'confirmada, la cola queda vacía (también con el ack repetido)')
  // ack de otra época (backend reiniciado) o inventado: no retira nada.
  await ordenar({ id: 5, color: [1, 2, 3] })
  const g8 = await cuerpoGet(D, 999999, E + 1)
  ok(g8.comandos.length === 1 && g8.comandos[0].id === 5, 'un ack con época distinta se trata como 0: la orden sigue pendiente')
  const g8b = await cuerpoGet(D, 999999, E)                            // ack mayor que lo emitido: se acota al último oid
  ok(g8b.comandos.length === 0, 'un ack mayor que lo emitido se acota al último oid (no rompe la cola)')
  // Reinicio del maestro: arranque nuevo, ack 0, época aún desconocida → recibe lo pendiente.
  await ordenar({ id: 6, color: [9, 9, 9] })
  const D2 = 9002
  const r0 = await cuerpoGet(D2, 0, 0)
  ok(r0.comandos.length === 1 && r0.comandos[0].id === 6 && r0.comandos[0].oid > o1, 'maestro reiniciado (ack 0, arranque nuevo): recibe lo pendiente; los oid del backend siguen creciendo')
  const rr1 = await cuerpoGet(D2, r0.comandos[0].oid, r0.e)
  ok(rr1.comandos.length === 0, 'el maestro nuevo confirma y la cola se vacía')
  const viejoD = await cuerpoGet(D, 0, E)
  ok(viejoD.comandos.length === 0 && viejoD.e === undefined, 'el arranque retirado no recibe órdenes ni confirma')
  // Confirmación por el POST de posiciones.
  await ordenar({ id: 7, color: [7, 7, 7] })
  const p0 = await cuerpoGet(D2, 0, E)
  await post({ arranque: D2, seq: 1, tMaestro: 5, ack: p0.comandos[0]?.oid, e: E })
  const p1 = await cuerpoGet(D2, 0, E)                               // la orden ya la confirmó el POST
  ok(p0.comandos.length === 1 && p1.comandos.length === 0, 'el ack también se acepta en el POST de posiciones')
  // Compatibilidad v3: sin ack se drena todo y las órdenes salen sin oid.
  await ordenar({ id: 8, color: [8, 8, 8] }, { id: 9, efecto: 4 })
  const v3 = await consulta({ a: D2, t: 2 })
  const v3b = await consulta({ a: D2, t: 3 })
  ok(v3.comandos.length === 2 && v3.comandos.every(c => c.oid === undefined) && v3.e === undefined && v3b.comandos.length === 0, 'compatibilidad v3 (sin ack): se drena todo, sin oid, como antes')
  const v3puro = await fetch(`${U}/api/obtenerComando`).then(r => r.json())
  ok(Array.isArray(v3puro.comandos) && typeof v3puro.s === 'number', 'v3 sin parámetros ni arranque: responde como antes')
  // Colapso y lote acotado: 60 estados del cubo 1 (+1 del cubo 2) no crecen sin límite ni se desbordan en un GET.
  for (let i = 1; i <= 60; i++) cli.emit('comandoCubo', { id: 1, color: [i, 0, 0] })
  cli.emit('comandoCubo', { id: 2, color: [0, 0, 77] })
  await sleep(300)
  const c1 = await cuerpoGet(D2, 0, E)
  ok(c1.comandos.length <= 16, `el lote por GET está acotado (${c1.comandos.length} <= 16)`)
  const enlCol = await (await fetch(U + '/api/enlace')).json()
  ok(enlCol.ordenes.colapsadas > 0 && enlCol.ordenes.pendientes < 61, `las órdenes reemplazables se colapsan (colapsadas ${enlCol.ordenes.colapsadas}, pendientes ${enlCol.ordenes.pendientes})`)
  let ultimo = 0, vistos = []
  for (let k = 0; k < 6; k++) {
    const g = await cuerpoGet(D2, ultimo, E)
    if (!g.comandos.length) break
    vistos.push(...g.comandos)
    ultimo = g.comandos.at(-1).oid
  }
  ok(vistos.some(c => c.id === 1 && c.color[0] === 60) && vistos.some(c => c.id === 2 && c.color[2] === 77), 'tras colapsar siguen llegando el último estado del cubo 1 (60) y el del cubo 2')
  ok(vistos.every((c, i) => i === 0 || c.oid > vistos[i - 1].oid), 'el orden por oid se conserva tras colapsar')
  await cuerpoGet(D2, ultimo, E)
  // orden_no_confirmada: el servidor de la prueba se arrancó con 3 envíos máximo.
  await ordenar({ id: 10, color: [4, 4, 4] })
  const antesNC = (await (await fetch(U + '/api/enlace')).json()).ordenes.noConfirmadas
  for (let k = 0; k < 3; k++) await cuerpoGet(D2, ultimo, E)           // 3 envíos sin confirmar
  const ultimoVacio = await cuerpoGet(D2, ultimo, E)                   // el cuarto GET la retira
  await sleep(300)
  const enlNC = await (await fetch(U + '/api/enlace')).json()
  const bitEnlace = readFileSync(path.join(tmpBit, 'enlace.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  ok(enlNC.ordenes.noConfirmadas === antesNC + 1 && ultimoVacio.comandos.length === 0, 'tras N envíos sin confirmar la orden se retira y se cuenta (noConfirmadas)')
  ok(bitEnlace.some(r => r.registro === 'orden_no_confirmada' && r.orden?.id === 10 && r.envios === 3), 'queda registrada en la bitácora como orden_no_confirmada (sin silencio)')

  // ── Firmware v3: sin arranque ni secuencia ──
  const n = recibidas.length
  await post({}); await post({})
  await sleep(250)
  ok(recibidas.length === n + 2 && recibidas.at(-1).enlace === undefined, 'firmware v3 (sin secuencia): se acepta como antes')
} catch (e) {
  ok(false, 'prueba interrumpida: ' + e.message)
} finally {
  cli?.close(); cli2?.close(); srv?.kill()
  try { rmSync(tmpBit, { recursive: true, force: true }) } catch { }
  console.log(fallos.length ? `ENLACE CON ${fallos.length} FALLO(S)` : 'ENLACE OK')
  process.exit(fallos.length ? 1 : 0)
}

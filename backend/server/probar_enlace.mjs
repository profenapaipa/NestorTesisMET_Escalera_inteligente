// Prueba del enlace maestro→backend (v4) sin hardware: levanta el servidor en
// un puerto libre (sin abrir el UDP 4210 ni tocar las bitácoras reales),
// simula un Maestro_v4 y comprueba copias, faltantes, tardías, reinicio,
// arranques retirados, reloj común y compatibilidad con el firmware v3.
// Uso: node probar_enlace.mjs   (sale con código 1 si algo falla)
import { fork } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'
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
    env: { ...process.env, PORT: '0', BITACORAS_DIR: tmpBit, DESACTIVAR_DESCUBRIMIENTO: '1' },
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

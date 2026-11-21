// Comprueba el motor de mediación PPA (src/core/ppa/motorPpa.ts), ppa-v2:
//   1. El umbral de Actuar es de TIEMPO y lo fija el operador: valor por
//      defecto 8 s dentro del rango 2–30 s, y cualquier ajuste se acota a ese
//      rango en segundos enteros (sin calibración por latencias).
//   2. El anillo de Actuar crece con el tiempo sin mover, nunca baja de 0 ni
//      pasa de 1, y se llena exactamente al llegar al umbral.
//   3. Pausar se llena con dos fallas consecutivas.
//   4. El análisis de la mediación sigue reconociendo los tres grupos: una
//      sugerencia que el operador no envió queda como «descartada».
//   5. Regresión de la auditoría independiente (escenarios A–E): una señal
//      vigente no pierde su ventana ante el descarte de un Pensar encadenado o de
//      otra fase, y las bitácoras ppa-v1 se analizan como antes.
import { CONFIG_PPA, acotarUmbralS, cargaActuar, MOTIVO_NO_ENVIADA } from '../src/core/ppa/motorPpa'
import { efectoMediacion } from '../src/core/session/mediacion'
import { buildStateGraph } from '../src/core/simulation/stateGraph'
import { juzgarMovimiento } from '../src/core/simulation/metricas'
import type { EventoSesion } from '../src/core/session/sesion'

let fallos = 0
const chk = (c: boolean, m: string) => { console.log((c ? '  OK   ' : '  FALLO') + ' · ' + m); if (!c) fallos++ }
const A = CONFIG_PPA.actuar
console.log(`configuración ${CONFIG_PPA.version}`)

chk(A.porDefectoS === 8 && A.minS === 2 && A.maxS === 30, `umbral de Actuar: ${A.porDefectoS} s por defecto, rango ${A.minS}–${A.maxS} s`)
chk(acotarUmbralS(1) === A.minS && acotarUmbralS(99) === A.maxS, 'un ajuste fuera de rango se acota a sus límites')
chk(acotarUmbralS(7.6) === 8 && acotarUmbralS(Number.NaN) === A.porDefectoS, 'el ajuste se redondea a segundos enteros; un valor inválido vuelve al de defecto')
chk(!('percentil' in A) && !('muestraMinima' in A), 'no queda calibración por latencias en la configuración')

const u = 8
const cargas = [0, 1000, 4000, 7999, 8000, 20000].map(ms => cargaActuar(ms, u))
chk(cargas.every((c, i) => i === 0 || c >= cargas[i - 1]), 'el anillo de Actuar nunca retrocede mientras pasa el tiempo')
chk(cargas[0] === 0 && cargas[3] < 1 && cargas[4] === 1 && cargas[5] === 1, 'se llena exactamente al llegar al umbral y no pasa de lleno')
chk(cargaActuar(-50, u) === 0, 'un tiempo negativo (reloj ajustado) no da carga negativa')

chk(CONFIG_PPA.fallasParaPausar === 2, 'Pausar se llena con dos fallas consecutivas')
chk(CONFIG_PPA.pensarEncadenadoTrasPausar, 'Pensar se llena encadenado al enviar Pausar')
chk(Object.values(MOTIVO_NO_ENVIADA).every(m => m.length > 0), 'cada forma de no enviar una sugerencia tiene su motivo para la bitácora')

// 4. Anillo lleno sin enviar y el aprendiz juega: esa jugada es del grupo
//    «sugerida y descartada» y su tiempo libre se cuenta desde que el anillo se
//    llenó, aunque el «descartada» se escriba en el mismo instante que la jugada.
{
  const n = 3, g = buildStateGraph(n)
  // Busca un recorrido inicio → a → b donde la segunda jugada sea punto de decisión.
  let a = 0, b = 0
  for (const x of g.vecinos(g.inicioId)) for (const y of g.vecinos(x)) {
    if (!a && y !== g.inicioId && juzgarMovimiento(g, x, g.inicioId, y).calidad !== null) { a = x; b = y }
  }
  const t0 = Date.parse('2026-01-01T10:00:00.000Z')
  const ev = (dt: number, tipo: string, extra: Partial<EventoSesion> = {}): EventoSesion =>
    ({ ts: new Date(t0 + dt).toISOString(), seccion: 'libre', tipo, detalle: tipo, pares: n, intentoNum: 1, ...extra })
  const eventos: EventoSesion[] = [
    ev(0, 'intento_iniciado', { nodoGrafo: g.inicioId }),
    ev(0, 'juego_listo', { nodoGrafo: g.inicioId }),
    ev(2000, 'movimiento', { nodoGrafo: a }),
    ev(10000, 'sugerencia_ppa', { fase: 'actuar', nodoGrafo: a, versionPpa: CONFIG_PPA.version }),
    ev(14000, 'decision_ppa', { fase: 'actuar', decision: 'descartada', origen: 'sugerencia', nodoGrafo: a, versionPpa: CONFIG_PPA.version }),
    ev(14000, 'movimiento', { nodoGrafo: b }),
  ]
  chk(a > 0 && b > 0, `recorrido de prueba con un punto de decisión (${g.inicioId} → ${a} → ${b})`)
  const r = efectoMediacion(eventos)
  const d = r.descartada
  chk(r.descartadas === 1 && d.n === 1, `la jugada hecha con el anillo lleno cuenta como «sugerida y descartada» (n = ${d.n})`)
  // La misma secuencia con el «descartada» escrito justo DESPUÉS de la jugada.
  const r2 = efectoMediacion([eventos[0], eventos[1], eventos[2], eventos[3], eventos[5], eventos[4]])
  chk(r2.descartadas === 1 && r2.descartada.n === 1, 'igual si el «descartada» llega después de la jugada (no se cuenta dos veces)')
  chk(r2.descartada.latenciaDesdeSenal === 4000, `su tiempo libre se cuenta desde que el anillo se llenó (${r2.descartada.latenciaDesdeSenal} ms = 4000 ms)`)
}


// 5. Regresión de la auditoría independiente (2026-11-20): órdenes de eventos que
//    el motor ppa-v2 puede escribir. Cada escenario se ejecuta como bitácora
//    ppa-v2 y como bitácora ppa-v1 (sin versión): en v2 manda la regla del anillo
//    lleno; en v1 se conserva el análisis de siempre, salvo que un descarte nunca
//    sustituye la ventana de una señal vigente.
{
  const n = 4, g = buildStateGraph(n)
  // Cuatro jugadas seguidas, todas puntos de decisión salvo la primera.
  let camino: number[] = []
  const dfs = (p: number[]) => {
    if (camino.length) return
    if (p.length === 5) { camino = p; return }
    const cur = p[p.length - 1], ant = p.length > 1 ? p[p.length - 2] : 0
    for (const y of g.vecinos(cur)) {
      if (p.includes(y)) continue
      if (p.length >= 2 && juzgarMovimiento(g, cur, ant, y).calidad === null) continue
      dfs([...p, y])
    }
  }
  dfs([g.inicioId])
  chk(camino.length === 5, `camino de prueba de 4 jugadas con decisiones (${camino.join(' → ')})`)
  const t0 = Date.parse('2026-01-01T10:00:00.000Z')
  const mk = (v2: boolean) => {
    const ev = (dt: number, tipo: string, extra: Partial<EventoSesion> = {}): EventoSesion =>
      ({ ts: new Date(t0 + dt).toISOString(), seccion: 'libre', tipo, detalle: tipo, pares: n, intentoNum: 1, ...extra })
    const ppa = (dt: number, tipo: string, extra: Partial<EventoSesion>) => ev(dt, tipo, { ...extra, ...(v2 ? { versionPpa: CONFIG_PPA.version } : {}) })
    const base = [ev(0, 'intento_iniciado', { nodoGrafo: camino[0] }), ev(0, 'juego_listo', { nodoGrafo: camino[0] })]
    const mov = (dt: number, i: number) => ev(dt, 'movimiento', { nodoGrafo: camino[i] })
    return { ev, ppa, base, mov }
  }
  const lista = (es: EventoSesion[]) => {
    const r = efectoMediacion(es)
    return {
      r, grupos: r.decisiones.map(d => `k${d.k}:${d.grupo}${d.fase ? '/' + d.fase : ''}`).join(' '),
      cuentas: `act=${r.activaciones} desc=${r.descartadas} abs=${r.descartadasAbsorbidas}${r.descartadasReemplazadas ? ` rep=${r.descartadasReemplazadas}` : ''}`,
    }
  }
  type Caso = { nombre: string; arma: (v2: boolean) => EventoSesion[]; v2: [string, string]; v1: [string, string] }
  const casos: Caso[] = [
    {
      // Pausar enviado; el Pensar encadenado queda sin enviar; el aprendiz juega y la
      // microtarea escribe el «descartada» DESPUÉS de la jugada.
      nombre: 'A. Pausar enviado, Pensar encadenado sin enviar, el aprendiz juega',
      arma: v2 => { const { ppa, base, mov } = mk(v2); return [...base, mov(2000, 1),
        ppa(5000, 'sugerencia_ppa', { fase: 'pausar' }),
        ppa(6000, 'decision_ppa', { fase: 'pausar', decision: 'confirmada', origen: 'sugerencia' }),
        ppa(6000, 'sugerencia_ppa', { fase: 'pensar' }),
        mov(15000, 2),
        ppa(15000, 'decision_ppa', { fase: 'pensar', decision: 'descartada', origen: 'sugerencia' }),
        mov(17000, 3), mov(19000, 4)] },
      v2: ['k2:con_senal/pausar k3:sin_senal k4:sin_senal', 'act=1 desc=0 abs=1'],
      // En v1 el descarte posterior a la jugada abre su ventana (como siempre): el
      // motor v1 no escribía descartes después de la jugada.
      v1: ['k2:con_senal/pausar k3:sugerida_descartada/pensar k4:sin_senal', 'act=1 desc=1 abs=0'],
    },
    {
      // Actuar lleno; el operador envía OTRA fase (Pausar por iniciativa); el
      // «descartada» de Actuar se escribe después de la jugada.
      nombre: 'B. Actuar lleno y el operador envía Pausar por iniciativa',
      arma: v2 => { const { ppa, base, mov } = mk(v2); return [...base, mov(2000, 1),
        ppa(10000, 'sugerencia_ppa', { fase: 'actuar' }),
        ppa(11000, 'decision_ppa', { fase: 'pausar', decision: 'confirmada', origen: 'iniciativa' }),
        mov(20000, 2),
        ppa(20000, 'decision_ppa', { fase: 'actuar', decision: 'descartada', origen: 'sugerencia' }),
        mov(22000, 3), mov(24000, 4)] },
      v2: ['k2:con_senal/pausar k3:sin_senal k4:sin_senal', 'act=1 desc=0 abs=1'],
      v1: ['k2:con_senal/pausar k3:sugerida_descartada/actuar k4:sin_senal', 'act=1 desc=1 abs=0'],
    },
    {
      // La sugerencia espera, el aprendiz juega y el operador confirma después.
      nombre: 'C. Sugerencia, jugada del aprendiz, confirmación posterior',
      arma: v2 => { const { ppa, base, mov } = mk(v2); return [...base, mov(2000, 1),
        ppa(5000, 'sugerencia_ppa', { fase: 'pausar' }),
        mov(7000, 2),
        ppa(8000, 'decision_ppa', { fase: 'pausar', decision: 'confirmada', origen: 'sugerencia' }),
        mov(16000, 3), mov(19000, 4)] },
      // v2: la jugada se hizo con el anillo lleno y sin enviar: es del control.
      v2: ['k2:sugerida_descartada/pausar k3:con_senal/pausar k4:sin_senal', 'act=1 desc=1 abs=0'],
      // v1: igual que antes del cambio de hoy: la jugada previa a la confirmación es «sin señal».
      v1: ['k2:sin_senal k3:con_senal/pausar k4:sin_senal', 'act=1 desc=0 abs=0'],
    },
    {
      // Control: la jugada lleva la hora física (anterior a la sugerencia) pero está
      // escrita después en la bitácora. Manda el orden de inserción (limitación
      // conocida B1 de la auditoría: la importación ordena por hora y puede invertirlo).
      nombre: 'D. Control, jugada con hora física anterior a la sugerencia (orden de inserción)',
      arma: v2 => { const { ev, ppa, base, mov } = mk(v2); void ev; return [...base, mov(2000, 1),
        ppa(10000, 'sugerencia_ppa', { fase: 'actuar' }),
        mov(9900, 2),
        ppa(10100, 'decision_ppa', { fase: 'actuar', decision: 'descartada', origen: 'sugerencia' }),
        mov(13000, 3)] },
      v2: ['k2:sugerida_descartada/actuar k3:sin_senal', 'act=0 desc=1 abs=0'],
      v1: ['k2:sin_senal k3:sugerida_descartada/actuar', 'act=0 desc=1 abs=0'],
    },
    {
      // Pausar enviado y el Pensar encadenado se deja pasar ANTES de la jugada: el
      // «descartada» no puede quitarle la ventana a la señal real (hallazgo 1).
      nombre: 'E. Pausar enviado y Pensar encadenado dejado pasar',
      arma: v2 => { const { ppa, base, mov } = mk(v2); return [...base, mov(2000, 1),
        ppa(5000, 'sugerencia_ppa', { fase: 'pausar' }),
        ppa(6000, 'decision_ppa', { fase: 'pausar', decision: 'confirmada', origen: 'sugerencia' }),
        ppa(6000, 'sugerencia_ppa', { fase: 'pensar' }),
        ppa(7000, 'decision_ppa', { fase: 'pensar', decision: 'descartada', origen: 'sugerencia' }),
        mov(15000, 2), mov(17000, 3)] },
      v2: ['k2:con_senal/pausar k3:sin_senal', 'act=1 desc=0 abs=1'],
      v1: ['k2:con_senal/pausar k3:sin_senal', 'act=1 desc=0 abs=1'],
    },
    {
      // Hallazgo A3 (a): Actuar lleno y el operador envía OTRA fase. El motor cierra
      // Actuar como «reemplazada» y enseguida llega la confirmación de Pausar.
      nombre: 'F. Actuar lleno y el operador envía Pausar (Actuar reemplazada)',
      arma: v2 => { const { ppa, base, mov } = mk(v2); return [...base, mov(2000, 1),
        ppa(10000, 'sugerencia_ppa', { fase: 'actuar' }),
        ppa(11000, 'decision_ppa', { fase: 'actuar', decision: 'descartada', origen: 'sugerencia', motivoDescarte: MOTIVO_NO_ENVIADA.reemplazada }),
        ppa(11000, 'decision_ppa', { fase: 'pausar', decision: 'confirmada', origen: 'iniciativa' }),
        mov(20000, 2), mov(22000, 3), mov(24000, 4)] },
      v2: ['k2:con_senal/pausar k3:sin_senal k4:sin_senal', 'act=1 desc=0 abs=0 rep=1'],
      v1: ['k2:con_senal/pausar k3:sin_senal k4:sin_senal', 'act=1 desc=0 abs=0 rep=1'],
    },
    {
      // (b) Actuar lleno, dos fallas: Pausar lo reemplaza, se sugiere y se confirma.
      nombre: 'G. Actuar lleno, dos fallas, Pausar sugerido y confirmado',
      arma: v2 => { const { ppa, base, mov } = mk(v2); return [...base, mov(2000, 1),
        ppa(10000, 'sugerencia_ppa', { fase: 'actuar' }),
        ppa(12000, 'decision_ppa', { fase: 'actuar', decision: 'descartada', origen: 'sugerencia', motivoDescarte: MOTIVO_NO_ENVIADA.reemplazada }),
        ppa(12000, 'sugerencia_ppa', { fase: 'pausar' }),
        ppa(13000, 'decision_ppa', { fase: 'pausar', decision: 'confirmada', origen: 'sugerencia' }),
        mov(20000, 2), mov(22000, 3), mov(24000, 4)] },
      v2: ['k2:con_senal/pausar k3:sin_senal k4:sin_senal', 'act=1 desc=0 abs=0 rep=1'],
      v1: ['k2:con_senal/pausar k3:sin_senal k4:sin_senal', 'act=1 desc=0 abs=0 rep=1'],
    },
    {
      // (c) Lo mismo, pero Pausar no se envía y el aprendiz juega: la jugada es de
      // «sugerida y descartada» de PAUSAR (la sugerencia vigente), no de Actuar.
      nombre: 'H. Actuar lleno, dos fallas, Pausar sin enviar y el aprendiz juega',
      arma: v2 => { const { ppa, base, mov } = mk(v2); return [...base, mov(2000, 1),
        ppa(10000, 'sugerencia_ppa', { fase: 'actuar' }),
        ppa(12000, 'decision_ppa', { fase: 'actuar', decision: 'descartada', origen: 'sugerencia', motivoDescarte: MOTIVO_NO_ENVIADA.reemplazada }),
        ppa(12000, 'sugerencia_ppa', { fase: 'pausar' }),
        mov(15000, 2),
        ppa(15000, 'decision_ppa', { fase: 'pausar', decision: 'descartada', origen: 'sugerencia', motivoDescarte: MOTIVO_NO_ENVIADA.jugada }),
        mov(17000, 3), mov(19000, 4)] },
      v2: ['k2:sugerida_descartada/pausar k3:sin_senal k4:sin_senal', 'act=0 desc=1 abs=0 rep=1'],
      // v1 (sin versión): la sugerencia se ignora; solo el descarte del operador abre ventana.
      v1: ['k2:sin_senal k3:sugerida_descartada/pausar k4:sin_senal', 'act=0 desc=1 abs=0 rep=1'],
    },
  ]
  for (const c of casos) {
    for (const [nombre, v2] of [['ppa-v2', true], ['ppa-v1', false]] as [string, boolean][]) {
      const esperado = v2 ? c.v2 : c.v1
      const r = lista(c.arma(v2))
      chk(r.grupos === esperado[0] && r.cuentas === esperado[1],
        `${c.nombre} [${nombre}]: ${r.grupos} · ${r.cuentas}`
        + (r.grupos === esperado[0] && r.cuentas === esperado[1] ? '' : ` (esperado: ${esperado[0]} · ${esperado[1]})`))
    }
  }
  // Escenarios A y E, v2: la decisión que sigue a la señal se mide desde que la señal terminó.
  const a2 = efectoMediacion(casos[0].arma(true))
  chk(a2.conSenal.n === 1 && a2.descartada.n === 0 && a2.conSenal.latenciaDesdeSenal === 4000,
    `A [ppa-v2]: la decisión de la señal real es del grupo «con señal» y su tiempo libre es 4000 ms (${a2.conSenal.latenciaDesdeSenal})`)
  // Escenario C, v2: el tiempo libre de la jugada hecha con el anillo lleno cuenta desde que se llenó.
  const c2 = efectoMediacion(casos[2].arma(true))
  chk(c2.descartada.n === 1 && c2.descartada.latenciaDesdeSenal === 2000, `C [ppa-v2]: su tiempo libre cuenta desde que el anillo se llenó (${c2.descartada.latenciaDesdeSenal} ms = 2000 ms)`)
}

console.log('')
if (fallos) { console.log(`>>> ${fallos} FALLOS en el motor PPA`); process.exit(1) }
console.log('MOTOR PPA OK: Actuar por tiempo con umbral del operador; Pausar y Pensar por anillo; el operador decide.')

import { useEffect, useRef, useState } from 'react'
import {
  type Board, createInitialBoard, computeWinBoard, boardsEqual, isStuck, applyMove,
} from '../../core/simulation/laEscaleraRules'
import AvisoRegla, { type FalloRegla } from './AvisoRegla'
import { classifyAttempt, explainError } from '../../core/simulation/tutor'
import {
  AUTO_OFF_MS, EFECTOS, type PPAPhase,
} from '../../core/ppa/ppaColors'
import { playPpaFeedback, playError } from '../../core/utils/ppaTones'
import { type DecisionOperador, toCsvDecisionesOperador, downloadFile, nowIso } from '../../core/control/bitacoraControl'
import AmbientMusicPanel from '../AmbientMusicPanel'
import { Panel, SectionTitle, Collapsible, LogPanel, TwoColumn } from '../../ui/brand'
import BotonesMarcadorEeg from '../BotonesMarcadorEeg'
import { sectionLabel, smallBtn, TEAM_HEX } from '../../ui/styles'
import PanelMediacion from '../ppa/PanelMediacion'
import { usePpaMotor, type EventoPpa } from '../../core/ppa/usePpaMotor'
import { CONFIG_PPA } from '../../core/ppa/motorPpa'
import { useSesion } from '../../core/session/sesion'
import SimBoard from './SimBoard'
import EndBanner from './EndBanner'

// Réplica de Control Mago de Oz para practicar el rol de operador sin
// hardware: mismos botones PPA, misma barra lateral. La diferencia, a
// propósito: aquí sí se pueden arrastrar los cubos para simular lo que
// haría un estudiante (en Control solo se refleja lo que reportan los
// sensores reales), y cada movimiento inválido se explica en pantalla.

const SND_H = [0.55, 0.75, 0.95, 0.60, 1.00, 0.80, 0.70, 0.90]

function ControlSimulado({ pares, operatorId }: { pares: number; operatorId: string }) {
  const [board, setBoard] = useState<Board>(() => createInitialBoard(pares))
  const [prevBoard, setPrevBoard] = useState<Board | null>(null) // Regla 2
  const [selectedPos, setSelectedPos] = useState<number | null>(null)
  const [selectedCubeId, setSelectedCubeId] = useState<number | null>(null)
  const [status, setStatus] = useState<'jugando' | 'victoria' | 'bloqueado'>('jugando')
  const [moves, setMoves] = useState(0)
  const [errorCell, setErrorCell] = useState<number | null>(null)
  const [lastError, setLastError] = useState<FalloRegla | null>(null)
  const [cubeActions, setCubeActions] = useState<Record<number, PPAPhase>>({})
  const [activeAction, setActiveAction] = useState<PPAPhase | null>(null)
  const [noSelWarning, setNoSelWarning] = useState(false)
  const [events, setEvents] = useState<DecisionOperador[]>([])
  const [logOpen, setLogOpen] = useState(true)
  const [, setTick] = useState(0)
  const offTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const turnStartRef = useRef(Date.now())

  const win = computeWinBoard(createInitialBoard(pares))

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 500)
    return () => clearInterval(id)
  }, [])

  function resetBoard(n: number) {
    setBoard(createInitialBoard(n))
    setPrevBoard(null)
    setSelectedPos(null); setErrorCell(null); setLastError(null)
    setStatus('jugando'); setMoves(0); motor.reiniciarTurno()
    turnStartRef.current = Date.now()
  }


  function logControl(entry: Omit<DecisionOperador, 'timestamp' | 'pares' | 'operadorId'>) {
    setEvents(prev => [...prev, {
      timestamp: nowIso(), pares, operadorId: operatorId || '(sin asignar)',
      participanteId: sesion.perfil?.participante, versionPpa: CONFIG_PPA.version, ...entry,
    }])
  }

  // ── Motor de mediación PPA, el mismo de Control (core/ppa/motorPpa.ts).
  const sesion = useSesion()
  const cuboObjetivoRef = useRef(0)
  function onEventoPpa(e: EventoPpa) {
    const cubo = cuboObjetivoRef.current
    if (e.tipo === 'sugerencia_ppa') logControl({ tipo: 'sugerencia_ppa', cuboId: e.cuboSugerido ?? 0, fase: e.fase, motivo: e.motivo, detalle: `${e.detalle} (simulado)` })
    else if (e.tipo === 'decision_ppa') logControl({
      tipo: 'decision_ppa', cuboId: cubo, fase: e.fase, motivo: e.motivo, decision: e.decision, motivoDescarte: e.motivoDescarte,
      activacionEfectiva: e.activacionEfectiva, origen: e.origen, detalle: `${e.detalle} (simulado)`,
    })
    else logControl({ tipo: 'ajuste_umbral', cuboId: 0, fase: 'actuar', umbralMs: e.umbralMs, detalle: `${e.detalle} (simulado)` })
  }
  const motor = usePpaMotor({ activo: status === 'jugando', onEvento: onEventoPpa })

  // Cambiar los pares reinicia el tablero (después del motor: lo usa).
  const [paresSeen, setParesSeen] = useState(pares)
  if (paresSeen !== pares) {
    setParesSeen(pares)
    resetBoard(pares)
  }
  // El operador toca el anillo de una fase: va al cubo seleccionado o, si no
  // hay, al de la última jugada inválida.
  function enviarFase(fase: PPAPhase) {
    const sug = motor.sugerencia
    const id = selectedCubeId ?? (sug?.fase === fase ? sug.cuboSugerido : undefined) ?? null
    if (id === null) { guarded(() => {}); return }
    cuboObjetivoRef.current = id
    dispararSenal(id, fase)
    motor.enviar(fase, `Operador envió ${fase.toUpperCase()} (simulado) al cubo #${id} por iniciativa propia`)
  }

  function handleMove(from: number, to: number) {
    if (!classifyAttempt(board, from, to, prevBoard).ok) return
    const moved = board[from]!
    const next = applyMove(board, from, to)
    setPrevBoard(board)
    setBoard(next); setSelectedPos(null); setErrorCell(null); setLastError(null)
    setMoves(m => m + 1); motor.registrarMovimiento()
    setSelectedCubeId(moved.id)
    turnStartRef.current = Date.now()
    if (boardsEqual(next, win)) setStatus('victoria')
    else if (isStuck(next, win, board)) setStatus('bloqueado')
  }

  function handleInvalid(from: number, to: number) {
    if (from === to) return
    const res = classifyAttempt(board, from, to, prevBoard)
    if (res.ok) return
    const { titulo, texto } = explainError(res.error, board[from]!.team)
    playError()
    setErrorCell(to)
    setLastError({ error: res.error, titulo, texto })
    motor.registrarFalla(board[from]?.id)
  }

  function guarded(fn: () => void) {
    if (selectedCubeId === null) {
      if (warnTimer.current) clearTimeout(warnTimer.current)
      setNoSelWarning(true)
      warnTimer.current = setTimeout(() => setNoSelWarning(false), 2500)
      return
    }
    fn()
  }

  // Enciende la señal en pantalla y con sonido; se apaga sola a los 5 s.
  function dispararSenal(id: number, a: PPAPhase) {
    if (offTimers.current[id]) clearTimeout(offTimers.current[id])
    setCubeActions(prev => ({ ...prev, [id]: a }))
    setActiveAction(a)
    playPpaFeedback(a, AUTO_OFF_MS / 1000)
    offTimers.current[id] = setTimeout(() => {
      setCubeActions(prev => { const n = { ...prev }; delete n[id]; return n })
      setActiveAction(null)
      logControl({ tipo: 'senal_apagada', cuboId: id, fase: 'estado_inicial', detalle: `Señal del cubo #${id} apagada automáticamente tras ${AUTO_OFF_MS / 1000}s (simulado)` })
    }, AUTO_OFF_MS)
  }

  function apagar() {
    const id = selectedCubeId!
    if (offTimers.current[id]) clearTimeout(offTimers.current[id])
    setCubeActions(prev => { const n = { ...prev }; delete n[id]; return n })
    setActiveAction(null)
    logControl({ tipo: 'senal_apagada', cuboId: id, fase: 'estado_inicial', detalle: `Operador apagó manualmente la señal del cubo #${id} (simulado)` })
  }

  function exportCsv() { downloadFile(`bitacora-control-simulado-${Date.now()}.csv`, toCsvDecisionesOperador(events), 'text/csv;charset=utf-8') }
  function exportJson() { downloadFile(`bitacora-control-simulado-${Date.now()}.json`, JSON.stringify(events, null, 2), 'application/json') }

  const selAction = selectedCubeId !== null ? cubeActions[selectedCubeId] : undefined
  const main = (
    <>
      <Panel>
        <SectionTitle right={
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            {[{ l: 'Equipo A', c: TEAM_HEX.A }, { l: 'Equipo B', c: TEAM_HEX.B }, { l: 'Vacío', c: '#808080' }].map(x => (
              <span key={x.l} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--color-paper-dim)' }}>
                <span style={{ width: '8px', height: '8px', background: x.c }} />{x.l}
              </span>
            ))}
            <button onClick={() => resetBoard(pares)} style={smallBtn}>Reiniciar tablero</button>
          </div>
        }>
          Tablero simulado · {pares} par{pares > 1 ? 'es' : ''} · {moves} movimientos
        </SectionTitle>
        {status === 'victoria' && <EndBanner kind="victoria" title="¡Victoria!" detail={`Intercambio completo en ${moves} movimientos. Usa «Reiniciar tablero» para empezar de nuevo.`} />}
        {status === 'bloqueado' && <EndBanner kind="bloqueo" title="Camino sin retorno: bloqueado" detail="La única jugada que queda es volver a la posición anterior, y eso no se permite. Usa «Reiniciar tablero»." />}
        <AvisoRegla fallo={status === 'jugando' ? lastError : null} reservar={status === 'jugando'} />
        <SimBoard permitir3d
          board={board} prev={prevBoard} disabled={status !== 'jugando'}
          selected={selectedPos} onSelect={i => { setSelectedPos(i); setErrorCell(null) }}
          onTapPiece={i => { const p = board[i]; if (p) setSelectedCubeId(p.id) }}
          onMove={handleMove} onInvalid={handleInvalid}
          errorCell={errorCell} cubeActions={cubeActions}
          efectoSesion={status === 'victoria' ? { n: EFECTOS.VICTORIA, clave: `v${moves}` } : status === 'bloqueado' ? { n: EFECTOS.BLOQUEO, clave: `b${moves}` } : null} />
        {/* Mediación y control de cubos dentro del tablero, bajo los cubos (el aviso de regla va arriba). */}
        <PanelMediacion
          variante="banda"
          motor={motor}
          onEnviar={enviarFase}
          destinoConfirmacion={selectedCubeId !== null ? `irá al cubo #${selectedCubeId}` : motor.sugerencia?.cuboSugerido ? `irá al cubo #${motor.sugerencia.cuboSugerido}` : 'selecciona antes un cubo'}
          cubos={{
            seleccionado: selectedCubeId,
            accionActual: selAction,
            avisoSinSeleccion: noSelWarning,
            textoSinSeleccion: 'Toca un cubo del tablero para seleccionarlo',
            onEstadoInicial: () => guarded(apagar),
            autoOffS: AUTO_OFF_MS / 1000,
          }}
        />
      </Panel>


      <Collapsible title="Histórico — bitácora del operador (simulado)" open={logOpen} onToggle={() => setLogOpen(o => !o)}>
        <LogPanel
          title="Bitácora del operador (control simulado)"
          rows={events.map(e => ({ ts: e.timestamp, tag: e.operadorId, text: e.detalle }))}
          empty="Sin envíos todavía."
          onCsv={exportCsv} onJson={exportJson} />
        <BotonesMarcadorEeg seccion="control" pares={pares} />
      </Collapsible>
    </>
  )

  const side = (
    <>
      <Panel>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={sectionLabel}>Señal sonora PPA</div>
          <span style={{ fontSize: '9px', color: activeAction ? 'var(--color-blue)' : 'var(--color-paper-faint)' }}>{activeAction ? 'activo' : 'en espera'}</span>
        </div>
        <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '24px', marginBottom: '12px' }}>
          {SND_H.map((h, i) => <div key={i} style={{ flex: 1, background: 'var(--color-line-strong)', height: `${activeAction ? h * 90 : h * 35}%` }} />)}
        </div>
        <div style={{ ...sectionLabel, marginBottom: '6px' }}>Música de fondo</div>
        <AmbientMusicPanel accentColor="#4589FF" />
      </Panel>
    </>
  )

  return <TwoColumn main={main} side={side} />
}

export default ControlSimulado

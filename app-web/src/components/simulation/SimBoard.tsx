import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { type Board, legalMovesFor } from '../../core/simulation/laEscaleraRules'
import { PPA_HEX, INVALIDO_HEX, type PPAPhase } from '../../core/ppa/ppaColors'
import { TEAM_HEX } from '../../ui/styles'
import Tablero3D, { type AcabadoTablero3D } from '../control/Tablero3D'
import type { CeldaTablero } from '../control/TableroFisico'

// Tablero de la simulación, compartido por el tutorial, la práctica libre
// y el control simulado. Dos formas de mover, para que sirva igual a un
// niño que a un adulto mayor: arrastrar la ficha, o tocar la ficha y luego
// tocar la casilla a donde se quiere llevar. El tablero solo resuelve la
// mecánica — qué significa cada intento lo decide quien lo usa.

const DRAG_THRESHOLD_PX = 12
const SNAP_RANGE_FACTOR = 1.6
const SNAP_MS = 150 // movimiento funcional (la ficha vuelve o cae), no decorativo
const EMPTY_HEX = '#808080' // mismo gris de la casilla vacía en Control

type DragState = { fromIndex: number; startX: number; startY: number; dx: number; dy: number; snapping: boolean }

export type BoardHint = { from: number; to: number } | null

function SimBoard({
  board, disabled = false, selected, onSelect, onMove, onInvalid, onTapPiece,
  hint = null, errorCell = null, showArrows = false, showLegalTargets = true, cubeActions, prev = null,
  permitir3d = false,
}: {
  // Muestra el selector 2D/3D (Simulación libre y Control simulado). Por omisión 3D MDF; 2D queda en el selector.
  permitir3d?: boolean
  board: Board
  // Tablero anterior: la Regla 2 (no volver a la posición inmediatamente
  // anterior) depende de él.
  prev?: Board | null
  disabled?: boolean
  selected: number | null
  onSelect: (index: number | null) => void
  onMove: (from: number, to: number) => void
  onInvalid: (from: number, to: number) => void
  onTapPiece?: (index: number) => void
  hint?: BoardHint
  errorCell?: number | null
  showArrows?: boolean
  showLegalTargets?: boolean
  cubeActions?: Record<number, PPAPhase>
}) {
  const [drag, setDrag] = useState<DragState | null>(null)
  // Preferencia visual (2D por omisión), con try/catch por si el navegador bloquea el almacenamiento.
  const [vista, setVista] = useState<'2d' | '3d'>(() => {
    try { return localStorage.getItem('escalera:sim:vista-tablero.v2') === '2d' ? '2d' : '3d' }
    catch { return '3d' }
  })
  const [acabado, setAcabado] = useState<AcabadoTablero3D>(() => {
    try { return localStorage.getItem('escalera:sim:acabado-tablero-3d.v2') === 'minimalista' ? 'minimalista' : 'mdf' }
    catch { return 'mdf' }
  })
  // Jugada inválida: el cubo implicado se enciende de naranja 1 s (EF=3 del firmware, como en Control).
  const [flashId, setFlashId] = useState<number | null>(null)
  const flashTimer = useRef(0)
  useEffect(() => () => window.clearTimeout(flashTimer.current), [])
  useEffect(() => {
    try {
      localStorage.setItem('escalera:sim:vista-tablero.v2', vista)
      localStorage.setItem('escalera:sim:acabado-tablero-3d.v2', acabado)
    } catch { /* funciona igual sin almacenamiento */ }
  }, [vista, acabado])
  // «Buscar conexión» simulado: los cubos se ponen magenta y flotan, y se van conectando y encajando uno a uno con un
  // retraso breve y aleatorio (práctica y demostración; no envía nada al hardware).
  const [busca, setBusca] = useState<{ conectados: number[] } | null>(null)
  const [avisoBusca, setAvisoBusca] = useState('')
  const timersBusca = useRef<number[]>([])
  useEffect(() => () => timersBusca.current.forEach(window.clearTimeout), [])
  const idsTablero = board.flatMap(c => (c ? [c.id] : []))
  function buscarConexionSimulada() {
    timersBusca.current.forEach(window.clearTimeout)
    const ids = [...idsTablero]
    setBusca({ conectados: [] })
    setAvisoBusca('Buscando conexión…')
    timersBusca.current = ids.map(id => window.setTimeout(() => {
      setBusca(b => {
        if (!b) return b
        const conectados = [...b.conectados, id]
        if (conectados.length >= ids.length) {
          window.setTimeout(() => { setBusca(null); setAvisoBusca(`Búsqueda terminada: ${ids.length} de ${ids.length} cubos conectados`) }, 700)
        } else setAvisoBusca(`Buscando conexión… ${conectados.length} de ${ids.length} cubos conectados`)
        return { conectados }
      })
    }, 500 + Math.random() * 3500))
  }
  const cellRefs = useRef<(HTMLDivElement | null)[]>([])
  const rects = useRef<(DOMRect | null)[]>([])

  // Con pocos pares las fichas crecen: el tablero de 1 par (3 casillas)
  // quedaba diminuto en un panel pensado para 11. Con 5 pares vuelven al
  // tamaño de los cubos de Control (72x80) para caber en una sola fila.
  const baseScale = board.length <= 3 ? 1.45 : board.length <= 5 ? 1.3 : board.length <= 7 ? 1.12 : 1
  // Además se ajusta al ancho real de su columna: en la mesa de trabajo el
  // tablero comparte pantalla con el grafo y no siempre hay sitio para 11
  // casillas de tamaño completo.
  const wrapRef = useRef<HTMLDivElement>(null)
  const [availW, setAvailW] = useState(0)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setAvailW(el.clientWidth))
    ro.observe(el)
    setAvailW(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  const natural = board.length * 72 + (board.length - 1) * 6 // ancho a escala 1
  const fitScale = availW > 0 ? (availW - 8) / natural : baseScale
  const scale = Math.max(0.3, Math.min(baseScale, fitScale))

  const legalTargets = selected !== null && board[selected] ? legalMovesFor(board, selected, prev) : []

  function attempt(from: number, to: number) {
    const legal = board[to] === null && legalMovesFor(board, from, prev).includes(to)
    if (legal) onMove(from, to)
    else {
      const id = board[from]?.id ?? null
      if (id !== null) {
        setFlashId(id)
        window.clearTimeout(flashTimer.current)
        flashTimer.current = window.setTimeout(() => setFlashId(null), 1000)
      }
      onInvalid(from, to)
    }
  }

  // Toque en una casilla de la vista 3D: exactamente lo mismo que un toque sin arrastre en 2D.
  function tocarCasilla(index: number) {
    if (disabled) return
    if (!board[index]) {
      if (selected !== null) attempt(selected, index)
      return
    }
    onTapPiece?.(index)
    onSelect(selected === index ? null : index)
  }

  function finishDrag(from: number, to: number, outcome: 'move' | 'invalid' | 'cancel') {
    const fromRect = rects.current[from]
    const toRect = rects.current[outcome === 'move' ? to : from]
    setDrag(d => d && fromRect && toRect
      ? { ...d, dx: toRect.left - fromRect.left, dy: toRect.top - fromRect.top, snapping: true }
      : null)
    window.setTimeout(() => {
      if (outcome === 'move') onMove(from, to)
      if (outcome === 'invalid') onInvalid(from, to)
      setDrag(null)
    }, SNAP_MS)
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>, index: number) {
    if (disabled) return
    // Tocar una casilla vacía con una ficha ya elegida = intentar moverla ahí.
    if (!board[index]) {
      if (selected !== null) attempt(selected, index)
      return
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    rects.current = cellRefs.current.map(el => el ? el.getBoundingClientRect() : null)
    setDrag({ fromIndex: index, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, snapping: false })
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const x = e.clientX, y = e.clientY
    setDrag(d => (d && !d.snapping ? { ...d, dx: x - d.startX, dy: y - d.startY } : d))
  }

  // Sin la forma funcional de setDrag a propósito: en StrictMode React
  // invoca dos veces el updater, y finishDrag tiene efectos reales.
  function handlePointerUp() {
    const d = drag
    if (!d || d.snapping) return
    const { fromIndex, dx, dy } = d
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) {
      setDrag(null)
      onTapPiece?.(fromIndex)
      onSelect(selected === fromIndex ? null : fromIndex)
      return
    }
    const fromRect = rects.current[fromIndex]
    if (!fromRect) { setDrag(null); return }
    const cx = fromRect.left + fromRect.width / 2 + dx
    const cy = fromRect.top + fromRect.height / 2 + dy
    let nearest = -1, nearestDist = Infinity
    rects.current.forEach((r, i) => {
      if (!r) return
      const dd = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy)
      if (dd < nearestDist) { nearestDist = dd; nearest = i }
    })
    onSelect(null)
    if (nearest === -1 || nearest === fromIndex || nearestDist > fromRect.width * SNAP_RANGE_FACTOR) {
      finishDrag(fromIndex, fromIndex, 'cancel')
      return
    }
    const legal = board[nearest] === null && legalMovesFor(board, fromIndex, prev).includes(nearest)
    finishDrag(fromIndex, nearest, legal ? 'move' : 'invalid')
  }

  function tileStyle(i: number, asFloating = false): React.CSSProperties {
    const cell = board[i]
    const isDragging = drag?.fromIndex === i && !asFloating
    const empty = !cell || isDragging
    const action = cell && cubeActions ? cubeActions[cell.id] : undefined
    const isHintFrom = hint?.from === i, isHintTo = hint?.to === i
    const isLegal = showLegalTargets && legalTargets.includes(i)
    const ring = asFloating ? '0 8px 22px rgba(0,0,0,0.55)'
      : errorCell === i ? '0 0 0 3px var(--color-offline)'
        : selected === i ? '0 0 0 3px #ffffff'
          : isLegal ? '0 0 0 3px var(--color-online)'
            : isHintFrom || isHintTo ? '0 0 0 3px var(--color-caution)'
              : '0 2px 8px rgba(0,0,0,0.45)'
    return {
      width: `${Math.round(72 * scale)}px`, height: `${Math.round(80 * scale)}px`, borderRadius: '10px', flexShrink: 0,
      background: empty ? EMPTY_HEX : action ? PPA_HEX[action] : TEAM_HEX[cell!.team],
      opacity: empty && !isLegal && !isHintTo && errorCell !== i ? 0.75 : 1,
      boxShadow: ring,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 4px 6px', boxSizing: 'border-box',
      cursor: disabled ? 'default' : cell ? 'grab' : selected !== null ? 'pointer' : 'default',
      userSelect: 'none', touchAction: 'none', position: 'relative',
      // Texto oscuro sobre el color PPA encendido (igual que Cube.tsx): los
      // PPA_TEXT están pensados para fondo oscuro y sobre el cubo no se leen.
      color: action ? '#10141a' : '#fff',
    }
  }

  function tileContent(i: number, asFloating = false) {
    const cell = board[i]
    if (!cell || (drag?.fromIndex === i && !asFloating)) {
      const isLegal = showLegalTargets && legalTargets.includes(i)
      return (
        <span style={{ margin: 'auto', fontSize: '11px', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono)' }}>
          {isLegal ? 'AQUÍ' : hint?.to === i ? 'PISTA' : ''}
        </span>
      )
    }
    return (
      <>
        <span style={{ fontSize: `${Math.round(20 * scale)}px`, fontWeight: 700, lineHeight: 1, textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>{cell.id}</span>
        {showArrows && (
          <span aria-hidden="true" style={{ fontSize: `${Math.round(18 * scale)}px`, lineHeight: 1, opacity: 0.8 }}>{cell.team === 'A' ? '→' : '←'}</span>
        )}
      </>
    )
  }

  const en3d = permitir3d && vista === '3d'
  const celdas3d: CeldaTablero[] = board.map((cell, i) => cell
    ? { id: cell.id, visual: cell.id === flashId ? { hex: INVALIDO_HEX, pulso: true as const } : { hex: TEAM_HEX[cell.team], accion: cubeActions?.[cell.id] }, conectado: !busca || busca.conectados.includes(cell.id) }
    : { id: 0, visual: { hex: EMPTY_HEX }, legal: (showLegalTargets && legalTargets.includes(i)) || hint?.to === i })

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      {permitir3d && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 4px' }}>
          <div className="tablero-mode-controls" aria-label="Representación del tablero">
            <div className="tablero-mode-group" role="group" aria-label="Vista">
              <button type="button" className="tablero-mode-button" aria-pressed={vista === '2d'} onClick={() => setVista('2d')}>2D</button>
              <button type="button" className="tablero-mode-button" aria-pressed={vista === '3d'} onClick={() => setVista('3d')}>3D</button>
            </div>
            {vista === '3d' && (
              <div className="tablero-mode-group" role="group" aria-label="Conexión de los cubos">
                <button type="button" className="tablero-mode-button" disabled={busca !== null} onClick={buscarConexionSimulada}>
                  {busca ? 'Buscando conexión…' : 'Buscar conexión'}
                </button>
                <span role="status" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>{avisoBusca}</span>
              </div>
            )}
            {vista === '3d' && (
              <div className="tablero-mode-group" role="group" aria-label="Acabado de la base 3D">
                <button type="button" className="tablero-mode-button" aria-pressed={acabado === 'minimalista'} onClick={() => setAcabado('minimalista')}>Minimalista</button>
                <button type="button" className="tablero-mode-button" aria-pressed={acabado === 'mdf'} onClick={() => setAcabado('mdf')}>MDF</button>
              </div>
            )}
          </div>
        </div>
      )}
      {en3d ? (
        <div data-testid="sim-board-3d">
          <Tablero3D
            celdas={celdas3d}
            primeraCasilla={Math.max(0, Math.floor((11 - board.length) / 2))}
            levantados={selected !== null && board[selected]
              ? [{ id: board[selected]!.id, origen: selected, visual: celdas3d[selected].visual }]
              : []}
            seleccionado={selected !== null ? board[selected]?.id ?? null : null}
            mostrarConexion={busca !== null}
            buscando={busca !== null}
            acabado={acabado}
            equipoDe={id => (board.find(c => c?.id === id)?.team ?? 'A')}
            onCasilla={tocarCasilla}
            ajuste={availW > 0 ? Math.min(1, availW / 1020) : undefined} />
        </div>
      ) : (<>
      <div style={{ display: 'flex', gap: `${Math.round(6 * scale)}px`, flexWrap: 'nowrap', overflowX: 'auto', justifyContent: 'center', padding: '8px 4px', touchAction: 'none' }}>
        {board.map((_, i) => (
          <div key={i} data-cell={i}
            ref={el => { cellRefs.current[i] = el }}
            onPointerDown={e => handlePointerDown(e, i)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={tileStyle(i)}>
            {tileContent(i)}
          </div>
        ))}
      </div>
      </>)}

      {drag && board[drag.fromIndex] && rects.current[drag.fromIndex] && (() => {
        const r = rects.current[drag.fromIndex]!
        return (
          <div style={{
            ...tileStyle(drag.fromIndex, true),
            position: 'fixed', left: r.left, top: r.top, zIndex: 50, pointerEvents: 'none',
            transform: `translate(${drag.dx}px, ${drag.dy}px) scale(1.08)`,
            transition: drag.snapping ? `transform ${SNAP_MS}ms ease` : 'none',
          }}>
            {tileContent(drag.fromIndex, true)}
          </div>
        )
      })()}
    </div>
  )
}

export default SimBoard

// Aviso breve de una jugada no permitida, ARRIBA del tablero (pedido del autor,
// 2026-11-25). Antes era una tarjeta grande bajo el tablero con la animación de
// la regla siempre abierta: bajaba de la pantalla y empujaba la mediación.
//
// Ahora es una sola línea en un espacio reservado sobre los cubos, de modo que
// al aparecer no mueve nada: «✕ Regla N · qué pasó · en pocas palabras». La
// animación de la regla no ocupa lugar: se abre encima solo si se toca «Ver
// regla». Lo usan Control, Control simulado, Simulación libre y la Vista de
// observador (que la recibe en espejo de Control).
//
// Sin fallo, el mismo espacio muestra la indicación de la vista (si la hay), en
// tono neutro; así el tablero no salta cuando aparece o desaparece el aviso.
import { useEffect, useState } from 'react'
import { AnimacionRegla, REGLA_POR_ERROR } from './RulesAnimation'

export type FalloRegla = { error: string; titulo: string; texto: string }

// La regla en pocas palabras, por tipo de falla (las 3 reglas de la Fig. 3.3).
const BREVE: Record<string, string> = {
  ocupada: 'solo se mueve a la casilla vacía',
  lejos: '1 casilla deslizando o 2 saltando, nunca más',
  salto_propio: 'solo se salta sobre una ficha del otro color',
  salto_hueco: 'al lado está vacía: se desliza, no se salta',
  regreso: 'no se deshace la jugada anterior',
}

export default function AvisoRegla({ fallo, indicacion, tonoIndicacion = 'info', onOcultar, reservar = true }: {
  fallo: FalloRegla | null
  // Texto que ocupa el espacio cuando no hay fallo (p. ej. «Toca una ficha…»).
  indicacion?: string
  tonoIndicacion?: 'info' | 'ok' | 'error'
  onOcultar?: () => void
  // Reservar el alto aunque no haya nada que decir (evita saltos durante el juego).
  reservar?: boolean
}) {
  const [verRegla, setVerRegla] = useState(false)
  useEffect(() => { setVerRegla(false) }, [fallo])
  if (!fallo && !indicacion && !reservar) return null

  const regla = fallo ? REGLA_POR_ERROR[fallo.error] : undefined
  const clasificado = !!fallo && fallo.titulo !== 'Jugada no permitida'
  const breve = fallo ? (clasificado ? BREVE[fallo.error] : fallo.texto) : ''
  const acento = fallo ? 'var(--color-offline)'
    : tonoIndicacion === 'ok' ? 'var(--color-online)' : tonoIndicacion === 'error' ? 'var(--color-offline)' : 'var(--color-blue)'

  return (
    <div className="aviso-regla" style={{ position: 'relative', minHeight: '34px', marginBottom: '8px' }}>
      {(fallo || indicacion) && (
        <div role={fallo ? 'alert' : 'status'} title={fallo ? `${fallo.titulo}. ${fallo.texto}` : undefined} style={{
          display: 'flex', alignItems: 'center', gap: '8px', minHeight: '34px', padding: '4px 6px 4px 10px',
          borderRadius: 'var(--radius)', borderLeft: `3px solid ${acento}`, boxSizing: 'border-box',
          background: fallo ? 'rgba(250,77,86,0.10)' : 'var(--color-bg)', fontSize: '12.5px', lineHeight: 1.35,
        }}>
          {fallo && (
            <span aria-hidden="true" style={{
              width: '18px', height: '18px', flexShrink: 0, borderRadius: '50%', background: 'var(--color-offline)',
              color: '#0B0F10', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800,
            }}>✕</span>
          )}
          <span className="aviso-regla__texto" style={{
            flex: 1, minWidth: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            color: fallo ? 'var(--color-paper)' : 'var(--color-paper-dim)',
          }}>
            {fallo ? (
              <>
                {regla && <b style={{ color: 'var(--color-offline)', fontFamily: 'var(--font-mono)', fontSize: '11.5px' }}>Regla {regla} · </b>}
                <b>{fallo.titulo}</b>
                {breve && <span style={{ color: 'var(--color-paper-dim)' }}>: {breve}</span>}
              </>
            ) : indicacion}
          </span>
          {fallo && regla && (
            <button type="button" onClick={() => setVerRegla(v => !v)} aria-expanded={verRegla} style={{
              flexShrink: 0, background: 'transparent', border: '1px solid var(--color-line-strong)', borderRadius: '999px',
              padding: '3px 10px', fontSize: '11px', fontWeight: 600, color: 'var(--color-paper-dim)', cursor: 'pointer', whiteSpace: 'nowrap',
            }}>{verRegla ? 'Cerrar' : 'Ver regla'}</button>
          )}
          {fallo && onOcultar && (
            <button type="button" onClick={onOcultar} aria-label="Ocultar el aviso" style={{
              flexShrink: 0, background: 'transparent', border: 'none', color: 'var(--color-paper-faint)', cursor: 'pointer',
              fontSize: '15px', lineHeight: 1, padding: '2px 4px',
            }}>×</button>
          )}
        </div>
      )}
      {/* La animación se abre ENCIMA, solo a pedido: no desplaza el tablero ni la mediación. */}
      {fallo && verRegla && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 20, width: 'min(430px, 100%)',
          boxShadow: '0 10px 28px rgba(0,0,0,.35)', borderRadius: 'var(--radius)', background: 'var(--color-panel)',
        }}>
          <AnimacionRegla error={fallo.error} />
        </div>
      )}
    </div>
  )
}

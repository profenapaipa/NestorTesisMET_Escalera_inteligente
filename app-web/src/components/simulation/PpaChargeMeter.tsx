// Anillo de carga de una fase PPA. Se va llenando hacia su criterio (fallas
// o tiempo sin mover) y, al llenarse, late suavemente: es la señal visual de
// que el criterio se cumplió. No interrumpe ni decide nada; si se le pasa
// `onClick`, tocarlo envía la fase (lo decide el operador).
import type { ReactNode } from 'react'

const ESTILO_LATIDO = `
@keyframes ppa-latido { 0%, 100% { opacity: 1 } 50% { opacity: .45 } }
.ppa-anillo-lleno { animation: ppa-latido 1.4s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) { .ppa-anillo-lleno { animation: none } }
`

function PpaChargeMeter({ value, max, colorHex, label, texto, lleno, onClick, titulo, size = 46 }: {
  value: number
  max: number
  colorHex: string
  label: ReactNode
  // Texto del centro; por defecto «valor/máximo».
  texto?: string
  // Criterio cumplido: el anillo late.
  lleno?: boolean
  onClick?: () => void
  titulo?: string
  size?: number
}) {
  const pct = Math.max(0, Math.min(max > 0 ? value / max : 0, 1))
  const stroke = 5, r = (size - stroke) / 2, c = 2 * Math.PI * r
  const contenido = (
    <>
      <svg width={size} height={size} style={{ flexShrink: 0 }} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill={lleno ? `${colorHex}22` : 'none'} stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
        <circle
          className={lleno ? 'ppa-anillo-lleno' : undefined}
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colorHex} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.3s ease' }}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={size > 40 ? 12 : 10} fontWeight="700" fill="#fff">
          {texto ?? `${value}/${max}`}
        </text>
      </svg>
      <div style={{ fontSize: '11px', color: lleno ? colorHex : '#999', fontWeight: lleno ? 700 : 400, lineHeight: 1.25, textAlign: 'left' }}>{label}</div>
    </>
  )
  return (
    <>
      <style>{ESTILO_LATIDO}</style>
      {onClick ? (
        <button type="button" onClick={onClick} title={titulo} aria-label={titulo}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}>
          {contenido}
        </button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} title={titulo}>{contenido}</div>
      )}
    </>
  )
}

export default PpaChargeMeter

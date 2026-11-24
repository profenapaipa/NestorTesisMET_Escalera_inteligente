// Historial de versiones como línea de tiempo: cada versión se despliega para
// ver su detalle, separado en correcciones (qué error se arregló), mejoras y
// novedades. Los filtros dejan ver, por ejemplo, solo las correcciones de
// todas las versiones. Datos en core/versiones.ts.
import { useState } from 'react'
import { ChevronDown, Wrench, TrendingUp, Sparkles } from 'lucide-react'
import { HISTORIAL_VERSIONES, type TipoCambio } from '../../core/versiones'
import { VERSION_APP } from '../../core/version'

const TIPOS: { tipo: TipoCambio; plural: string; singular: string; color: string; Icono: typeof Wrench }[] = [
  { tipo: 'correccion', plural: 'Correcciones', singular: 'corrección', color: 'var(--color-caution)', Icono: Wrench },
  { tipo: 'mejora', plural: 'Mejoras', singular: 'mejora', color: 'var(--color-online)', Icono: TrendingUp },
  { tipo: 'novedad', plural: 'Novedades', singular: 'novedad', color: 'var(--color-blue)', Icono: Sparkles },
]
const INFO = Object.fromEntries(TIPOS.map(t => [t.tipo, t])) as Record<TipoCambio, (typeof TIPOS)[number]>

function plural(k: number, t: TipoCambio) {
  const i = INFO[t]
  return `${k} ${k === 1 ? i.singular : i.plural.toLowerCase()}`
}


export default function HistorialVersiones() {
  const [filtro, setFiltro] = useState<TipoCambio | 'todo'>('todo')
  // La versión en uso abierta de entrada; las demás, cerradas.
  const [abiertas, setAbiertas] = useState<Set<string>>(() => new Set([HISTORIAL_VERSIONES[0]?.version]))
  const todasAbiertas = abiertas.size === HISTORIAL_VERSIONES.length

  const totales = Object.fromEntries(TIPOS.map(t => [t.tipo,
    HISTORIAL_VERSIONES.reduce((s, v) => s + v.detalle.filter(d => d.tipo === t.tipo).length, 0)])) as Record<TipoCambio, number>

  const alternar = (v: string) => setAbiertas(prev => {
    const s = new Set(prev); if (s.has(v)) s.delete(v); else s.add(v); return s
  })

  const chip = (activo: boolean, color?: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
    padding: '5px 11px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
    background: activo ? 'var(--color-panel)' : 'transparent',
    border: `1px solid ${activo ? (color ?? 'var(--color-paper-dim)') : 'var(--color-line-strong)'}`,
    color: activo ? 'var(--color-paper)' : 'var(--color-paper-dim)',
  })

  return (
    <div>
      <p style={{ fontSize: '12.5px', lineHeight: 1.55, margin: '0 0 10px', color: 'var(--color-paper-dim)' }}>
        {HISTORIAL_VERSIONES.length} versiones desde septiembre de 2026: {plural(totales.correccion, 'correccion')},{' '}
        {plural(totales.mejora, 'mejora')} y {plural(totales.novedad, 'novedad')}. Despliega una versión para ver qué
        error se corrigió y qué cambió. El historial público empieza en la 0.11.0; las anteriores se hicieron en el
        repositorio privado de la tesis.
      </p>

      <div role="group" aria-label="Filtrar cambios por tipo" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginBottom: '12px' }}>
        <button type="button" aria-pressed={filtro === 'todo'} onClick={() => setFiltro('todo')} style={chip(filtro === 'todo')}>Todo</button>
        {TIPOS.map(({ tipo, plural: p, color, Icono }) => (
          <button key={tipo} type="button" aria-pressed={filtro === tipo} onClick={() => setFiltro(tipo)} style={chip(filtro === tipo, color)}>
            <Icono size={13} color={color} aria-hidden /> {p} <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-paper-faint)' }}>{totales[tipo]}</span>
          </button>
        ))}
        <button type="button" onClick={() => setAbiertas(todasAbiertas ? new Set() : new Set(HISTORIAL_VERSIONES.map(v => v.version)))}
          style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--color-blue)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, padding: '4px 2px' }}>
          {todasAbiertas ? 'Contraer todas' : 'Desplegar todas'}
        </button>
      </div>

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {HISTORIAL_VERSIONES.map(v => {
          const visibles = filtro === 'todo' ? v.detalle : v.detalle.filter(d => d.tipo === filtro)
          if (filtro !== 'todo' && visibles.length === 0) return null
          const abierta = abiertas.has(v.version)
          const enUso = v.version === VERSION_APP
          const idDetalle = `version-${v.version.replace(/\./g, '-')}`
          return (
            <li key={v.version} style={{
              border: `1px solid ${enUso ? 'var(--color-line-strong)' : 'var(--color-line)'}`, borderRadius: 'var(--radius)',
              background: abierta ? 'var(--color-bg)' : 'transparent',
            }}>
              <button type="button" onClick={() => alternar(v.version)} aria-expanded={abierta} aria-controls={idDetalle}
                style={{
                  width: '100%', display: 'flex', alignItems: 'flex-start', gap: '12px', textAlign: 'left', cursor: 'pointer',
                  background: 'transparent', border: 'none', padding: '10px 12px', color: 'var(--color-paper)',
                }}>
                <ChevronDown size={15} aria-hidden style={{ flexShrink: 0, marginTop: '3px', color: 'var(--color-paper-faint)', transform: abierta ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }} />
                <span style={{ flexShrink: 0, width: '78px' }}>
                  <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '14px' }}>{v.version}</span>                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 8px' }}>
                    <b style={{ fontSize: '13.5px' }}>{v.titulo}</b>
                    {enUso && <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '1px 7px', borderRadius: '999px', border: '1px solid var(--color-online)', color: 'var(--color-online)' }}>en uso</span>}
                    {!v.publica && <span style={{ fontSize: '10.5px', padding: '1px 7px', borderRadius: '999px', border: '1px solid var(--color-line-strong)', color: 'var(--color-paper-faint)' }}>interna</span>}
                  </span>
                  <span style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: '5px' }}>
                    {TIPOS.map(({ tipo, color, Icono }) => {
                      const k = v.detalle.filter(d => d.tipo === tipo).length
                      if (!k) return null
                      return (
                        <span key={tipo} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: 'var(--color-paper-dim)' }}>
                          <Icono size={12} color={color} aria-hidden /> {plural(k, tipo)}
                        </span>
                      )
                    })}
                  </span>
                </span>
              </button>
              {abierta && (
                <div id={idDetalle} style={{ padding: '0 14px 12px 117px' }} className="historial-versiones__detalle">
                  {TIPOS.map(({ tipo, plural: p, color, Icono }) => {
                    const items = visibles.filter(d => d.tipo === tipo)
                    if (!items.length) return null
                    return (
                      <div key={tipo} style={{ marginTop: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-paper-dim)' }}>
                          <Icono size={13} color={color} aria-hidden /> {p}
                        </div>
                        <ul style={{ margin: '4px 0 0', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {items.map(d => (
                            <li key={d.texto} style={{ fontSize: '12.5px', lineHeight: 1.55, color: 'var(--color-paper)' }}>{d.texto}</li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

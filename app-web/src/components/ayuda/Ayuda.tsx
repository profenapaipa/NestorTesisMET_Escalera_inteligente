// Ayuda integrada: limitaciones conocidas (fase 1) y guía rápida (fase 2).
// Los textos viven en core/guia.ts.
import { useState } from 'react'
import { ChevronDown, Info } from 'lucide-react'
import ModalInforme, { Bloque } from '../informe/ModalInforme'
import { CAMINOS, GUIA_VISTA, LIMITACIONES } from '../../core/guia'
import { COMMIT_APP, VERSION_APP } from '../../core/version'
import { HISTORIAL_VERSIONES } from '../../core/versiones'

function leer(clave: string, defecto: boolean): boolean {
  try { const v = localStorage.getItem(clave); return v === null ? defecto : v === '1' } catch { return defecto }
}
function guardar(clave: string, v: boolean) {
  try { localStorage.setItem(clave, v ? '1' : '0') } catch { /* sin almacenamiento */ }
}

// Distintivo de versión en el encabezado: abre las limitaciones conocidas.
export function DistintivoVersion({ onAbrir }: { onAbrir: () => void }) {
  return (
    <button type="button" onClick={onAbrir} title="Versión del software, historial de versiones y limitaciones conocidas"
      style={{
        display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, cursor: 'pointer',
        background: 'transparent', border: '1px solid var(--color-line-strong)', borderRadius: '999px',
        padding: '3px 9px', color: 'var(--color-paper-dim)', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.04em',
      }}>
      <Info size={11} /> v{VERSION_APP} · en desarrollo
    </button>
  )
}

const celda: React.CSSProperties = { padding: '6px 8px', borderTop: '1px solid var(--color-line)', fontSize: '12px', verticalAlign: 'top' }

export function Limitaciones({ onCerrar }: { onCerrar: () => void }) {
  return (
    <ModalInforme etiqueta="Versión, historial y limitaciones" titulo={`Escalera Inteligente v${VERSION_APP}`}
      subtitulo={`Versión ${VERSION_APP} (${COMMIT_APP}): cómo ha evolucionado y qué hay que tener presente al interpretar lo que registra y calcula.`}
      onCerrar={onCerrar}>
      <Bloque titulo="Historial de versiones">
        <p style={{ fontSize: '12.5px', lineHeight: 1.55, margin: '0 0 8px', color: 'var(--color-paper-dim)' }}>
          El historial público empieza en la 0.11.0. Las versiones anteriores se desarrollaron en el repositorio privado de la
          tesis y se resumen aquí para dejar a la vista el trabajo que hay detrás. El detalle de cada una está en el archivo CHANGELOG del repositorio.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['Versión', 'Fecha', 'Qué cambió'].map(c => (
                <th key={c} style={{ textAlign: 'left', fontSize: '11px', color: 'var(--color-paper-faint)', padding: '4px 8px', borderBottom: '1px solid var(--color-line-strong)' }}>{c}</th>
              ))}
            </tr></thead>
            <tbody>
              {HISTORIAL_VERSIONES.map(v => (
                <tr key={v.version}>
                  <td style={{ ...celda, fontFamily: 'var(--font-mono)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {v.version}{v.publica ? '' : ' *'}
                  </td>
                  <td style={{ ...celda, whiteSpace: 'nowrap', color: 'var(--color-paper-dim)' }}>{v.fecha}</td>
                  <td style={celda}><b>{v.titulo}.</b> <span style={{ color: 'var(--color-paper-dim)' }}>{v.cambios}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--color-paper-faint)', margin: '6px 0 0' }}>* Versión interna, anterior al historial público.</p>
      </Bloque>
      {LIMITACIONES.map(l => (
        <Bloque key={l.titulo} titulo={l.titulo}>
          <p style={{ fontSize: '13.5px', lineHeight: 1.65, margin: '0 0 6px', color: 'var(--color-paper)' }}>{l.texto}</p>
          <p style={{ fontSize: '11.5px', color: 'var(--color-paper-faint)', margin: 0 }}>Aparece en: {l.donde}</p>
        </Bloque>
      ))}
    </ModalInforme>
  )
}

// Franja «Cómo usar esta vista», bajo las pestañas. Abierta la primera vez;
// si se cierra, queda cerrada para esa pestaña en este navegador.
export function GuiaVista({ vista }: { vista: string }) {
  const g = GUIA_VISTA[vista]
  const clave = `escalera.guia.${vista}`
  const [abierta, setAbierta] = useState(() => leer(clave, true))
  if (!g) return null
  const cambiar = () => { setAbierta(a => { guardar(clave, !a); return !a }) }
  return (
    <div style={{ borderBottom: '1px solid var(--color-line)', background: 'var(--color-panel)', flexShrink: 0 }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '6px 20px' }} className="guia-vista">
        <button type="button" onClick={cambiar} aria-expanded={abierta}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', padding: '2px 0',
            color: 'var(--color-paper-dim)', cursor: 'pointer', fontSize: '11.5px', fontWeight: 600,
          }}>
          <ChevronDown size={13} style={{ transform: abierta ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }} />
          Cómo usar esta vista
        </button>
        {abierta && (
          <div style={{ padding: '4px 0 6px 19px', fontSize: '12px', lineHeight: 1.55, color: 'var(--color-paper-dim)' }}>
            <ol style={{ margin: 0, paddingLeft: '16px' }}>
              {g.pasos.map(p => <li key={p}>{p}</li>)}
            </ol>
            {g.ojo && <div style={{ marginTop: '4px', color: 'var(--color-paper-faint)' }}>Ojo: {g.ojo}</div>}
          </div>
        )}
      </div>
    </div>
  )
}

// Panel «¿Primera vez?» de la pantalla de inicio: los tres caminos.
export function PrimeraVez() {
  const clave = 'escalera.guia.inicio'
  const [abierta, setAbierta] = useState(() => leer(clave, true))
  const cambiar = () => { setAbierta(a => { guardar(clave, !a); return !a }) }
  return (
    <div style={{ border: '1px solid var(--color-line-strong)', borderRadius: 'var(--radius)', padding: '10px 12px', marginBottom: '18px' }}>
      <button type="button" onClick={cambiar} aria-expanded={abierta}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', padding: 0, color: 'var(--color-paper)', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}>
        <ChevronDown size={14} style={{ transform: abierta ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }} />
        ¿Primera vez? Tres formas de empezar
      </button>
      {abierta && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
          {CAMINOS.map((c, i) => (
            <div key={c.titulo} style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--color-paper-dim)' }}>
              <b style={{ color: 'var(--color-paper)' }}>{i + 1}. {c.titulo}.</b> {c.pasos}
            </div>
          ))}
          <div style={{ fontSize: '11px', color: 'var(--color-paper-faint)' }}>
            Los datos quedan solo en este equipo. Los perfiles «Simulado» son ejemplos generados por el programa, no personas.
          </div>
        </div>
      )}
    </div>
  )
}

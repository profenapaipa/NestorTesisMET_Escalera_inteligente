// Ayuda integrada: limitaciones conocidas (fase 1) y guía rápida (fase 2).
// Los textos viven en core/guia.ts.
import { useState } from 'react'
import { ChevronDown, Info, Sparkles, X } from 'lucide-react'
import { HISTORIAL_VERSIONES } from '../../core/versiones'
import ModalInforme, { Bloque } from '../informe/ModalInforme'
import { CAMINOS, GUIA_VISTA, LIMITACIONES } from '../../core/guia'
import { COMMIT_APP, VERSION_APP } from '../../core/version'
import HistorialVersiones from './HistorialVersiones'

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
      <Info size={11} /> v{VERSION_APP}<span className="distintivo-version__estado"> · en desarrollo</span>
    </button>
  )
}

// Aviso «versión nueva» (pedido del autor, 2026-11-25): la primera vez que el
// navegador abre una versión distinta de la última que vio, aparece un aviso
// breve bajo la barra con el título de la versión y «Revísalo», que abre el
// historial. Se cierra solo al tocarlo; no vuelve hasta la siguiente versión.
// La primera visita de un navegador no avisa (no hay «antes» con qué comparar).
const CLAVE_VERSION_VISTA = 'escalera.version.vista'
function leerTexto(clave: string): string | null {
  try { return localStorage.getItem(clave) } catch { return null }
}
function guardarTexto(clave: string, v: string) {
  try { localStorage.setItem(clave, v) } catch { /* sin almacenamiento */ }
}

export function AvisoVersionNueva({ onRevisar }: { onRevisar: () => void }) {
  const [visible, setVisible] = useState(() => {
    const vista = leerTexto(CLAVE_VERSION_VISTA)
    if (vista === null) { guardarTexto(CLAVE_VERSION_VISTA, VERSION_APP); return false }
    return vista !== VERSION_APP
  })
  if (!visible) return null
  const v = HISTORIAL_VERSIONES.find(h => h.version === VERSION_APP)
  const cerrar = () => { guardarTexto(CLAVE_VERSION_VISTA, VERSION_APP); setVisible(false) }
  return (
    <div role="status" className="aviso-version" style={{
      position: 'fixed', top: '52px', right: '16px', zIndex: 60, maxWidth: 'min(380px, calc(100vw - 32px))',
      display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px',
      background: 'var(--color-panel)', border: '1px solid var(--color-blue)', borderRadius: 'var(--radius)',
      boxShadow: '0 8px 24px rgba(0,0,0,.28)', color: 'var(--color-paper)', fontSize: '12.5px', lineHeight: 1.45,
    }}>
      <Sparkles size={16} color="var(--color-blue)" aria-hidden style={{ flexShrink: 0, marginTop: '1px' }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <b>Se actualizó a la versión {VERSION_APP}</b>
        {v && <span style={{ display: 'block', color: 'var(--color-paper-dim)' }}>{v.titulo}.</span>}
        <span style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
          <button type="button" onClick={() => { cerrar(); onRevisar() }} style={{
            background: 'var(--color-blue)', color: '#fff', border: 'none', borderRadius: 'var(--radius)',
            padding: '5px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
          }}>Revísalo</button>
          <button type="button" onClick={cerrar} style={{
            background: 'transparent', border: 'none', color: 'var(--color-paper-dim)', fontSize: '12px', cursor: 'pointer', padding: '5px 2px',
          }}>Ahora no</button>
        </span>
      </span>
      <button type="button" onClick={cerrar} aria-label="Cerrar el aviso de versión nueva" style={{
        background: 'transparent', border: 'none', color: 'var(--color-paper-faint)', cursor: 'pointer', padding: 0, lineHeight: 0,
      }}><X size={14} /></button>
    </div>
  )
}

export function Limitaciones({ onCerrar }: { onCerrar: () => void }) {
  return (
    <ModalInforme etiqueta="Versión, historial y limitaciones" titulo={`Escalera Inteligente v${VERSION_APP}`}
      subtitulo={`Versión ${VERSION_APP} (${COMMIT_APP}): cómo ha evolucionado y qué hay que tener presente al interpretar lo que registra y calcula.`}
      onCerrar={onCerrar}>
      <Bloque titulo="Historial de versiones">
        <HistorialVersiones />
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
  // En el celular empieza cerrada: abierta ocupaba más de media pantalla
  // fija sobre la vista (auditoría de textos, 2026-11-21).
  const [abierta, setAbierta] = useState(() => leer(clave, !window.matchMedia('(max-width: 760px)').matches))
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
          <div className="guia-vista__pasos" style={{ padding: '4px 0 6px 19px', fontSize: '12px', lineHeight: 1.55, color: 'var(--color-paper-dim)' }}>
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

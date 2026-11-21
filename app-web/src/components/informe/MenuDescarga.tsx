// Menú desplegable de descarga: un solo botón y, al abrirlo, cada formato con
// una línea que dice para qué sirve y en qué se diferencia de los otros.
// Se cierra al elegir, con Escape o al hacer clic fuera.
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Download } from 'lucide-react'
import { btnDocPrincipal } from './ModalInforme'

export type OpcionDescarga = { formato: string; descripcion: string; accion: () => void }

// Descripciones comunes a los tres informes (nivel, sesión, entre sesiones).
export const DESCRIPCION = {
  pdf: 'Para imprimir, archivar o enviar. Páginas A4 con la identidad del proyecto y de la UD; los grafos salen fijos, con o sin las rutas más cortas según la casilla de arriba. Se abre la impresión: elige «Guardar como PDF».',
  html: 'Un solo archivo que se abre en cualquier navegador, sin internet ni la aplicación. Es interactivo: un interruptor muestra u oculta las rutas más cortas en los grafos. Se adapta al celular.',
  csv: 'La tabla de intentos (una fila por intento) para Excel, R, SPSS o Python.',
  json: 'Todos los datos del informe, estructurados, para reanalizarlos o volver a importarlos.',
}

export default function MenuDescarga({ opciones, conRutas, onConRutas }: {
  opciones: OpcionDescarga[]
  // Si los grafos se exportan con las rutas más cortas resaltadas (PDF) o
  // empiezan así (HTML, donde luego se pueden ocultar).
  conRutas?: boolean
  onConRutas?: (v: boolean) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => { if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false) }
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla) }
  }, [abierto])

  return (
    <div ref={raiz} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" onClick={() => setAbierto(a => !a)} style={btnDocPrincipal} aria-haspopup="menu" aria-expanded={abierto}>
        <Download size={13} /> Descargar informe <ChevronDown size={13} style={{ transform: abierto ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }} />
      </button>
      {abierto && (
        <div role="menu" style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 20, width: 'min(360px, 86vw)',
          background: 'var(--color-bg)', border: '1px solid var(--color-line-strong)', borderRadius: 'var(--radius)',
          boxShadow: '0 8px 24px rgba(0,0,0,.18)', padding: '6px',
        }}>
          {onConRutas && (
            <label style={{
              display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '8px 10px 10px', margin: '0 0 4px',
              borderBottom: '1px solid var(--color-line)', cursor: 'pointer',
            }}>
              <input type="checkbox" checked={!!conRutas} onChange={e => onConRutas(e.target.checked)} style={{ marginTop: '3px', accentColor: '#9a1b78' }} />
              <span>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-paper)' }}>Resaltar las rutas más cortas en los grafos</span>
                <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--color-paper-dim)', lineHeight: 1.45, marginTop: '2px' }}>
                  Las rutas mínimas (contorno ciruela) ayudan a comparar el recorrido con la solución óptima. En el PDF quedan fijas; en el HTML es solo el estado inicial.
                </span>
              </span>
            </label>
          )}
          {opciones.map(o => (
            <button key={o.formato} type="button" role="menuitem"
              onClick={() => { setAbierto(false); o.accion() }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none',
                borderRadius: 'var(--radius)', padding: '8px 10px', cursor: 'pointer', color: 'var(--color-paper)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-panel)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>{o.formato}</div>
              <div style={{ fontSize: '11.5px', color: 'var(--color-paper-dim)', lineHeight: 1.45, marginTop: '2px' }}>{o.descripcion}</div>
            </button>
          ))}
          <div style={{ fontSize: '11px', color: 'var(--color-paper-faint)', lineHeight: 1.45, padding: '8px 10px 4px', borderTop: '1px solid var(--color-line)', marginTop: '4px' }}>
            Descargar baja un solo archivo para enviarlo o compartirlo. Para archivar el informe con sus datos junto a la sesión, usa «Guardar en el historial».
          </div>
        </div>
      )}
    </div>
  )
}

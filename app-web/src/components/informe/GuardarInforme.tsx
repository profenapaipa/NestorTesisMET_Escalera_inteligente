import { useState } from 'react'
import { Save } from 'lucide-react'
import { guardarInforme, type ResultadoGuardado } from '../../core/session/respaldo'
import { btnDoc } from './ModalInforme'

// «Guardar informe»: lo deja en el navegador, en la carpeta de la sesión y, si
// no hay carpeta, en las descargas. Es distinto de «Descargar informe», que
// solo baja un archivo HTML suelto: aquí el informe queda guardado con los
// datos con que se hizo (JSON) y las filas de intentos (CSV), de modo que se
// pueda regenerar o analizar aparte.

type Props = {
  tipo: 'nivel' | 'sesion' | 'macro'
  titulo: string
  base: string
  sesion: { sesionId: string; perfilId: string; inicio: string; participante: string }
  // Se piden como funciones para construir el informe solo al pulsar: el HTML
  // lleva los grafos como imagen, que solo existen con la ventana abierta.
  html: () => string
  json: () => unknown
  csv: () => string
}

function resumen(r: ResultadoGuardado): { texto: string; error: boolean } {
  if (r.error && !r.carpeta && !r.descargado && !r.navegador) return { texto: `No se pudo guardar: ${r.error}`, error: true }
  const partes: string[] = []
  if (r.navegador) partes.push('en el historial de este navegador')
  if (r.carpeta) partes.push(`en la carpeta «${r.carpeta}»`)
  if (r.descargado) partes.push('en tus descargas')
  return { texto: `Guardado ${partes.join(', ')}.`, error: !r.navegador && !r.carpeta && !r.descargado }
}

export default function GuardarInforme({ tipo, titulo, base, sesion, html, json, csv }: Props) {
  const [estado, setEstado] = useState<{ texto: string; error: boolean } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  // Panel para nombrar el informe antes de guardarlo.
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState(titulo)

  async function guardar() {
    const t = nombre.trim() || titulo
    // El nombre elegido también da nombre a los archivos (sin tildes ni símbolos),
    // con la marca de tiempo de `base` para no pisar otro informe.
    const sello = base.match(/\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/)?.[0] ?? ''
    const limpio = t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
    const archivo = t === titulo ? base : [limpio || 'informe', sello].filter(Boolean).join('-')
    setOcupado(true)
    try {
      const r = await guardarInforme({ tipo, titulo: t, base: archivo, sesion, html: html(), json: json(), csv: csv() })
      setEstado(resumen(r))
      setAbierto(false)
    } catch (e) {
      setEstado({ texto: `No se pudo guardar: ${String((e as Error)?.message ?? e)}`, error: true })
    } finally { setOcupado(false) }
  }

  return (
    <span style={{ position: 'relative', display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
      <button onClick={() => { setNombre(titulo); setEstado(null); setAbierto(a => !a) }} disabled={ocupado} style={btnDoc}
        aria-expanded={abierto}
        title="Archiva el informe con sus datos en el historial de este navegador, junto a la sesión, para volver a abrirlo después.">
        <Save size={13} /> {ocupado ? 'Guardando…' : 'Guardar en el historial'}
      </button>
      {abierto && (
        <div role="dialog" aria-label="Guardar en el historial" style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 20, width: 'min(380px, 86vw)',
          background: 'var(--color-bg)', border: '1px solid var(--color-line-strong)', borderRadius: 'var(--radius)',
          boxShadow: '0 8px 24px rgba(0,0,0,.18)', padding: '12px',
        }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-paper)', marginBottom: '6px' }}>
            Nombre del informe
            <input value={nombre} onChange={e => setNombre(e.target.value)} autoFocus maxLength={140}
              onKeyDown={e => { if (e.key === 'Enter') void guardar(); if (e.key === 'Escape') setAbierto(false) }}
              style={{
                display: 'block', width: '100%', marginTop: '5px', padding: '7px 9px', fontSize: '12.5px', fontWeight: 400,
                background: 'var(--color-bg)', color: 'var(--color-paper)', border: '1px solid var(--color-line-strong)', borderRadius: 'var(--radius)',
              }} />
          </label>
          <p style={{ fontSize: '11.5px', lineHeight: 1.5, color: 'var(--color-paper-dim)', margin: '8px 0 10px' }}>
            Queda guardado en el <b>historial de este navegador</b>, junto a la sesión: el informe (HTML), los datos con que
            se calculó (JSON) y la tabla de intentos (CSV). No se sube a internet ni se ve desde otro equipo, y se pierde si
            se borran los datos del navegador: para conservar una copia, elige una carpeta de sesión (también se guarda ahí)
            o usa «Descargar informe». Sin carpeta, los archivos se descargan además.
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setAbierto(false)} style={btnDoc}>Cancelar</button>
            <button type="button" onClick={() => void guardar()} disabled={ocupado}
              style={{ ...btnDoc, background: 'var(--color-blue)', borderColor: 'var(--color-blue)', color: '#fff', fontWeight: 600 }}>
              {ocupado ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
      {estado && (
        <span role="status" style={{ fontSize: '11.5px', color: estado.error ? 'var(--color-offline)' : 'var(--color-online)' }}>
          {estado.texto}
        </span>
      )}
    </span>
  )
}

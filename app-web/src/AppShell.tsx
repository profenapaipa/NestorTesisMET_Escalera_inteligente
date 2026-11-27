import { useEffect, useRef, useState } from 'react'
import App, { type ControlSnapshot } from './App'
import PantallaInicio from './components/PantallaInicio'
import InformeGeneral from './components/informe/InformeGeneral'
import { BotonTerminarSesion } from './components/informe/botones'
import MenuPerfil from './components/MenuPerfil'
import Creditos from './components/Creditos'
import { AvisoVersionNueva, DistintivoVersion, GuiaVista, Limitaciones } from './components/ayuda/Ayuda'
import { SesionProvider, useSesion } from './core/session/sesion'
import { sembrarSesionesDeEjemplo } from './core/session/semilla'
import TutorialTab from './components/TutorialTab'
import SimulacionLibreTab from './components/SimulacionLibreTab'
import ObservadorTab from './components/ObservadorTab'
import InformesTab from './components/InformesTab'
import VistaJugador from './components/jugador/VistaJugador'
import { StepMark, WIDE_MAX } from './ui/brand'

type Tab = 'control' | 'jugador' | 'tutorial' | 'libre' | 'observador' | 'informes'

const TABS: { id: Tab; label: string; short: string; mode: string; modeColor: string }[] = [
  { id: 'control', label: '1 · Control Mago de Oz', short: '1 · Control', mode: 'Hardware real', modeColor: 'var(--color-online)' },
  { id: 'jugador', label: 'Vista del jugador', short: 'Jugador', mode: 'Pantalla del participante', modeColor: 'var(--color-online)' },
  { id: 'tutorial', label: '2 · Tutorial guiado', short: '2 · Tutorial', mode: 'Sin hardware — aprendizaje', modeColor: 'var(--color-blue)' },
  { id: 'libre', label: '3 · Simulación libre', short: '3 · Simulación', mode: 'Sin hardware — práctica', modeColor: 'var(--color-blue)' },
  { id: 'observador', label: 'Vista de observador', short: 'Observador', mode: 'Solo lectura', modeColor: 'var(--color-paper-dim)' },
  { id: 'informes', label: '4 · Informes', short: '4 · Informes', mode: 'Sesiones guardadas', modeColor: 'var(--color-blue)' },
]

// Pestaña «1 · Control Mago de Oz» (pedido del autor, 2026-11-27): agrupa las
// tres vistas de una sesión con el tablero físico, en una subsección visible.
const GRUPO_CONTROL: { id: Tab; nombre: string; detalle: string }[] = [
  { id: 'control', nombre: 'Control Mago de Oz', detalle: 'La consola del operador' },
  { id: 'jugador', nombre: 'Vista del jugador', detalle: 'La pantalla del participante' },
  { id: 'observador', nombre: 'Vista de observador', detalle: 'Espejo de Control, solo lectura' },
]
const EN_GRUPO = new Set<Tab>(GRUPO_CONTROL.map(g => g.id))
// Pestañas de primer nivel: el grupo y las demás vistas.
const PRIMER_NIVEL: (Tab | 'grupo')[] = ['grupo', 'tutorial', 'libre', 'informes']

function Shell() {
  const { perfil, abrirSesion, cerrarSesion } = useSesion()
  const [informeAbierto, setInformeAbierto] = useState(false)
  const [creditos, setCreditos] = useState(false)
  const [limitaciones, setLimitaciones] = useState(false)
  const [tab, setTab] = useState<Tab>('control')
  // Estado de Control que la Vista de observador ve en espejo (solo lectura).
  const [snapshot, setSnapshot] = useState<ControlSnapshot | null>(null)
  const [simPares, setSimPares] = useState(1)
  // Las sesiones de ejemplo que vienen con la aplicación se cargan una sola
  // vez; al terminar se vuelve a pintar la pantalla de inicio para que sus
  // perfiles aparezcan sin recargar.
  const [semilla, setSemilla] = useState(0)
  useEffect(() => { sembrarSesionesDeEjemplo().then(hecha => { if (hecha) setSemilla(x => x + 1) }) }, [])

  // El operador y el participante son los del perfil de la sesión: se piden
  // una sola vez al entrar y acompañan a todos los registros, de modo que la
  // trazabilidad no dependa de reescribirlos en cada pestaña.
  const operatorId = perfil?.operador ?? ''
  const participante = perfil?.participante ?? ''
  const noop = () => { /* el perfil se fija al abrir la sesión */ }

  const current = TABS.find(t => t.id === tab)!
  // Última subvista usada del grupo Control: al volver a la pestaña se abre ahí.
  const ultimaSub = useRef<Tab>('control')
  useEffect(() => { if (EN_GRUPO.has(tab)) ultimaSub.current = tab }, [tab])
  const estiloPestana = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '7px', padding: '12px 14px 10px',
    background: 'transparent', border: 'none', cursor: 'pointer',
    borderBottom: `2px solid ${active ? 'var(--color-blue)' : 'transparent'}`,
    color: active ? 'var(--color-paper)' : 'var(--color-paper-faint)',
    fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600,
    letterSpacing: '0.08em', textTransform: 'uppercase',
  })

  if (!perfil) return <PantallaInicio key={semilla} onAbrir={abrirSesion} />

  return (
    <div style={{
      height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      background: 'var(--color-bg)', color: 'var(--color-paper)', fontFamily: 'var(--font-sans)',
    }}>
      {/* Pestañas con el mismo lenguaje del resto: etiqueta mono en
          mayúsculas, la activa marcada con el medio escalón azul y un filo
          inferior — no botones redondeados de colores sueltos. */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid var(--color-line)' }}>
        {/* Las pestañas siguen siendo botones (la prueba de navegación los busca
            por rol de botón); la activa se anuncia con aria-current, que es la
            semántica de una navegación entre vistas. */}
        {/* Dos carriles (auditoría de textos, 2026-11-21): las pestañas se
            desplazan si no caben; las acciones quedan siempre a la vista. */}
        <div className="barra-superior" style={{
          display: 'flex', alignItems: 'stretch', maxWidth: tab === 'tutorial' || tab === 'libre' ? WIDE_MAX : '1400px', margin: '0 auto',
          padding: '0 20px', boxSizing: 'border-box',
        }}>
        <nav aria-label="Vistas de la aplicación" className="barra-pestanas" style={{
          display: 'flex', alignItems: 'stretch', gap: '4px', flex: 1, minWidth: 0,
        }}>
          {PRIMER_NIVEL.map(id => {
            if (id === 'grupo') {
              const active = EN_GRUPO.has(tab)
              return (
                <button key="grupo" className="pestana" aria-label="1 · Control Mago de Oz" aria-current={active ? 'page' : undefined}
                  onClick={e => { setTab(active ? tab : ultimaSub.current); e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }) }}
                  style={estiloPestana(active)}>
                  <StepMark color={active ? 'var(--color-blue)' : 'var(--color-line-strong)'} size={11} />
                  <span>1 · Control Mago de Oz</span>
                </button>
              )
            }
            const t = TABS.find(x => x.id === id)!
            const active = t.id === tab
            return (
              <button key={t.id} className="pestana" aria-label={t.label} aria-current={active ? 'page' : undefined} onClick={e => { setTab(t.id); e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }) }} style={estiloPestana(active)}>
                <StepMark color={active ? 'var(--color-blue)' : 'var(--color-line-strong)'} size={11} />
                <span className="pestana__larga">{t.label}</span>
                <span className="pestana__corta" aria-hidden="true">{t.short}</span>
              </button>
            )
          })}
        </nav>
          <span className="acciones-pestana" style={{ alignSelf: 'center', display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '14px' }}>
          <span className="modo-pestana" title={current.mode} style={{
            alignSelf: 'center', display: 'flex', alignItems: 'center', gap: '6px',
            fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase',
            color: current.modeColor,
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: current.modeColor }} />
            <span className="modo-pestana__texto">{current.mode}</span>
          </span>
            <DistintivoVersion onAbrir={() => setLimitaciones(true)} />
            <BotonTerminarSesion onClick={() => setInformeAbierto(true)} />
            {/* Quién está usando la aplicación, y desde aquí se releva. */}
            <MenuPerfil
              perfil={perfil}
              onInforme={() => setInformeAbierto(true)}
              onCerrar={() => { setInformeAbierto(false); cerrarSesion() }}
              onCambiar={(nombre, rol) => { setInformeAbierto(false); cerrarSesion(); abrirSesion(nombre, operatorId, rol) }}
              onCreditos={() => setCreditos(true)} />
          </span>
        </div>
      </div>

      {/* Subsección del grupo «1 · Control Mago de Oz» (pedido del autor,
          2026-11-27): siempre a la vista mientras se está en el grupo, sin menú
          que la oculte. Las tres vistas de una sesión con el tablero físico. */}
      {EN_GRUPO.has(tab) && (
        <div className="subnav-control" style={{ flexShrink: 0, borderBottom: '1px solid var(--color-line)', background: 'var(--color-panel)' }}>
          <nav aria-label="Vistas de Control Mago de Oz" style={{
            maxWidth: '1400px', margin: '0 auto', padding: '8px 20px', boxSizing: 'border-box',
            display: 'flex', gap: '8px', alignItems: 'stretch', overflowX: 'auto',
          }}>
            {GRUPO_CONTROL.map(g => {
              const activo = g.id === tab
              return (
                <button key={g.id} type="button" aria-current={activo ? 'page' : undefined} onClick={() => setTab(g.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '1px',
                    minHeight: '44px', padding: '6px 14px', borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left',
                    flexShrink: 0,
                    background: activo ? 'color-mix(in srgb, var(--color-blue) 16%, transparent)' : 'transparent',
                    border: `1px solid ${activo ? 'var(--color-blue)' : 'var(--color-line-strong)'}`,
                    color: activo ? 'var(--color-paper)' : 'var(--color-paper-dim)',
                  }}>
                  <span style={{ fontSize: '13px', fontWeight: 700 }}>{g.nombre}</span>
                  <span style={{ fontSize: '11px', color: activo ? 'var(--color-paper-dim)' : 'var(--color-paper-faint)' }}>{g.detalle}</span>
                </button>
              )
            })}
          </nav>
        </div>
      )}

      {/* Fase 2 de la guía: cómo usar la vista abierta (se puede cerrar). */}
      <GuiaVista key={tab} vista={tab} />

      {/* Cada pestaña maneja su propio scroll interno dentro de esta región
          de altura fija — un único scrollbar visible por pestaña. Las cuatro
          quedan montadas aunque no se vean: antes se desmontaban al cambiar
          de pestaña y se perdía su bitácora. El informe general ya no
          reemplaza la pestaña: se abre encima, en una ventana emergente. */}
      <div style={{ display: tab === 'control' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <App
          operatorId={operatorId} setOperatorId={noop}
          onSnapshot={setSnapshot} />
      </div>
      <div style={{ display: tab === 'jugador' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <VistaJugador />
      </div>
      <div style={{ display: tab === 'tutorial' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <TutorialTab operatorId={operatorId} participante={participante} setParticipante={noop}
          onGoToFreeSim={() => { setSimPares(5); setTab('libre') }} />
      </div>
      <div style={{ display: tab === 'libre' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <SimulacionLibreTab operatorId={operatorId} participante={participante} setParticipante={noop}
          pares={simPares} setPares={setSimPares} />
      </div>
      <div style={{ display: tab === 'observador' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <ObservadorTab snapshot={snapshot} operatorId={operatorId} />
      </div>
      {/* Los informes guardados: la única pestaña que no mira la sesión en
          curso sino el archivo de todas las anteriores. */}
      <div style={{ display: tab === 'informes' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <InformesTab activo={tab === 'informes'} />
      </div>

      {creditos && <Creditos onCerrar={() => setCreditos(false)} />}
      {limitaciones && <Limitaciones onCerrar={() => setLimitaciones(false)} />}
      <AvisoVersionNueva onRevisar={() => setLimitaciones(true)} />

      {informeAbierto && (
        <InformeGeneral
          onCerrar={() => setInformeAbierto(false)}
          onCerrarSesion={() => { cerrarSesion(); setInformeAbierto(false) }} />
      )}
    </div>
  )
}

function AppShell() {
  return <SesionProvider><Shell /></SesionProvider>
}

export default AppShell

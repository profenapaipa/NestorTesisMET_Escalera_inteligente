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
import { ChevronsLeft, ChevronsRight, Eye, MonitorPlay, Wand2 } from 'lucide-react'

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
// tres vistas de una sesión con el tablero físico, en un riel vertical a la izquierda.
const GRUPO_CONTROL: { id: Tab; nombre: string; detalle: string; corto: string; icono: typeof Eye }[] = [
  { id: 'control', nombre: 'Control Mago de Oz', detalle: 'La consola del operador', corto: 'Control', icono: Wand2 },
  { id: 'jugador', nombre: 'Vista del jugador', detalle: 'La pantalla del participante', corto: 'Jugador', icono: MonitorPlay },
  { id: 'observador', nombre: 'Vista de observador', detalle: 'Espejo de Control, solo lectura', corto: 'Observador', icono: Eye },
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
  // Riel de las vistas de Control: expandido por defecto solo si sobra ancho
  // (la página de Control mide 1400 px); la preferencia queda en el navegador.
  const [rielAbierto, setRielAbierto] = useState<boolean>(() => {
    try { const v = localStorage.getItem('escalera.riel.control'); if (v !== null) return v === '1' } catch { /* sin almacenamiento */ }
    return window.innerWidth >= 1600
  })
  const cambiarRiel = (v: boolean) => { setRielAbierto(v); try { localStorage.setItem('escalera.riel.control', v ? '1' : '0') } catch { /* sin almacenamiento */ } }
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

      {/* Cuerpo: riel vertical del grupo «1 · Control Mago de Oz» (pedido del
          autor, 2026-11-27) a la izquierda y la vista a la derecha. El riel no
          ocupa una franja fija arriba: en pantallas anchas va expandido (ícono y
          texto) en el margen libre; en las angostas, contraído a íconos; en el
          celular, una fila de íconos arriba. */}
      <div className="cuerpo-shell" style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      {EN_GRUPO.has(tab) && (
        <nav aria-label="Vistas de Control Mago de Oz" className={`riel-control${rielAbierto ? ' riel-control--abierto' : ''}`} style={{
          flexShrink: 0, width: rielAbierto ? '196px' : '60px', transition: 'width .18s ease',
          display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px 8px',
          background: 'var(--color-panel)', borderRight: '1px solid var(--color-line)', overflowY: 'auto', boxSizing: 'border-box',
        }}>
          {GRUPO_CONTROL.map(g => {
            const activo = g.id === tab
            const Icono = g.icono
            return (
              <button key={g.id} type="button" aria-current={activo ? 'page' : undefined} aria-label={g.nombre}
                title={rielAbierto ? undefined : `${g.nombre}: ${g.detalle}`} onClick={() => setTab(g.id)}
                className="riel-control__boton"
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', minHeight: '48px', padding: '8px 10px',
                  borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left', width: '100%', boxSizing: 'border-box',
                  background: activo ? 'color-mix(in srgb, var(--color-blue) 16%, transparent)' : 'transparent',
                  border: '1px solid transparent', borderLeft: `3px solid ${activo ? 'var(--color-blue)' : 'transparent'}`,
                  color: activo ? 'var(--color-paper)' : 'var(--color-paper-dim)',
                }}>
                <Icono size={20} aria-hidden style={{ flexShrink: 0, color: activo ? 'var(--color-blue)' : 'currentColor' }} />
                {rielAbierto && (
                  <span className="riel-control__texto" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, lineHeight: 1.25 }}>{g.nombre}</span>
                    <span style={{ fontSize: '11px', color: 'var(--color-paper-faint)', lineHeight: 1.3 }}>{g.detalle}</span>
                  </span>
                )}
                {/* En el celular (fila de arriba) se ve siempre el nombre corto. */}
                <span className="riel-control__corto" aria-hidden="true">{g.corto}</span>
              </button>
            )
          })}
          <button type="button" className="riel-control__plegar" onClick={() => cambiarRiel(!rielAbierto)}
            aria-label={rielAbierto ? 'Contraer el panel de vistas' : 'Expandir el panel de vistas'}
            title={rielAbierto ? 'Contraer' : 'Expandir'}
            style={{
              marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: rielAbierto ? 'flex-start' : 'center', gap: '8px',
              minHeight: '40px', padding: '6px 10px', borderRadius: 'var(--radius)', cursor: 'pointer',
              background: 'transparent', border: '1px solid var(--color-line)', color: 'var(--color-paper-faint)', fontSize: '11px',
            }}>
            {rielAbierto ? <><ChevronsLeft size={16} aria-hidden /> Contraer</> : <ChevronsRight size={16} aria-hidden />}
          </button>
        </nav>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0 }}>
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
      </div>
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

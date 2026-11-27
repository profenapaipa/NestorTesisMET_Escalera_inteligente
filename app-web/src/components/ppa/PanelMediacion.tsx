// Mediación PPA: tres anillos (Pausar por fallas seguidas, Pensar tras
// Pausar, Actuar por tiempo sin mover). Cuando un criterio se cumple el anillo
// lleno late, sin interrumpir; el operador toca el anillo para enviar la fase
// cuando lo considera pertinente, o lo deja pasar. Debajo, el umbral de
// tiempo de Actuar, que fija el operador.
//
// T-016: es también el ÚNICO lugar para controlar los cubos desde la vista:
// además de los tres anillos incluye (si la vista lo pide) el cubo
// seleccionado y el botón «Volver a estado inicial». Antes, Control y Control
// simulado tenían además un panel «Señal PPA» con otros tres botones que hacían
// lo mismo que los anillos.
//
// Variante «banda» (2026-11-25, pedido del autor): la misma mediación como una
// franja DENTRO del panel del tablero, justo bajo los cubos. Así queda a la
// vista sin desplazarse y el aviso de una jugada inválida (con la animación de
// la regla) aparece debajo, sin empujarla. Cerca de lo que controla: el ojo y
// el puntero recorren lo mínimo entre tocar un cubo y enviar la señal.
import { useEffect, useState } from 'react'
import { PPA_HEX, PPA_LABEL, PPA_TEXT, type PPAPhase } from '../../core/ppa/ppaColors'
import { CONFIG_PPA, cargaActuar, type FasePpa } from '../../core/ppa/motorPpa'
import type { MotorPpa } from '../../core/ppa/usePpaMotor'
import { Panel, SectionTitle, Electrode } from '../../ui/brand'
import PpaChargeMeter from '../simulation/PpaChargeMeter'

// Estado del cubo seleccionado y acción «volver a estado inicial» (solo en las
// vistas con cubos por cubo: Control y Control simulado).
export interface ControlCubos {
  seleccionado: number | null
  accionActual?: PPAPhase
  // Aviso breve de «selecciona un cubo» (cuando se intentó sin seleccionar).
  avisoSinSeleccion: boolean
  textoSinSeleccion: string
  // Apaga color y vibración del cubo seleccionado (acción ya existente).
  onEstadoInicial: () => void
  autoOffS: number
}

export default function PanelMediacion({ motor, onEnviar, destinoConfirmacion, cubos, variante = 'panel' }: {
  motor: MotorPpa
  // El operador tocó el anillo de una fase: la vista enciende la señal.
  onEnviar: (fase: FasePpa) => void
  // Texto opcional sobre a qué cubo irá la señal (solo Control).
  destinoConfirmacion?: string
  cubos?: ControlCubos
  // 'panel': tarjeta propia. 'banda': franja dentro del panel del tablero.
  variante?: 'panel' | 'banda'
}) {
  const s = motor.sugerencia
  const lleno = (f: FasePpa) => s?.fase === f
  const segSinMover = Math.floor(motor.msSinMover / 1000)
  const [umbralLocal, setUmbralLocal] = useState(motor.umbralS)
  useEffect(() => { setUmbralLocal(motor.umbralS) }, [motor.umbralS])
  const fijar = () => { if (umbralLocal !== motor.umbralS) motor.ajustarUmbral(umbralLocal) }
  const titulo = (f: FasePpa) => lleno(f)
    ? `Criterio cumplido: tocar para enviar ${PPA_LABEL[f]}`
    : `Enviar ${PPA_LABEL[f]} por iniciativa del operador`
  const banda = variante === 'banda'

  const estadoCubo = cubos && (
    <div role="status" aria-live="polite" id="mediacion-cubo-sel" className="mediacion-cubo" style={{
      display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: banda ? '6px 10px' : '8px 10px',
      marginBottom: banda ? 0 : '12px', background: 'var(--color-bg)', borderRadius: 'var(--radius)', fontSize: '12px',
      border: `1px solid ${cubos.avisoSinSeleccion ? 'var(--color-offline)' : 'var(--color-line)'}`,
    }}>
      {cubos.avisoSinSeleccion ? (
        <span style={{ color: 'var(--color-offline)' }}>Selecciona un cubo del tablero antes de enviar una señal</span>
      ) : cubos.seleccionado !== null ? (
        <>
          <Electrode on />
          <span style={{ color: 'var(--color-paper-dim)' }}>{banda ? 'Cubo' : 'Cubo seleccionado:'}</span>
          <span style={{ color: 'var(--color-paper)', fontWeight: 600 }}>#{cubos.seleccionado}</span>
          {cubos.accionActual && (
            <span style={{ color: 'var(--color-paper-dim)' }}>
              {banda ? '· ' : '— acción actual: '}<span style={{ color: PPA_TEXT[cubos.accionActual], fontWeight: 600 }}>{PPA_LABEL[cubos.accionActual]}</span>
            </span>
          )}
        </>
      ) : (
        <><Electrode on={false} /><span style={{ color: 'var(--color-paper-dim)' }}>{cubos.textoSinSeleccion}</span></>
      )}
    </div>
  )

  const anillos = (
    <div className="mediacion-anillos" style={{ display: 'flex', gap: banda ? '14px' : '18px', flexWrap: 'wrap', alignItems: 'center' }}>
      <PpaChargeMeter value={motor.fallasSeguidas} max={CONFIG_PPA.fallasParaPausar} colorHex={PPA_HEX.pausar}
        label={<>Pausar<br />fallas seguidas</>} lleno={lleno('pausar')}
        onClick={() => onEnviar('pausar')} titulo={titulo('pausar')} />
      <PpaChargeMeter value={motor.pensarCargado ? 1 : 0} max={1} texto={motor.pensarCargado ? '✓' : '·'} colorHex={PPA_HEX.pensar}
        label={<>Pensar<br />tras Pausar</>} lleno={lleno('pensar')}
        onClick={() => onEnviar('pensar')} titulo={titulo('pensar')} />
      <PpaChargeMeter value={cargaActuar(motor.msSinMover, motor.umbralS)} max={1}
        texto={`${Math.min(segSinMover, motor.umbralS)}/${motor.umbralS}s`} colorHex={PPA_HEX.actuar}
        label={<>Actuar<br />tiempo sin mover</>} lleno={lleno('actuar')}
        onClick={() => onEnviar('actuar')} titulo={titulo('actuar')} />
    </div>
  )

  // En la franja, los mismos tres anillos con aspecto de botón tenue.
  const anillosBoton = banda && (
    <div className="mediacion-anillos" role="group" aria-label="Enviar una fase PPA" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
      <PpaChargeMeter boton size={40} value={motor.fallasSeguidas} max={CONFIG_PPA.fallasParaPausar} colorHex={PPA_HEX.pausar}
        label={<>Pausar<br /><span style={{ color: 'var(--color-paper-faint)' }}>fallas seguidas</span></>} lleno={lleno('pausar')}
        onClick={() => onEnviar('pausar')} titulo={titulo('pausar')} />
      <PpaChargeMeter boton size={40} value={motor.pensarCargado ? 1 : 0} max={1} texto={motor.pensarCargado ? '✓' : '·'} colorHex={PPA_HEX.pensar}
        label={<>Pensar<br /><span style={{ color: 'var(--color-paper-faint)' }}>tras Pausar</span></>} lleno={lleno('pensar')}
        onClick={() => onEnviar('pensar')} titulo={titulo('pensar')} />
      <PpaChargeMeter boton size={40} value={cargaActuar(motor.msSinMover, motor.umbralS)} max={1}
        texto={`${Math.min(segSinMover, motor.umbralS)}/${motor.umbralS}s`} colorHex={PPA_HEX.actuar}
        label={<>Actuar<br /><span style={{ color: 'var(--color-paper-faint)' }}>tiempo sin mover</span></>} lleno={lleno('actuar')}
        onClick={() => onEnviar('actuar')} titulo={titulo('actuar')} />
    </div>
  )

  const ayuda = (
    <div style={{ minHeight: '18px', marginTop: banda ? 0 : '8px', fontSize: '11px', color: 'var(--color-paper-faint)', flex: banda ? '0 1 auto' : undefined }}>
      {s ? (
        <>
          <span style={{ color: PPA_HEX[s.fase] }}>{PPA_LABEL[s.fase]}</span>: {s.motivo}. Toca el anillo para enviarla
          {destinoConfirmacion ? ` (${destinoConfirmacion.replace(/\.$/, '')})` : ''} o{' '}
          <button type="button" onClick={motor.dejarPasar}
            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-paper-dim)', textDecoration: 'underline', cursor: 'pointer', fontSize: '11px' }}>
            déjala pasar
          </button>.
        </>
      ) : 'Toca un anillo para enviar esa fase. El sistema no envía nada por su cuenta.'}
    </div>
  )

  const estadoInicial = cubos && (
    <button type="button" onClick={cubos.onEstadoInicial} aria-describedby="mediacion-cubo-sel"
      title={`Apaga el color y la vibración del cubo seleccionado y lo devuelve a su estado inicial (se apaga sola a los ${cubos.autoOffS} s)`}
      className="mediacion-reposo"
      style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '2px 8px',
        width: banda ? undefined : '100%', minHeight: '44px', marginTop: banda ? 0 : '10px',
        padding: '8px 14px', borderRadius: banda ? '14px' : 'var(--radius)', cursor: 'pointer',
        background: banda ? 'color-mix(in srgb, var(--color-paper) 5%, transparent)' : 'var(--color-panel)',
        border: '1px solid var(--color-line-strong)', color: 'var(--color-paper)',
        fontSize: banda ? '12.5px' : '13px', fontWeight: banda ? 600 : 700, opacity: cubos.seleccionado === null ? 0.6 : 1,
      }}>
      <svg width="20" height="16" viewBox="0 0 32 22" fill="none" aria-hidden="true">
        <circle cx="16" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
        <line x1="16" y1="4" x2="16" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span style={{ whiteSpace: 'nowrap' }}>Volver a estado inicial</span>
      {!banda && <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-paper-dim)' }}>apaga color y vibración · auto {cubos.autoOffS} s</span>}
    </button>
  )

  const controlUmbral = (
    <>
      <input id="umbral-actuar" type="range" min={CONFIG_PPA.actuar.minS} max={CONFIG_PPA.actuar.maxS} value={umbralLocal}
        aria-label="Umbral de Actuar en segundos"
        onChange={e => setUmbralLocal(Number(e.target.value))}
        onPointerUp={fijar} onKeyUp={fijar} onBlur={fijar}
        style={{ width: '140px', accentColor: PPA_HEX.actuar }} />
      <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>{umbralLocal} s</span>
      <span style={{ fontSize: '10px', color: 'var(--color-paper-faint)' }}>queda en la bitácora · {CONFIG_PPA.version}</span>
    </>
  )

  if (banda) {
    // Centrada bajo los cubos (2026-11-25): arriba los botones (las tres fases
    // como botones tenues de su color y «Volver a estado inicial» neutro, al
    // lado); abajo, en letra pequeña, el cubo seleccionado, la ayuda y el umbral.
    return (
      <section className="panel-mediacion mediacion-banda" aria-label={cubos ? 'Mediación y control de cubos' : 'Mediación'} style={{
        marginTop: '10px', paddingTop: '12px', borderTop: '1px solid var(--color-line)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {anillosBoton}
          {estadoInicial && <span aria-hidden="true" className="mediacion-separador" style={{ width: '1px', alignSelf: 'stretch', background: 'var(--color-line)', margin: '4px 4px' }} />}
          {estadoInicial}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px 16px', flexWrap: 'wrap', textAlign: 'center' }}>
          {estadoCubo}
          {ayuda}
          {/* El umbral se ajusta poco: queda plegado para no competir con los anillos. */}
          <details className="mediacion-umbral" style={{ fontSize: '11px', color: 'var(--color-paper-dim)' }}>
            <summary style={{ cursor: 'pointer', minHeight: '24px', display: 'inline-flex', alignItems: 'center' }}>
              Umbral de Actuar · <b style={{ fontFamily: 'var(--font-mono)', marginLeft: '4px' }}>{motor.umbralS} s</b>
            </summary>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>{controlUmbral}</div>
          </details>
        </div>
      </section>
    )
  }

  return (
    <Panel className="panel-mediacion">
      <SectionTitle>{cubos ? 'Mediación y control de cubos' : 'Mediación'}</SectionTitle>
      {estadoCubo}
      {anillos}
      {ayuda}
      {estadoInicial}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
        <label htmlFor="umbral-actuar" style={{ fontSize: '11px', color: 'var(--color-paper-dim)' }}>Umbral de Actuar</label>
        {controlUmbral}
      </div>
    </Panel>
  )
}


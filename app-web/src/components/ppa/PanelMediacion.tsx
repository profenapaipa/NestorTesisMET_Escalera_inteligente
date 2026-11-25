// Panel de mediación PPA, el mismo en Control Mago de Oz, Control simulado y
// Simulación libre: tres anillos que se llenan hacia su criterio. Un anillo
// lleno late, sin interrumpir; el operador toca el anillo para enviar la fase
// cuando lo considera pertinente, o lo deja pasar. Debajo, el umbral de
// tiempo de Actuar, que fija el operador.
//
// T-016: es también el ÚNICO lugar para controlar los cubos desde la vista:
// además de los tres anillos incluye (si la vista lo pide) el cubo
// seleccionado y el botón «Volver a estado inicial». Antes, Control y Control
// simulado tenían además un panel «Señal PPA» con otros tres botones que hacían
// lo mismo que los anillos.
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

export default function PanelMediacion({ motor, onEnviar, destinoConfirmacion, cubos }: {
  motor: MotorPpa
  // El operador tocó el anillo de una fase: la vista enciende la señal.
  onEnviar: (fase: FasePpa) => void
  // Texto opcional sobre a qué cubo irá la señal (solo Control).
  destinoConfirmacion?: string
  cubos?: ControlCubos
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

  return (
    <Panel className="panel-mediacion">
      <SectionTitle>{cubos ? 'Mediación y control de cubos' : 'Mediación'}</SectionTitle>
      {cubos && (
        <div role="status" aria-live="polite" id="mediacion-cubo-sel" style={{
          display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '8px 10px', marginBottom: '12px',
          background: 'var(--color-bg)', borderRadius: 'var(--radius)', fontSize: '12px',
          border: `1px solid ${cubos.avisoSinSeleccion ? 'var(--color-offline)' : 'var(--color-line)'}`,
        }}>
          {cubos.avisoSinSeleccion ? (
            <span style={{ color: 'var(--color-offline)' }}>Selecciona un cubo del tablero antes de enviar una señal</span>
          ) : cubos.seleccionado !== null ? (
            <>
              <Electrode on />
              <span style={{ color: 'var(--color-paper-dim)' }}>Cubo seleccionado:</span>
              <span style={{ color: 'var(--color-paper)', fontWeight: 600 }}>#{cubos.seleccionado}</span>
              {cubos.accionActual && (
                <span style={{ color: 'var(--color-paper-dim)' }}>
                  — acción actual: <span style={{ color: PPA_TEXT[cubos.accionActual], fontWeight: 600 }}>{PPA_LABEL[cubos.accionActual]}</span>
                </span>
              )}
            </>
          ) : (
            <><Electrode on={false} /><span style={{ color: 'var(--color-paper-dim)' }}>{cubos.textoSinSeleccion}</span></>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
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

      <div style={{ minHeight: '18px', marginTop: '8px', fontSize: '11px', color: 'var(--color-paper-faint)' }}>
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

      {cubos && (
        <button type="button" onClick={cubos.onEstadoInicial} aria-describedby="mediacion-cubo-sel"
          title={`Apaga el color y la vibración del cubo seleccionado y lo devuelve a su estado inicial (se apaga sola a los ${cubos.autoOffS} s)`}
          style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '2px 8px', width: '100%', minHeight: '44px',
            marginTop: '10px', padding: '8px 12px', borderRadius: 'var(--radius)', cursor: 'pointer',
            background: 'var(--color-panel)', border: '1px solid var(--color-line-strong)', color: 'var(--color-paper)',
            fontSize: '13px', fontWeight: 700, opacity: cubos.seleccionado === null ? 0.6 : 1,
          }}>
          <svg width="20" height="16" viewBox="0 0 32 22" fill="none" aria-hidden="true">
            <circle cx="16" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
            <line x1="16" y1="4" x2="16" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span style={{ whiteSpace: 'nowrap' }}>Volver a estado inicial</span>
          <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-paper-dim)' }}>apaga color y vibración · auto {cubos.autoOffS} s</span>
        </button>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
        <label htmlFor="umbral-actuar" style={{ fontSize: '11px', color: 'var(--color-paper-dim)' }}>Umbral de Actuar</label>
        <input id="umbral-actuar" type="range" min={CONFIG_PPA.actuar.minS} max={CONFIG_PPA.actuar.maxS} value={umbralLocal}
          onChange={e => setUmbralLocal(Number(e.target.value))}
          onPointerUp={fijar} onKeyUp={fijar} onBlur={fijar}
          style={{ width: '140px', accentColor: PPA_HEX.actuar }} />
        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>{umbralLocal} s</span>
        <span style={{ fontSize: '10px', color: 'var(--color-paper-faint)' }}>queda en la bitácora · {CONFIG_PPA.version}</span>
      </div>
    </Panel>
  )
}

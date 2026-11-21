// Panel de mediación PPA, el mismo en Control Mago de Oz, Control simulado y
// Simulación libre: tres anillos que se llenan hacia su criterio. Un anillo
// lleno late, sin interrumpir; el operador toca el anillo para enviar la fase
// cuando lo considera pertinente, o lo deja pasar. Debajo, el umbral de
// tiempo de Actuar, que fija el operador.
import { useEffect, useState } from 'react'
import { PPA_HEX, PPA_LABEL } from '../../core/ppa/ppaColors'
import { CONFIG_PPA, cargaActuar, type FasePpa } from '../../core/ppa/motorPpa'
import type { MotorPpa } from '../../core/ppa/usePpaMotor'
import { Panel, SectionTitle } from '../../ui/brand'
import PpaChargeMeter from '../simulation/PpaChargeMeter'

export default function PanelMediacion({ motor, onEnviar, destinoConfirmacion }: {
  motor: MotorPpa
  // El operador tocó el anillo de una fase: la vista enciende la señal.
  onEnviar: (fase: FasePpa) => void
  // Texto opcional sobre a qué cubo irá la señal (solo Control).
  destinoConfirmacion?: string
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
    <Panel>
      <SectionTitle>Mediación</SectionTitle>
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

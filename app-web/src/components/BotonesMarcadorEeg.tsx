import { useState } from 'react'
import { useSesion, type Seccion } from '../core/session/sesion'
import { CODIGOS_MARCADOR, type TipoMarcador } from '../core/control/marcadoresEeg'

// Marcadores que SOLO puede poner una persona: el intervalo de referencia sin
// tarea (el denominador de la potencia relativa a la tarea), el fin de la
// sesión y el artefacto de calibración del reloj. Los demás marcadores (inicio
// de intento, jugadas, señales…) salen solos de la bitácora.
//
// Cada pulsación queda como un evento de la sesión: sobrevive a recargar la
// página, entra en marcadores_eeg.csv y en ventanas.csv del paquete de datos, y
// vale para cualquier vista, no solo para Control.

type Manual = Extract<TipoMarcador, 'basal_inicio' | 'basal_fin' | 'calibracion' | 'sesion_fin'>

const BOTONES: { tipo: Manual; texto: string; ayuda: string }[] = [
  { tipo: 'basal_inicio', texto: 'Inicio de la línea base', ayuda: 'Empieza el intervalo de referencia sin tarea (p. ej. un minuto en reposo).' },
  { tipo: 'basal_fin', texto: 'Fin de la línea base', ayuda: 'Termina el intervalo de referencia.' },
  { tipo: 'calibracion', texto: 'Calibración (parpadeo)', ayuda: 'Márcalo justo cuando el participante o el operador parpadee con fuerza: sirve para medir el desfase del reloj contra el EEG.' },
  { tipo: 'sesion_fin', texto: 'Fin de la sesión', ayuda: 'Termina la sesión de registro del EEG.' },
]

export default function BotonesMarcadorEeg({ seccion, pares, alMarcar }: {
  seccion: Seccion
  pares: number
  // Control además lo manda al backend (bitácora en disco y reenvío al EEG).
  alMarcar?: (tipo: Manual, detalle: string) => void
}) {
  const sesion = useSesion()
  const [ultimo, setUltimo] = useState<string | null>(null)

  function marcar(tipo: Manual, texto: string) {
    const detalle = `Marcador manual: ${texto.toLowerCase()}`
    sesion.registrarEvento({ seccion, tipo, detalle, pares })
    alMarcar?.(tipo, detalle)
    setUltimo(`${texto} (código ${CODIGOS_MARCADOR[tipo]}) · ${new Date().toLocaleTimeString()}`)
  }

  return (
    <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', fontSize: '12px', color: 'var(--color-paper-dim)' }}>
      <span style={{ fontWeight: 600 }}>Marcadores para el EEG:</span>
      {BOTONES.map(b => (
        <button key={b.tipo} onClick={() => marcar(b.tipo, b.texto)} title={b.ayuda}
          style={{ fontSize: '12px', padding: '5px 10px', cursor: 'pointer', border: '1px solid var(--color-line-strong)', background: 'var(--color-panel)', color: 'var(--color-paper)', borderRadius: 'var(--radius)' }}>
          {b.texto}
        </button>
      ))}
      {ultimo && <span role="status">Último: {ultimo}</span>}
    </div>
  )
}

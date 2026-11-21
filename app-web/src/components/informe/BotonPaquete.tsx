import { useState } from 'react'
import { Package } from 'lucide-react'
import { exportarPaquete } from '../../core/session/exportarDatos'
import type { SesionParaPaquete } from '../../core/session/paqueteDatos'
import { btnDoc } from './ModalInforme'

// «Paquete de datos»: todo lo registrado y todo lo derivado de la sesión, en
// CSV y JSON con su diccionario, para reanalizarla fuera de la aplicación o
// alinearla con el EEG. Va seudonimizado: el participante y el operador viajan
// como códigos. El nombre real solo entra, en un archivo aparte, si se marca.

export default function BotonPaquete({ sesion }: { sesion: () => SesionParaPaquete }) {
  const [identidad, setIdentidad] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [estado, setEstado] = useState<{ texto: string; error: boolean } | null>(null)

  async function exportar() {
    setOcupado(true)
    try {
      const r = await exportarPaquete(sesion(), identidad)
      setEstado({
        texto: r.carpeta
          ? `Paquete de ${r.archivos} archivos guardado en la carpeta «${r.carpeta}».`
          : `Paquete de ${r.archivos} archivos descargado como .zip.`,
        error: false,
      })
    } catch (e) {
      setEstado({ texto: `No se pudo generar el paquete: ${String((e as Error)?.message ?? e)}`, error: true })
    } finally { setOcupado(false) }
  }

  return (
    <>
      <button onClick={() => void exportar()} disabled={ocupado} style={btnDoc}
        title="Todos los datos de la sesión en CSV y JSON, con diccionario de datos. Seudonimizado.">
        <Package size={13} /> {ocupado ? 'Generando…' : 'Paquete de datos'}
      </button>
      <label style={{ fontSize: '11px', alignSelf: 'center', color: 'var(--color-paper-faint)', display: 'flex', gap: '4px', alignItems: 'center' }}
        title="Añade identidad.json con el nombre real del participante y del operador. No lo compartas con el resto del paquete.">
        <input type="checkbox" checked={identidad} onChange={e => setIdentidad(e.target.checked)} />
        incluir nombres reales
      </label>
      {estado && (
        <span role="status" style={{ fontSize: '11.5px', alignSelf: 'center', color: estado.error ? 'var(--color-offline)' : 'var(--color-online)' }}>
          {estado.texto}
        </span>
      )}
    </>
  )
}

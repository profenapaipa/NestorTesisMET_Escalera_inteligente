import { construirPaquete, filasIntentosCrudas, type OpcionesPaquete, type SesionParaPaquete } from './paqueteDatos'
import { TABLAS, escribirCsv } from './diccionario'
import { codigoDeOperador, codigoDeParticipante, codigoDeSesion } from './seudonimo'
import { crearZip } from './zip'
import { escribirEnCarpeta, leerCarpeta } from './carpeta'
import { rutaDeSesion } from './respaldo'

// La parte del paquete de datos que toca el navegador: los códigos seudónimos,
// el .zip descargable y la copia en la carpeta de la sesión. Lo que construye el
// contenido es paqueteDatos.ts, que es puro y se verifica en la compilación.

export function opcionesPaquete(s: SesionParaPaquete, incluirIdentidad = false): OpcionesPaquete {
  return {
    participanteId: codigoDeParticipante(s.perfilId),
    operadorId: codigoDeOperador(s.operador),
    sesionCodigo: codigoDeSesion(s.sesionId),
    incluirIdentidad,
    agente: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  }
}

// El CSV de intentos de una sesión, numérico y con el diccionario del paquete.
// Es el que bajan los botones «CSV» de los informes.
export function csvIntentos(s: SesionParaPaquete): string {
  return escribirCsv(TABLAS.intentos, filasIntentosCrudas(s, opcionesPaquete(s)))
}

// El CSV de intentos de una sesión en curso o de un nivel: el perfil activo, los
// intentos y los eventos que se quieran incluir.
export function csvIntentosDe(
  perfil: { sesionId: string; perfilId: string; participante: string; operador: string; inicio: string } | null | undefined,
  intentos: SesionParaPaquete['intentos'], eventos: SesionParaPaquete['eventos'],
): string {
  return csvIntentos({
    sesionId: perfil?.sesionId ?? 'sin-sesion', perfilId: perfil?.perfilId ?? 'admin',
    participante: perfil?.participante ?? '', operador: perfil?.operador ?? '',
    inicio: perfil?.inicio ?? new Date().toISOString(), fin: new Date().toISOString(), intentos, eventos,
  })
}

function descargarBytes(nombre: string, bytes: Uint8Array, tipo: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: tipo }))
  const a = document.createElement('a')
  a.href = url; a.download = nombre
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export type ResultadoPaquete = { carpeta: string | null; descargado: boolean; archivos: number }

// Escribe el paquete en la carpeta de la sesión si hay una elegida y con
// permiso; si no, baja un único .zip.
export async function exportarPaquete(s: SesionParaPaquete, incluirIdentidad = false): Promise<ResultadoPaquete> {
  const opc = opcionesPaquete(s, incluirIdentidad)
  const archivos = construirPaquete(s, opc)
  const base = `paquete-datos-${opc.participanteId}-${opc.sesionCodigo}`
  const c = leerCarpeta()
  if (c.nombre && c.permiso === 'granted') {
    const ok = await escribirEnCarpeta([...rutaDeSesion(s), 'paquete-datos'], archivos.map(a => ({ nombre: a.nombre, contenido: a.contenido })))
    if (ok) return { carpeta: c.nombre, descargado: false, archivos: archivos.length }
  }
  descargarBytes(`${base}.zip`, crearZip(archivos.map(a => ({ nombre: `${base}/${a.nombre}`, contenido: a.contenido }))), 'application/zip')
  return { carpeta: null, descargado: true, archivos: archivos.length }
}

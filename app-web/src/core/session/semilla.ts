import { cargarArchivo, idDeNombre, retirarSesiones } from './perfiles'
import { importarBitacoras, leerBitacora, type BitacoraImportada } from './importar'
import { PERFILES_SIMULADOS } from './perfilesSimulados'

// Sesiones de ejemplo que vienen con la aplicación.
//
// Son SINTÉTICAS: las juega un jugador simulado con el mismo motor de reglas
// (scripts/generarSesionesSinteticas.ts, `npm run sesiones:generar`) y no
// contienen datos de ningún participante. Se cargan solas la primera vez que
// se abre la aplicación, para que el panel de informes tenga algo que mostrar
// desde el primer momento.
//
// NUNCA se incluyen aquí bitácoras reales: son datos de participantes (en su
// mayoría menores de edad) y la versión publicada las entregaría a cualquier
// visitante. Las que se incluían antes se retiraron el 2026-11-20 (ver
// PENDIENTES_TESIS.md).
//
// Condiciones: se hace UNA sola vez por navegador (queda una marca), nunca
// sobrescribe nada de quien use la aplicación, y las sesiones quedan
// señaladas como importadas. Si se borran, no vuelven.

// v4 (2026-11-20): solo los cinco perfiles simulados, con nombres que dicen
// qué ilustra cada uno (ver perfilesSimulados.ts). EJEMPLO-A y EJEMPLO-B ya no
// se cargan en la aplicación: siguen en src/assets/sesiones porque la sección
// de agregación de la tesis publica sus cifras y la auditoría las comprueba.
const MARCA = 'escalera.semilla.v4'

type Semilla = { archivo: string; participante: string; cargar: () => Promise<unknown> }

// Vite necesita las rutas escritas para empaquetar cada archivo.
const CARGAR: Record<string, () => Promise<unknown>> = {
  'perfil-experto.json': () => import('../../assets/sesiones/perfil-experto.json'),
  'perfil-desvios.json': () => import('../../assets/sesiones/perfil-desvios.json'),
  'perfil-en-bucle.json': () => import('../../assets/sesiones/perfil-en-bucle.json'),
  'perfil-erratico.json': () => import('../../assets/sesiones/perfil-erratico.json'),
  'perfil-aprendiz.json': () => import('../../assets/sesiones/perfil-aprendiz.json'),
}
const SEMILLAS: Semilla[][] = PERFILES_SIMULADOS.map(p => [{ archivo: p.archivo, participante: p.nombre, cargar: CARGAR[p.archivo] }])

// Ejemplos sintéticos de versiones anteriores (v2 y v3) que ya no se cargan o
// cambiaron de nombre. Son simulados, así que se reconocen por el inicio de
// su identificador de sesión; se retiran para que no queden duplicados.
const PREFIJOS_SINTETICOS_VIEJOS = [
  'ejemplo-a-sintetico', 'ejemplo-b-sintetico', 'sim-experto-sintetico', 'sim-desvios-sintetico',
  'sim-en-bucle-sintetico', 'sim-erratico-sintetico', 'sim-aprendiz-sintetico',
].map(x => `importada-${x}-`)

// Sesiones reales que una versión anterior (marca v1) cargaba como ejemplo y
// que quedaron guardadas en los navegadores que la abrieron. Todas las
// páginas de GitHub Pages de una misma cuenta comparten almacenamiento, así
// que también aparecían en la versión pública. Se identifican por la huella
// SHA-256 de su identificador de sesión (que incluye la hora al milisegundo),
// para no escribir aquí ningún dato de esas personas. Se retiran al arrancar.
const HUELLAS_RETIRADAS = new Set([
  'f67a47a384972459c3679615599213f53d4a41be76dd76dcfa5c35b98d7c4baa',
  'd46e2da8df0794617ec23c363ebf6e95ce5f7abd91bac50b13933dbf975b38c1',
])

async function huella(texto: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// Devuelve true si retiró algo.
export async function retirarSesionesAntiguas(): Promise<boolean> {
  try {
    const candidatas = cargarArchivo().sesiones.filter(s => s.sesionId.startsWith('importada-'))
    const ids = new Set<string>()
    for (const s of candidatas) {
      if (PREFIJOS_SINTETICOS_VIEJOS.some(p => s.sesionId.startsWith(p))) ids.add(s.sesionId)
      else if (crypto?.subtle && HUELLAS_RETIRADAS.has(await huella(s.sesionId))) ids.add(s.sesionId)
    }
    return ids.size > 0 && retirarSesiones(ids) > 0
  } catch { return false }
}

// Devuelve true si cargó algo (y por tanto hay que volver a pintar la lista
// de perfiles).
export async function sembrarSesionesDeEjemplo(): Promise<boolean> {
  let algo = await retirarSesionesAntiguas()
  try {
    if (localStorage.getItem(MARCA)) return algo
  } catch {
    return algo // sin almacenamiento no hay nada que sembrar
  }

  try {
    const yaEstan = new Set(cargarArchivo().sesiones.map(s => s.sesionId))
    for (const grupo of SEMILLAS) {
      const partes: BitacoraImportada[] = []
      for (const s of grupo) {
        const mod = await s.cargar()
        const datos = (mod as { default?: unknown }).default ?? mod
        const r = leerBitacora(s.archivo, JSON.stringify(datos))
        if (r.ok) partes.push(r.datos)
      }
      if (partes.length === 0) continue
      // Si esa sesión ya está (porque alguien la importó a mano), no se toca.
      const id = `importada-${idDeNombre(grupo[0].participante)}`
      if ([...yaEstan].some(x => x.startsWith(id))) continue
      importarBitacoras(partes, grupo[0].participante, '', true)
      algo = true
    }
  } catch { /* si algo falla, la aplicación arranca igual, solo sin ejemplos */ }

  try { localStorage.setItem(MARCA, new Date().toISOString()) } catch { /* sin almacenamiento */ }
  return algo
}

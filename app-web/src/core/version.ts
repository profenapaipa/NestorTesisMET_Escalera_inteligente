// Versión del software y marcas de tiempo precisas.
//
// La versión sigue Versionado Semántico (MAYOR.MENOR.PARCHE, semver.org) y
// sale de package.json; el commit y el instante de compilación los inyecta
// vite.config.ts. Juntos identifican exactamente con qué código se registró
// una sesión o se generó un informe, que es lo que pide la reproducibilidad.
//
// Historial de versiones: ver CHANGELOG.md en la raíz de la aplicación.

declare const __APP_VERSION__: string
declare const __APP_COMMIT__: string
declare const __APP_COMPILADO__: string

export const VERSION_APP: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0-dev'
export const COMMIT_APP: string = typeof __APP_COMMIT__ !== 'undefined' ? __APP_COMMIT__ : 'sin-commit'
export const COMPILADO_APP: string = typeof __APP_COMPILADO__ !== 'undefined' ? __APP_COMPILADO__ : ''

// Compilada desde una carpeta con cambios sin commit: el commit no contiene
// exactamente el código que corre (vite.config.ts le añade «-modificado»).
export const ARBOL_MODIFICADO: boolean = COMMIT_APP.endsWith('-modificado')

// «0.9.0+a1b2c3d»: versión y commit, la forma que se guarda en sesiones y
// paquetes. Con cambios sin commit: «0.9.0+a1b2c3d-modificado».
export const VERSION_COMPLETA = `${VERSION_APP}+${COMMIT_APP}`

const dos = (n: number) => String(n).padStart(2, '0')

// Fecha y hora local al segundo, con la zona horaria explícita:
// «2026-11-20 18:42:07 (UTC−05:00)». Sin la zona, una hora no es una marca de
// tiempo: el mismo informe abierto en otro país diría otra cosa.
export function fechaPrecisa(d: Date | string | number = new Date()): string {
  const f = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(f.getTime())) return '—'
  const off = -f.getTimezoneOffset()
  const signo = off >= 0 ? '+' : '−'
  const zona = `UTC${signo}${dos(Math.floor(Math.abs(off) / 60))}:${dos(Math.abs(off) % 60)}`
  return `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())} ${dos(f.getHours())}:${dos(f.getMinutes())}:${dos(f.getSeconds())} (${zona})`
}

// Línea para los informes: «Escalera Inteligente v0.9.0 (commit a1b2c3d)».
export function etiquetaVersion(): string {
  return ARBOL_MODIFICADO
    ? `Escalera Inteligente v${VERSION_APP} (commit ${COMMIT_APP.replace(/-modificado$/, '')} con cambios sin commit)`
    : `Escalera Inteligente v${VERSION_APP} (commit ${COMMIT_APP})`
}

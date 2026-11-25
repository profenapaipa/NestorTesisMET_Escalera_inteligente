// Efectos del cubo físico (EF=<n>) reproducidos en pantalla, paso a paso (2026-11-24, pedido del autor:
// «que funcione igual en físico y virtual»). Es copia FIEL de las tablas EFECTO_<n>_* de
// Cubo_Esclavo_v3.ino (motor de efectos no bloqueante): mismo color, misma vibración y misma duración
// en cada paso. La auditoría `npm run efectos:verificar` compara esta tabla con el firmware y falla si
// alguien cambia uno sin el otro.
//
// Convenciones del firmware: un paso con r = −1 usa el color de equipo del cubo; durMs = 0 es el paso
// final, que se mantiene (p. ej. el blanco fijo que pide volver a la posición inicial).
import { EFECTOS } from './ppaColors'

export type PasoEfecto = { rgb: [number, number, number] | 'equipo'; vib: number; durMs: number }

export const EFECTOS_CUBO: Record<number, PasoEfecto[]> = {
  [EFECTOS.CONEXION_BACK]: [{ rgb: [0, 240, 255], vib: 0, durMs: 3000 }, { rgb: 'equipo', vib: 0, durMs: 0 }],
  [EFECTOS.CONEXION_FRONT]: [{ rgb: [176, 38, 255], vib: 0, durMs: 3000 }, { rgb: 'equipo', vib: 0, durMs: 0 }],
  [EFECTOS.INVALIDO]: [{ rgb: [255, 140, 0], vib: 0.7, durMs: 1000 }, { rgb: 'equipo', vib: 0, durMs: 0 }],
  [EFECTOS.BLOQUEO]: [
    { rgb: [255, 0, 0], vib: 0.9, durMs: 500 }, { rgb: [255, 0, 0], vib: 0.65, durMs: 500 },
    { rgb: [255, 0, 0], vib: 0.4, durMs: 500 }, { rgb: [255, 0, 0], vib: 0.15, durMs: 500 },
    { rgb: [255, 255, 255], vib: 0, durMs: 0 },
  ],
  [EFECTOS.VICTORIA]: [
    { rgb: [0, 255, 0], vib: 0.6, durMs: 400 }, { rgb: [255, 215, 0], vib: 0.6, durMs: 400 },
    { rgb: [0, 255, 0], vib: 0.6, durMs: 400 }, { rgb: [255, 215, 0], vib: 0.6, durMs: 400 },
    { rgb: [255, 255, 255], vib: 0, durMs: 0 },
  ],
  // Cuenta regresiva como semáforo (2026-11-25): 3 y 2 rojo, 1 ámbar, ¡Inicia! verde; el parpadeo (apagado
  // 120 ms) hace visible el rojo también en los cubos del equipo rojo.
  [EFECTOS.CUENTA_TICK]: [{ rgb: [255, 0, 0], vib: 0, durMs: 180 }, { rgb: [0, 0, 0], vib: 0, durMs: 120 }, { rgb: 'equipo', vib: 0, durMs: 0 }],
  [EFECTOS.CUENTA_INICIA]: [{ rgb: [0, 255, 0], vib: 0, durMs: 300 }, { rgb: 'equipo', vib: 0, durMs: 0 }],
  [EFECTOS.CUENTA_AMBAR]: [{ rgb: [255, 191, 0], vib: 0, durMs: 180 }, { rgb: [0, 0, 0], vib: 0, durMs: 120 }, { rgb: 'equipo', vib: 0, durMs: 0 }],
}

/** Efecto de la cuenta regresiva para cada número (3, 2, 1, 0 = «¡Inicia!»): semáforo rojo → ámbar → verde. */
export function efectoCuenta(tick: number): number {
  return tick === 0 ? EFECTOS.CUENTA_INICIA : tick === 1 ? EFECTOS.CUENTA_AMBAR : EFECTOS.CUENTA_TICK
}

/** Color de la cuenta regresiva en pantalla: el mismo del primer paso del efecto que hace el cubo. */
export function colorCuenta(tick: number): string {
  const p = EFECTOS_CUBO[efectoCuenta(tick)][0].rgb as [number, number, number]
  return '#' + p.map(x => x.toString(16).padStart(2, '0')).join('')
}

/** Duración de la parte animada del efecto (sin el paso final, que se mantiene). */
export function duracionEfecto(n: number): number {
  return (EFECTOS_CUBO[n] ?? []).reduce((s, p) => s + p.durMs, 0)
}

const hex = ([r, g, b]: [number, number, number]) => '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')

/** Paso vigente del efecto `n` a los `ms` de iniciado. `hex` null = color de equipo. `terminado` cuando
 *  ya se llegó al paso final (que se mantiene como lo haría el cubo). */
export function pasoEfecto(n: number, ms: number): { hex: string | null; vib: number; terminado: boolean } {
  const pasos = EFECTOS_CUBO[n]
  if (!pasos?.length) return { hex: null, vib: 0, terminado: true }
  let t = Math.max(0, ms)
  for (const p of pasos) {
    if (p.durMs === 0 || t < p.durMs) {
      return { hex: p.rgb === 'equipo' ? null : hex(p.rgb), vib: p.vib, terminado: p.durMs === 0 }
    }
    t -= p.durMs
  }
  const ultimo = pasos[pasos.length - 1]
  return { hex: ultimo.rgb === 'equipo' ? null : hex(ultimo.rgb), vib: 0, terminado: true }
}

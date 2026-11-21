// Motor de mediación del ciclo Pausar–Pensar–Actuar (PPA): la lógica pura,
// sin React, que comparten Control Mago de Oz, Control simulado y Simulación
// libre.
//
// Principio (DECISIONES_PROYECTO.md, 2026-09-01 y 2026-11-20): la herramienta
// es un híbrido humano–máquina. El sistema MUESTRA cuándo se cumple cada
// criterio, de forma gráfica y discreta (un anillo que se llena), y el
// operador ENVÍA la fase cuando lo considera pertinente. Nada se activa solo
// y nada interrumpe al operador como un anuncio.
//
// Criterios (ppa-v2, 2026-11-20):
//   · Pausar: el anillo se llena con las fallas consecutivas (2).
//   · Pensar: el anillo se llena al enviar Pausar (encadenado, mismo ciclo).
//     El operador también puede enviarlo por iniciativa ante una confusión.
//   · Actuar: el anillo se llena con el TIEMPO sin mover desde la última
//     jugada, hasta un umbral en segundos que fija el operador (por defecto
//     8 s, de 2 a 30). No se calibra con latencias: el criterio es el
//     tiempo y la consideración del operador. Cada ajuste queda registrado.
//
// Registro: cuando un anillo se llena queda una «sugerencia» en la bitácora;
// si el operador envía esa fase, «confirmada»; si el juego sigue sin que la
// envíe (jugada válida, nuevo intento) o la deja pasar, «descartada». Así se
// conserva la comparación del análisis de la mediación sin pedir nada extra
// al operador. Enviar una fase con el anillo sin llenar es «iniciativa».

export type FasePpa = 'pausar' | 'pensar' | 'actuar'

export const CONFIG_PPA = {
  version: 'ppa-v2-2026-11-20',
  fallasParaPausar: 2,
  pensarEncadenadoTrasPausar: true,
  actuar: {
    // Umbral de tiempo sin mover (segundos), ajustable por el operador.
    porDefectoS: 8,
    minS: 2,
    maxS: 30,
  },
} as const

// Lleva un valor cualquiera al rango permitido del umbral, en segundos enteros.
export function acotarUmbralS(s: number): number {
  if (!Number.isFinite(s)) return CONFIG_PPA.actuar.porDefectoS
  return Math.min(CONFIG_PPA.actuar.maxS, Math.max(CONFIG_PPA.actuar.minS, Math.round(s)))
}

// Fracción del anillo de Actuar (0 a 1) para un tiempo sin mover.
export function cargaActuar(msSinMover: number, umbralS: number): number {
  if (umbralS <= 0) return 0
  return Math.max(0, Math.min(1, msSinMover / (umbralS * 1000)))
}

// Qué originó una activación: un criterio cumplido (anillo lleno) que el
// operador decidió enviar, o la iniciativa del operador sin criterio cumplido.
export type OrigenActivacion = 'sugerencia' | 'iniciativa'

export const MOTIVO_INICIATIVA: Record<FasePpa, string> = {
  pausar: 'iniciativa del operador',
  pensar: 'iniciativa del operador (señal de confusión observada)',
  actuar: 'iniciativa del operador',
}

// Motivo con que se registra una sugerencia que el operador no envió.
export const MOTIVO_NO_ENVIADA = {
  jugada: 'no enviada: el jugador siguió jugando',
  turno: 'no enviada: nuevo intento',
  dejada: 'el operador la dejó pasar',
  // Otro anillo ocupó su lugar: el operador envió otra fase, o se cumplió el
  // criterio de Pausar (dos fallas) mientras esperaba otra sugerencia. No es
  // una decisión de «no intervenir»: el análisis de la mediación no debe
  // abrir con ella una ventana del grupo «sugerida y descartada».
  reemplazada: 'no enviada: reemplazada por otra fase',
} as const

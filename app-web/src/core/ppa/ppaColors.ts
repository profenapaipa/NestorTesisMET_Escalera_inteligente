// Colores y niveles de vibración de las 3 fases PPA, en un solo lugar para
// que Control, Control simulado, el tablero (Cube.tsx) y la simulación
// jugable usen siempre el mismo valor. Pausar se cambió de azul oscuro
// (#0000ff, igual al color de reposo del equipo A — indistinguible) a un
// celeste bien diferenciado, y su vibración se subió del 20% al 45%: el
// autor reportó que el motor de moneda no llega a girar al 20% (ver
// PENDIENTES_TESIS.md, "Frecuencia de vibración de Pausar imperceptible").
// El valor exacto sigue sin calibrar contra hardware real.

export type PPAPhase = 'pausar' | 'pensar' | 'actuar'

// Duración antes de que una señal enviada se apague sola (o vuelva al
// color de reposo del equipo). Subido de 3s a 5s a pedido del autor.
export const AUTO_OFF_MS = 5000

// Fallas consecutivas necesarias para que se acumule la sugerencia de
// Pausar (ver DECISIONES_PROYECTO.md, "Criterios de activación PPA").
export const FALLAS_PARA_PAUSAR = 2

export const PPA_RGB: Record<PPAPhase, [number, number, number]> = {
  pausar: [0, 191, 255],
  pensar: [255, 255, 102],
  actuar: [0, 255, 0],
}

export const PPA_HEX: Record<PPAPhase, string> = {
  pausar: '#00bfff',
  pensar: '#e6e600',
  actuar: '#00cc44',
}

export const PPA_TEXT: Record<PPAPhase, string> = {
  pausar: '#5fd4ff',
  pensar: '#ffff66',
  actuar: '#00ff88',
}

export const PPA_VIBRATION: Record<PPAPhase, number> = {
  pausar: 0.45,
  pensar: 0.50,
  actuar: 0.80,
}

export const PPA_LABEL: Record<PPAPhase, string> = {
  pausar: 'PAUSAR',
  pensar: 'PENSAR',
  actuar: 'ACTUAR',
}

export const PPA_FRASE: Record<PPAPhase, string> = {
  pausar: '"Detente. No respondas todavía."',
  pensar: '"Analiza y busca alternativas."',
  actuar: '"La decisión está tomada."',
}

// Patrón de vibración por fase (implementado el 2026-11-20; firmware
// Cubo_Esclavo_v3 y Maestro_v3 de esa fecha, campo VP= de la orden). La
// vibración imita el patrón sonoro de la fase (core/utils/ppaTones.ts,
// playPpaFeedback), con los MISMOS tiempos, para que color, sonido y
// vibración formen un solo código y se aprenda por repetición:
//   · Pausar: dos pulsos largos (550 ms, 350 ms entre ellos, 1,2 s de reposo).
//   · Pensar: tres pulsos cortos (150 ms, separados 150 ms, 650 ms de reposo).
//   · Actuar: vibración continua, como su barrido sonoro continuo.
// `id` es el valor de VP= que interpreta el cubo (0 = continua). Los tramos
// alternan encendido/apagado empezando encendido; deben coincidir con
// VP_PAUSAR / VP_PENSAR del firmware.
export const PPA_VIB_PATTERN: Record<PPAPhase, { id: number; patron: string; tramosMs: number[] }> = {
  pausar: { id: 1, patron: 'dos pulsos largos', tramosMs: [550, 350, 550, 1200] },
  pensar: { id: 2, patron: 'tres pulsos cortos', tramosMs: [150, 150, 150, 150, 150, 650] },
  actuar: { id: 0, patron: 'continua', tramosMs: [] },
}

export const PPA_SOUND_LABEL: Record<PPAPhase, string> = {
  pausar: '250 Hz',
  pensar: 'bip-bip-bip 600 Hz',
  actuar: '600→1000 Hz',
}

// rgba(...) derivado del color real de cada fase — para que el mismo tono
// de "pausar" (celeste) se use en Control, Control simulado y la
// simulación jugable, cada uno con su propia opacidad de fondo/borde/brillo.
export function ppaRgba(a: PPAPhase, alpha: number): string {
  const [r, g, b] = PPA_RGB[a]
  return `rgba(${r},${g},${b},${alpha})`
}

// Códigos de los efectos enlatados que corren DENTRO del cubo esclavo
// (Cubo_Esclavo_v3.ino, EF=<n>): secuencias de color+vibración de varios
// pasos que el cubo ejecuta solo tras un único comando, para que la
// respuesta sea casi inmediata y no dependa de que el frontend mande
// varios comandos seguidos (ver plan "Señalización de conexión, control
// de partida y detección de movimientos"). Deben coincidir exactamente
// con el switch de iniciarEfecto() en el firmware.
export const EFECTOS = {
  CONEXION_BACK:   1, // cyberpunk azul 3s -> color de equipo (lo dispara el maestro al conectar)
  CONEXION_FRONT:  2, // cyberpunk lila 3s -> color de equipo (lo dispara el frontend al confirmar)
  INVALIDO:        3, // naranja + vibración 1s -> color de equipo
  BLOQUEO:         4, // rojo + vibración descendente -> blanco (fijo, pide reordenar)
  VICTORIA:        5, // verde/dorado festivo -> blanco (fijo, pide reordenar)
  CUENTA_TICK:     6, // destello cian breve -> color de equipo (cuenta regresiva 3,2,1)
  CUENTA_INICIA:   7, // destello verde breve -> color de equipo (¡Inicia!)
} as const

// Mismos colores que ve el cubo físico, para que el frontend pinte lo
// mismo en pantalla (requisito: lo físico y lo digital deben coincidir).
export const CYBERPUNK_BACK_HEX  = '#00f0ff'
export const CYBERPUNK_FRONT_HEX = '#b026ff'
export const INVALIDO_HEX        = '#ff8c00'
export const BLOQUEO_HEX         = '#ff0000'
export const VICTORIA_HEX        = '#00ff00'
export const BLANCO_HEX          = '#ffffff'

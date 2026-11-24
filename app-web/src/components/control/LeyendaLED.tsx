import { useId, useRef, useState, type ComponentType } from 'react'
import { PPA_RGB, PPA_VIB_PATTERN, PPA_VIBRATION, INVALIDO_HEX, type PPAPhase } from '../../core/ppa/ppaColors'
import type { AcabadoTablero3D, EstadoMuestra, TonoCubos } from './Tablero3D'

/* Leyenda «Colores del LED del cubo» (T-012, vuelta 2).
 *
 * Fuentes: firmware `Desarrollo_cubos_juego_escalera/Cubo_Esclavo_v3/Cubo_Esclavo_v3.ino` (líneas citadas en cada
 * fila: colores de equipo :644-645, sin Wi-Fi :196/:685, asentarse en el color de equipo :719, efectos EF=1..7
 * :252-264) y `src/core/ppa/ppaColors.ts` (PPA_RGB, PPA_VIB_PATTERN, INVALIDO_HEX). Los números RGB son los que recibe
 * el LED. Cada muestra es EL MISMO cubo del tablero (componente `Cubo` de Tablero3D.tsx, misma proyección y mismo
 * material del acabado activo), con su cono de luz y su vibración (solo sin movimiento reducido). */

type Grupo = 'equipo' | 'ppa' | 'partida' | 'sesion'
type Fila = {
  id: string
  grupo: Grupo
  nombre: string
  rgb: readonly [number, number, number] | null
  /** Segundo color cuando el efecto alterna (victoria, enlace). */
  rgb2?: readonly [number, number, number]
  /** Cómo se dibuja el mismo cubo del tablero en este estado. */
  muestra: EstadoMuestra
  /** Una línea: cuándo ocurre. */
  linea: string
  /** Fuente en el firmware o en el código (se ve al pasar el cursor). */
  fuente: string
}

const GRUPOS: { id: Grupo; titulo: string }[] = [
  { id: 'equipo', titulo: 'Equipo y conexión' },
  { id: 'ppa', titulo: 'Mediación PPA' },
  { id: 'partida', titulo: 'Partida' },
  { id: 'sesion', titulo: 'Sesión' },
]

const rgbHex = ([r, g, b]: readonly [number, number, number]) => `#${[r, g, b].map(n => n.toString(16).padStart(2, '0')).join('')}`
const fase = (a: PPAPhase) => PPA_RGB[a]
const patron = (a: PPAPhase) => PPA_VIB_PATTERN[a].patron
const mayus = (t: string) => `${t[0].toUpperCase()}${t.slice(1)}`
const luzFija = (rgb: readonly [number, number, number]) => ({ hex: rgbHex(rgb), patron: 'fijo' as const })
const luzPpa = (a: PPAPhase) => ({ hex: rgbHex(fase(a)), patron: a })

const FILAS: Fila[] = [
  { id: 'azul', grupo: 'equipo', nombre: 'Equipo azul', rgb: [0, 0, 255], muestra: { luz: null, equipo: 'A' }, linea: 'LED encendido en azul con el cubo conectado (1 a 5).', fuente: '.ino:644, :719' },
  { id: 'rojo', grupo: 'equipo', nombre: 'Equipo rojo', rgb: [255, 0, 0], muestra: { luz: null, equipo: 'B' }, linea: 'LED encendido en rojo con el cubo conectado (6 a 10).', fuente: '.ino:645, :719' },
  { id: 'buscando', grupo: 'equipo', nombre: 'Buscando conexión', rgb: [255, 0, 255], muestra: { luz: null, equipo: 'A', flota: true, buscando: true }, linea: 'Magenta, solo al pulsar «Buscar conexión».', fuente: '.ino:196, :685, :706' },
  { id: 'sinmaestro', grupo: 'equipo', nombre: 'Sin conexión', rgb: [0, 0, 255], muestra: { luz: null, equipo: 'A', flota: true }, linea: 'Con Wi-Fi pero el maestro no lo ve: LED de su equipo.', fuente: '.ino:719' },
  { id: 'enlace', grupo: 'equipo', nombre: 'Enlace', rgb: [0, 240, 255], rgb2: [176, 38, 255], muestra: { luz: luzFija([0, 240, 255]), equipo: 'A' }, linea: 'Cian 3 s y lila 3 s al enlazar; el 3D no lo pinta.', fuente: 'EF=1 y EF=2, .ino:252-253' },
  { id: 'apagado', grupo: 'equipo', nombre: 'LED apagado', rgb: null, muestra: { luz: null, equipo: 'B', apagado: true }, linea: 'Domo transparente.', fuente: 'decisión de Nestor, 2026-11-23' },
  { id: 'pausar', grupo: 'ppa', nombre: 'Pausar', rgb: fase('pausar'), muestra: { luz: luzPpa('pausar'), equipo: 'A' }, linea: `${mayus(patron('pausar'))}, ${Math.round(PPA_VIBRATION.pausar * 100)} %.`, fuente: 'ppaColors.ts PPA_RGB.pausar' },
  { id: 'pensar', grupo: 'ppa', nombre: 'Pensar', rgb: fase('pensar'), muestra: { luz: luzPpa('pensar'), equipo: 'A' }, linea: `${mayus(patron('pensar'))}, ${Math.round(PPA_VIBRATION.pensar * 100)} %.`, fuente: 'ppaColors.ts PPA_RGB.pensar' },
  { id: 'actuar', grupo: 'ppa', nombre: 'Actuar', rgb: fase('actuar'), muestra: { luz: luzPpa('actuar'), equipo: 'A' }, linea: `Vibración ${patron('actuar')}, ${Math.round(PPA_VIBRATION.actuar * 100)} %.`, fuente: 'ppaColors.ts PPA_RGB.actuar' },
  { id: 'invalida', grupo: 'partida', nombre: 'Jugada inválida', rgb: [255, 140, 0], muestra: { luz: { hex: INVALIDO_HEX, patron: 'invalido', etiqueta: 'Inválido' }, equipo: 'A' }, linea: 'Naranja 1 s con vibración 70 %.', fuente: `EF=3, .ino:254; ${INVALIDO_HEX}` },
  { id: 'fuera', grupo: 'partida', nombre: 'Fuera de lugar', rgb: [255, 255, 255], muestra: { luz: luzFija([255, 255, 255]), equipo: 'A' }, linea: 'Blanco antes de iniciar el intento.', fuente: 'cubeVisualState.ts:91-92' },
  { id: 'cuenta', grupo: 'partida', nombre: 'Cuenta regresiva', rgb: [0, 255, 255], muestra: { luz: luzFija([0, 255, 255]), equipo: 'A' }, linea: 'Cian 300 ms por número; verde en «¡Inicia!».', fuente: 'EF=6 y EF=7, .ino:263-264' },
  { id: 'bloqueo', grupo: 'partida', nombre: 'Bloqueo', rgb: [255, 0, 0], muestra: { luz: luzFija([255, 0, 0]), equipo: 'A' }, linea: 'Rojo 2 s y luego blanco fijo.', fuente: 'EF=4, .ino:255-258' },
  { id: 'victoria', grupo: 'partida', nombre: 'Victoria', rgb: [0, 255, 0], rgb2: [255, 215, 0], muestra: { luz: luzFija([0, 255, 0]), equipo: 'A' }, linea: 'Verde y dorado 1,6 s y luego blanco.', fuente: 'EF=5, .ino:259-262' },
  { id: 'sesion', grupo: 'sesion', nombre: 'Pausa de sesión', rgb: fase('pausar'), muestra: { luz: luzPpa('pausar'), equipo: 'B' }, linea: 'Pausar en los 10 cubos (también la pausa técnica).', fuente: 'cubeVisualState.ts:26-31, :89-91' },
]

const rgbTexto = (f: Fila) => !f.rgb ? 'sin color' : `RGB ${f.rgb.join(', ')}${f.rgb2 ? ` / ${f.rgb2.join(', ')}` : ''}`

const CLAVES: { id: string; nombre: string; colores: string[] }[] = [
  { id: 'equipo', nombre: 'Equipo', colores: ['#0000ff', '#ff0000'] },
  { id: 'pausar', nombre: 'Pausar', colores: [rgbHex(fase('pausar'))] },
  { id: 'pensar', nombre: 'Pensar', colores: [rgbHex(fase('pensar'))] },
  { id: 'actuar', nombre: 'Actuar', colores: [rgbHex(fase('actuar'))] },
  { id: 'error', nombre: 'Error', colores: [INVALIDO_HEX] },
]

type Props = {
  acabado: AcabadoTablero3D
  tono: TonoCubos
  /** Componente que dibuja el mismo cubo del tablero (Tablero3D.CuboMuestra); se recibe para evitar la importación circular. */
  Muestra: ComponentType<{ acabado: AcabadoTablero3D; tono: TonoCubos; estado: EstadoMuestra }>
}

/** Línea compacta con los colores clave y un botón que abre la leyenda completa en un diálogo modal accesible
 *  (`<dialog>`: centrado, fondo atenuado, Escape y clic fuera lo cierran y el foco vuelve al botón que lo abrió). */
export default function LeyendaLED({ acabado, tono, Muestra }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titulo = useId()
  const [abierto, setAbierto] = useState(false)
  return (
    <div className="leyenda-led" data-testid="leyenda-led">
      <div className="leyenda-led__barra" role="group" aria-label="Colores clave del LED del cubo">
        {CLAVES.map(c => (
          <span key={c.id} className="leyenda-led__muestra">
            {c.colores.map(h => <i key={h} style={{ background: h }} aria-hidden="true" />)}
            {c.nombre}
          </span>
        ))}
        <button type="button" className="leyenda-led__boton" onClick={() => { setAbierto(true); ref.current?.showModal() }}>Ver todos los colores</button>
      </div>
      <dialog
        ref={ref}
        className="leyenda-led__dialogo"
        aria-labelledby={titulo}
        onClose={() => setAbierto(false)}
        onClick={e => { if (e.target === ref.current) ref.current?.close() }}
      >
        <div className="leyenda-led__contenido">
          <button type="button" className="leyenda-led__x" aria-label="Cerrar" onClick={() => ref.current?.close()}>×</button>
          <h2 id={titulo}>Colores del LED del cubo</h2>
          <p className="leyenda-led__nota">
            Cada muestra es el mismo cubo del tablero, con el color exacto que recibe el LED (firmware Cubo_Esclavo_v3 y ppaColors.ts). Verlo en pantalla no sustituye mirar el cubo real.
          </p>
          {abierto && GRUPOS.map(gr => (
            <section key={gr.id} className="leyenda-led__grupo" aria-labelledby={`${titulo}-${gr.id}`}>
              <h3 id={`${titulo}-${gr.id}`}>{gr.titulo}</h3>
              <ul className="leyenda-led__lista">
                {FILAS.filter(f => f.grupo === gr.id).map(f => (
                  <li key={f.id} className="leyenda-led__fila" data-led-estado={f.id} title={`Fuente: ${f.fuente}`}>
                    <Muestra acabado={acabado} tono={tono} estado={f.muestra} />
                    <div>
                      <strong>{f.nombre}</strong>
                      <span className="leyenda-led__rgb">{rgbTexto(f)}</span>
                      <p>{f.linea}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <div className="leyenda-led__pie">
            <button type="button" className="leyenda-led__boton leyenda-led__boton--cerrar" onClick={() => ref.current?.close()}>Cerrar</button>
          </div>
        </div>
      </dialog>
    </div>
  )
}

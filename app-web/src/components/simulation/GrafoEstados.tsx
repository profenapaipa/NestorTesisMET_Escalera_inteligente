import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape, { type Core } from 'cytoscape'
import { buildStateGraph, type StateGraph } from '../../core/simulation/stateGraph'
import { sectionLabel, smallBtn } from '../../ui/styles'
import { MiniBoard } from './RulesCard'
import escudoUd from '../../assets/marca/escudo-ud-horizontal-negro.png?inline'
import { componerFiguraHD, descargarDataUrl, leyendaFigura, textoComoLeer, PROGRAMA, INSTITUCION } from '../informe/figuraGrafo'
import { etiquetaVersion, fechaPrecisa } from '../../core/version'

// Grafo de estados de La Escalera (el de Escalera.m / libro de Lina y Rafael)
// dibujado en vivo: todos los estados posibles para los pares elegidos, el
// Inicio, el Fin, los caminos sin retorno, la ruta del intento en curso y, a medida que
// se repiten intentos, los caminos y estados más transitados con más
// intensidad (más gruesos y más brillantes). Sirve a quien juega, al
// observador y al mago de Oz, y los mismos recorridos quedan en la bitácora
// para el análisis posterior.
//
// Las posiciones de los nodos son fijas (precalculadas con
// scripts/generarLayoutGrafos.ts) para que el dibujo sea idéntico entre
// estudiantes y sesiones.

// Margen alrededor del grafo al encuadrarlo: sin él los nodos del borde
// quedan pegados al marco y el mapa parece cortado.
const MARGEN = 34

const layouts = import.meta.glob('../../assets/GraphData/layout-n*.json', { import: 'default' }) as
  Record<string, () => Promise<number[][]>>

// Las variables se leen del propio contenedor, no de la raíz del documento:
// dentro de la hoja blanca del informe (clase .doc) los mismos nombres valen
// otros colores, y el grafo tiene que seguirlos.
function cssVar(el: Element, name: string, fallback: string) {
  const v = getComputedStyle(el).getPropertyValue(name).trim().replace(/^["']|["']$/g, '')
  return v || fallback
}

function patternOf(board: StateGraph['nodes'][number]['board']) {
  return board.map(c => (c ? c.team : '_')).join('')
}

type Palette = { blue: string; online: string; offline: string; caution: string; paper: string; bg: string }

// Los grises y la rampa de intensidad son los únicos colores propios del
// grafo (no hay token para ellos): se eligen según si el fondo es oscuro
// —la consola— o claro —la hoja del informe—, porque un cian brillante que
// resalta sobre negro desaparece sobre blanco.
type Tema = {
  nodo: string
  arista: string
  sinSalida: string
  rampaArista: [string, string]
  rampaNodo: [string, string]
  actualRelleno: string
  chipRampa: string
  textoRampa: string
  // Rutas mínimas: magenta, que contrasta con la rampa verde azulada de los
  // recorridos, el color del último recorrido y el del inicio.
  minima: string
  // Colores semánticos propios del tema. En el claro (informes, PDF y figuras
  // para publicar) se usa una paleta apta para daltonismo (Okabe e Ito, 2008)
  // en lugar de los tokens de la interfaz; en el oscuro, los tokens.
  inicio?: string
  fin?: string
  ruta?: string
  bloqueo?: string
  // «Sin salida» como círculo hueco (borde del color, relleno blanco).
  sinSalidaHueca?: boolean
}

// Colores semánticos del tema oscuro elegidos por auditoría (2026-11-20):
// el verde y el rojo de los tokens de la interfaz se confundían con
// deuteranopia (ΔE00 = 4,6); con estos, el par más cercano queda en 15,5.
const TEMA_OSCURO: Tema = {
  nodo: '#5a6b6f', arista: '#3a484b', sinSalida: '#6a4348',
  rampaArista: ['#1f7580', '#8ffcff'], rampaNodo: ['#2a9aa8', '#bffcff'],
  actualRelleno: '#ffffff', chipRampa: '#5fe0ec',
  textoRampa: 'Más repetido = más grueso y brillante',
  minima: '#bd6893',
  inicio: '#88c183', ruta: '#fbe90a', bloqueo: '#eb1a09',
}

// Tema claro: el de los informes, el PDF y las figuras descargables. Pensado
// para publicar: fondo blanco, base gris tenue que no compite, intensidad en
// una escala gris azulada que se lee también impresa en blanco y negro, y los
// colores semánticos de la paleta de Okabe e Ito (distinguibles con
// daltonismo). Cada categoría tiene además una forma o trazo propios.
//
// Auditoría de color (2026-11-20): contraste WCAG ≥ 3 contra el blanco para
// todas las marcas, y distancia CIEDE2000 ≥ 12 entre cada par de categorías
// con visión normal y simulando protanopia, deuteranopia y tritanopia
// (Machado, Oliveira y Fernandes, 2009). El naranja de Okabe e Ito no llegaba
// al contraste mínimo y, oscurecido, se confundía con el rojo: por eso el
// recorrido es ocre y el camino sin retorno, carmín. «Sin salida» es un
// círculo hueco, para no depender de un color pálido.
export const TEMA_CLARO: Tema = {
  nodo: '#b3bcc0', arista: '#cfd5d8', sinSalida: '#fc3753',
  rampaArista: ['#8597a2', '#14242d'], rampaNodo: ['#7d909b', '#14242d'],
  actualRelleno: '#14242d', chipRampa: '#3d5664',
  textoRampa: 'Más repetido = más grueso y oscuro',
  minima: '#9a1b78',
  inicio: '#009E73', fin: '#0072B2', ruta: '#8f6200', bloqueo: '#fc3753',
  sinSalidaHueca: true,
}

// Luminancia aproximada del fondo: decide qué tema usar sin que quien dibuja
// el grafo tenga que declararlo. Acepta las formas en que el navegador puede
// devolver el valor —#fff, #ffffff o rgb(255,255,255)—: el minificador de CSS
// abrevia #ffffff a #fff, y por no contemplarlo el informe en blanco estuvo
// dibujando el grafo con los grises de la consola oscura.
function esFondoClaro(color: string): boolean {
  const c = color.trim().replace(/^["']|["']$/g, '')
  let r = -1, g = -1, b = -1
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c)
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split('').map(x => x + x).join('') : hex[1]
    const n = parseInt(h, 16)
    r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255
  } else {
    const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(c)
    if (!rgb) return false
    r = Number(rgb[1]); g = Number(rgb[2]); b = Number(rgb[3])
  }
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6
}

// Hoja de estilos del grafo. `k` escala nodos y aristas (1 = tamaño al ver todo
// el grafo) y `fs` es el tamaño de letra en unidades del grafo, calculado para
// que se vea siempre de ~12 px en pantalla sea cual sea el zoom.
function buildStyle(c: Palette, t: Tema, k: number, fs: number): cytoscape.StylesheetStyle[] {
  return [
    { selector: 'node', style: { width: 3 * k, height: 3 * k, 'background-color': t.nodo, label: 'data(label)', color: c.paper, 'font-size': fs, 'font-weight': 700, 'text-valign': 'top', 'text-margin-y': -5 * k, 'text-background-color': c.bg, 'text-background-opacity': 0.85, 'text-background-padding': `${Math.max(1, fs * 0.15)}px`, 'z-index': 2 } },
    { selector: 'edge', style: { width: 1 * k, 'line-color': t.arista, 'curve-style': 'straight', opacity: 0.9, 'z-index': 1 } },
    { selector: 'node.sinsalida', style: t.sinSalidaHueca
      ? { 'background-color': '#ffffff', 'border-width': 0.9 * k, 'border-color': t.sinSalida, width: 3.6 * k, height: 3.6 * k }
      : { 'background-color': t.sinSalida } },
    { selector: 'node.bloqueo', style: { 'background-color': t.bloqueo ?? c.offline, shape: 'diamond', width: 6 * k, height: 6 * k } },
    { selector: 'node.inicio', style: { 'background-color': t.inicio ?? c.online, width: 12 * k, height: 12 * k, 'z-index': 5 } },
    { selector: 'node.fin', style: { 'background-color': t.fin ?? c.blue, width: 12 * k, height: 12 * k, 'z-index': 5 } },
    // Las dos rutas mínimas, como referencia. Van ANTES de las reglas de
    // intensidad y de recorrido para que, donde el aprendiz pasó de verdad,
    // se vea su recorrido y no la referencia: el magenta queda solo en los
    // tramos del camino más corto por los que no pasó. Discontinua, para que
    // se distinga también sin color (daltonismo, impresión en gris).
    // Además, un halo magenta debajo de cada arista de la ruta mínima: donde
    // el aprendiz pasó, la línea toma el color de su recorrido (sólida) y el
    // halo sigue marcando que ese tramo es parte de la ruta más corta. Así la
    // referencia se ve aunque haya muchos recorridos encima.
    { selector: 'edge.minima.ver', style: { 'line-color': t.minima, 'line-style': 'dashed', 'line-dash-pattern': [6 * k, 3 * k], width: 2.6 * k, opacity: 1, 'z-index': 6, 'underlay-color': t.minima, 'underlay-opacity': 0.8, 'underlay-padding': 5 * k, 'underlay-shape': 'round-rectangle' } },
    { selector: 'edge[int > 0]', style: { 'line-style': 'solid', 'line-color': `mapData(int, 0, 1, ${t.rampaArista[0]}, ${t.rampaArista[1]})`, width: `mapData(int, 0, 1, ${1.8 * k}, ${7 * k})` as unknown as number, 'z-index': 3 } },
    { selector: 'node[int > 0]', style: { 'background-color': `mapData(int, 0, 1, ${t.rampaNodo[0]}, ${t.rampaNodo[1]})`, width: `mapData(int, 0, 1, ${5 * k}, ${11 * k})` as unknown as number, height: `mapData(int, 0, 1, ${5 * k}, ${11 * k})` as unknown as number, 'z-index': 4 } },
    { selector: 'node.bloqueo[int > 0]', style: { 'background-color': t.bloqueo ?? c.offline } },
    // La ruta solo cambia el COLOR, nunca el grosor: si fijara un ancho
    // plano, un camino recorrido dos veces se vería igual que uno recorrido
    // una sola vez y se perdería justamente lo que mide la buclicidad. El
    // ancho lo sigue dando la intensidad (mapData sobre `int`), y las dos
    // reglas de abajo son el respaldo para una arista o un nodo de la ruta
    // que, por lo que sea, no quedó contado.
    { selector: 'edge.ruta', style: { 'line-style': 'solid', 'line-color': t.ruta ?? c.caution, 'z-index': 8 } },
    { selector: 'edge.ruta[int = 0]', style: { width: 4.5 * k } },
    { selector: 'node.ruta', style: { 'background-color': t.ruta ?? c.caution, 'z-index': 9 } },
    { selector: 'node.ruta[int = 0]', style: { width: 8 * k, height: 8 * k } },
    // Inicio y Fin conservan su color aunque el recorrido o la intensidad pasen
    // por ellos: la leyenda los identifica por color.
    { selector: 'node.inicio', style: { 'background-color': t.inicio ?? c.online, width: 12 * k, height: 12 * k } },
    { selector: 'node.fin', style: { 'background-color': t.fin ?? c.blue, width: 12 * k, height: 12 * k } },
    { selector: 'node.actual', style: { ...(t.inicio ? {} : { 'background-color': t.actualRelleno }), width: 16 * k, height: 16 * k, 'border-width': 3.5 * k, 'border-color': t.ruta ?? c.caution, 'z-index': 12 } },
  ] as cytoscape.StylesheetStyle[]
}

type Props = {
  pares: number
  // Recorridos de intentos ya terminados: lista de IDs de nodo, en orden.
  previos: number[][]
  // Recorrido del intento en curso (el primero es el Inicio).
  actual: number[]
  // Alto fijo en px; sin él, el grafo llena el alto de su contenedor.
  height?: number
  // El intento terminó: se vuelve a la vista completa.
  terminado?: boolean
  // Seguimiento automático de la posición actual (se apaga en el informe).
  seguimiento?: boolean
  // En el informe no hay "posición actual": se oculta la lectura en vivo y
  // queda solo el mapa con los recorridos.
  modo?: 'juego' | 'informe'
  // Acceso al lienzo para exportarlo como imagen en el informe descargable.
  onCy?: (cy: Core | null) => void
  // En los informes: datos de la figura HD descargable de este grafo.
  figura?: { titulo: string; subtitulo?: string; archivo?: string }
}

function GrafoEstados({ pares, previos, actual, height, terminado = false, seguimiento = true, modo = 'juego', onCy, figura }: Props) {
  const graph = useMemo(() => buildStateGraph(pares), [pares])
  const boxRef = useRef<HTMLDivElement>(null)
  // Zoom con el que se ve todo el grafo (base de la escala) y si la persona ya
  // movió la vista: si no la movió, el grafo se reajusta solo al cambiar el tamaño.
  const z0Ref = useRef(1)
  const touchedRef = useRef(false)
  const cyRef = useRef<Core | null>(null)
  // El aviso al exterior pasa por una referencia para que cambiar la función
  // no obligue a reconstruir el grafo entero.
  const onCyRef = useRef(onCy)
  onCyRef.current = onCy
  // Mientras la pestaña está oculta (display:none) el contenedor mide 0: no
  // se crea el lienzo. Antes las cuatro pestañas quedaban montadas y cada una
  // construía su propio grafo de hasta 2772 nodos al abrir la aplicación.
  const [visible, setVisible] = useState(false)
  const [ready, setReady] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  // Las dos rutas mínimas, dibujadas como referencia. En el informe se ven
  // de entrada; mientras se juega, no: serían la solución servida. Quien
  // acompaña la sesión (Control o el observador) puede encenderlas.
  const [verMinimas, setVerMinimas] = useState(modo === 'informe')
  // Tema efectivo (lo decide el fondo del contenedor al dibujar): la leyenda
  // de abajo tiene que usar los mismos colores que el lienzo.
  const [tema, setTema] = useState<Tema>(TEMA_OSCURO)

  // Conteos acumulados: cuántas veces se visitó cada nodo y se recorrió cada
  // arista, sumando todos los intentos (previos + el actual).
  const counts = useMemo(() => {
    const nodos = new Array<number>(graph.nodes.length + 1).fill(0)
    const aristas = new Array<number>(graph.edges.length).fill(0)
    for (const path of [...previos, actual]) {
      path.forEach((id, i) => {
        nodos[id]++
        if (i > 0) {
          const e = graph.edgeIndexOf(path[i - 1], id)
          if (e >= 0) aristas[e]++
        }
      })
    }
    return { nodos, aristas }
  }, [graph, previos, actual])

  // Espera a que el contenedor tenga tamaño (es decir, a que su pestaña esté
  // a la vista) antes de dibujar.
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const medir = () => { if (el.clientWidth > 0 && el.clientHeight > 0) setVisible(true) }
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Crear el grafo de Cytoscape al cambiar de pares.
  useEffect(() => {
    if (!visible) return
    let cancelled = false
    let cy: Core | null = null
    let ro: ResizeObserver | null = null
    setReady(false)
    const load = layouts[`../../assets/GraphData/layout-n${pares}.json`]
    load().then(pos => {
      if (cancelled || !boxRef.current) return
      const caja = boxRef.current
      // Los grafos chicos (pocos nodos) usan marcas más grandes para que se lean.
      const unit = ({ 1: 4.5, 2: 3, 3: 2, 4: 1.4 } as Record<number, number>)[pares] ?? 1
      const palette: Palette = {
        blue: cssVar(caja, '--color-blue', '#4589FF'), online: cssVar(caja, '--color-online', '#42BE65'),
        offline: cssVar(caja, '--color-offline', '#FA4D56'), caution: cssVar(caja, '--color-caution', '#F1C21B'),
        paper: cssVar(caja, '--color-paper', '#E7EDEE'), bg: cssVar(caja, '--color-bg', '#0B0F10'),
      }
      const tema = esFondoClaro(palette.bg) ? TEMA_CLARO : TEMA_OSCURO
      setTema(tema)
      cy = cytoscape({
        container: caja,
        elements: [
          ...graph.nodes.map(nd => ({
            group: 'nodes' as const,
            data: { id: `n${nd.id}`, nid: nd.id, int: 0, label: '' },
            position: { x: pos[nd.id - 1][0], y: pos[nd.id - 1][1] },
            classes: [
              nd.id === graph.inicioId ? 'inicio' : '', nd.id === graph.finId ? 'fin' : '',
              nd.bloqueo ? 'bloqueo' : nd.sinSalida ? 'sinsalida' : '',
            ].join(' '),
          })),
          ...graph.edges.map(e => ({
            group: 'edges' as const,
            data: { id: `e${e.index}`, source: `n${e.a}`, target: `n${e.b}`, int: 0 },
            classes: graph.rutasMinimas.aristas.has(e.index) ? 'minima' : '',
          })),
        ],
        layout: { name: 'preset' },
        // minZoom bajo a propósito: en un panel pequeño (el del informe) el
        // grafo de 5 pares necesita alejarse mucho para caber entero.
        autoungrabify: true, boxSelectionEnabled: false, minZoom: 0.08, maxZoom: 12, wheelSensitivity: 0.25,
        // `motionBlur` añade cuadros intermedios y `textureOnViewport` obliga
        // a un redibujo extra (la textura) cada vez que la vista se mueve: en
        // el grafo de 2772 nodos los dos sumaban, medidos, unos 270 ms por
        // jugada. Un redibujo completo cuesta ~90 ms, así que conviene hacer
        // uno solo y ninguno de más.
        motionBlur: false, textureOnViewport: false,
        style: buildStyle(palette, tema, unit, 12),
      })
      cyRef.current = cy
      onCyRef.current?.(cy)
      cy.nodes().on('mouseover', ev => setHover(ev.target.data('nid')))
      cy.nodes().on('mouseout', () => setHover(null))
      cy.getElementById(`n${graph.inicioId}`).data('label', 'Inicio')
      cy.getElementById(`n${graph.finId}`).data('label', 'Fin')
      const marcarTocado = () => { touchedRef.current = true }
      caja.addEventListener('wheel', marcarTocado, { passive: true })
      caja.addEventListener('pointerdown', marcarTocado)
      touchedRef.current = false
      ro = new ResizeObserver(() => {
        if (!cy) return
        cy.resize()
        if (!touchedRef.current) { cy.fit(undefined, MARGEN); z0Ref.current = cy.zoom() }
      })
      ro.observe(caja)
      cy.fit(undefined, MARGEN)
      // Zoom con proporción: las etiquetas conservan un tamaño fijo en pantalla
      // (12 px) y nodos/aristas crecen solo con la raíz del zoom, en vez de
      // inflarse linealmente al acercar.
      z0Ref.current = cy.zoom()
      let lastK = 1, lastFs = 0, raf = 0
      const reescalar = () => {
        raf = 0
        if (!cy) return
        const z = cy.zoom()
        const k = Math.min(1.5, Math.max(0.1, Math.sqrt(z0Ref.current / z)))
        const fs = 12 / z
        if (Math.abs(k - lastK) / lastK < 0.04 && Math.abs(fs - lastFs) / Math.max(lastFs, 1e-6) < 0.04) return
        lastK = k; lastFs = fs
        cy.style(buildStyle(palette, tema, k * unit, fs))
      }
      cy.on('zoom', () => { if (!raf) raf = requestAnimationFrame(reescalar) })
      reescalar()
      aplicadoRef.current = null // grafo nuevo: la primera pasada es completa
      setReady(true)
    })
    return () => {
      cancelled = true
      ro?.disconnect()
      cy?.destroy()
      cyRef.current = null
      onCyRef.current?.(null)
    }
  }, [graph, pares, visible])

  // Seguimiento automático: mientras el intento avanza, la vista se acerca y
  // se centra en donde está la persona; al terminar vuelve al grafo completo.
  // Se desactiva en cuanto alguien mueve la vista a mano (`touchedRef`).
  const pasosRef = useRef(0)
  // Animar el encuadre cuesta un redibujo de toda la escena por cuadro. En
  // los grafos chicos (hasta 140 estados) se ve bien y no se nota; en los de
  // 4 y 5 pares, esos ~20 cuadros por jugada eran justamente la lentitud al
  // mover una ficha —medido: 4,4 s de tareas largas en 10 jugadas frente a
  // 0,7 s sin animar—, así que ahí la vista salta de una.
  const grande = graph.nodes.length > 500
  const verTodoAnimado = (cy: Core) => {
    if (grande) cy.fit(undefined, MARGEN)
    else cy.animate({ fit: { eles: cy.elements(), padding: MARGEN } }, { duration: 320 })
  }
  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !ready || !seguimiento) return
    const pasos = actual.length
    if (pasos === pasosRef.current) return
    const retrocede = pasos < pasosRef.current
    pasosRef.current = pasos
    if (touchedRef.current) return
    if (pasos <= 1 || retrocede) { verTodoAnimado(cy); return }
    // Acercamiento por escalones: la vista se cierra en cinco pasos a lo
    // largo del intento, en vez de un poco en cada jugada. El motivo es de
    // rendimiento y es medible: cambiar el zoom obliga a recalcular la hoja
    // de estilos de los 6552 elementos del grafo grande —las etiquetas tienen
    // que conservar su tamaño en pantalla— y eso costaba ~400 ms por jugada.
    // Con escalones, la mayoría de las jugadas solo desplaza la vista (un
    // redibujo de ~90 ms) y el zoom cambia cinco veces por intento.
    const base = z0Ref.current
    const escalon = pasos < 4 ? 1 : pasos < 8 ? 2 : pasos < 14 ? 3 : pasos < 22 ? 4 : 5
    const objetivo = Math.min(base * (1 + escalon * 0.48), base * 3.4, cy.maxZoom())
    const nodo = cy.getElementById(`n${actual[actual.length - 1]}`)
    if (nodo.empty()) return
    const cambiaZoom = Math.abs(cy.zoom() - objetivo) / objetivo > 0.01
    // Si la posición ya está bien centrada y el zoom es prácticamente el
    // buscado, no se mueve la vista: así una jugada no cuesta ni un redibujo.
    const caja = cy.container()
    const rp = nodo.renderedPosition()
    const centrado = !!caja
      && rp.x > caja.clientWidth * 0.3 && rp.x < caja.clientWidth * 0.7
      && rp.y > caja.clientHeight * 0.3 && rp.y < caja.clientHeight * 0.7
    if (centrado && !cambiaZoom) return
    const q = nodo.position()
    const z = cambiaZoom ? objetivo : cy.zoom()
    const pan = { x: cy.width() / 2 - q.x * z, y: cy.height() / 2 - q.y * z }
    if (grande) {
      // Un solo cambio de vista para un solo redibujo; y si el zoom no
      // cambia, solo se desplaza (así no se recalcula la hoja de estilos).
      if (cambiaZoom) cy.viewport({ zoom: z, pan })
      else cy.pan(pan)
      return
    }
    cy.animate(cambiaZoom ? { center: { eles: nodo }, zoom: z } : { center: { eles: nodo } }, { duration: 320 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actual, ready, seguimiento])

  // Al terminar el intento, vista completa para leer el recorrido entero.
  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !ready || !terminado) return
    touchedRef.current = false
    verTodoAnimado(cy)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminado, ready])

  // Encender o apagar la referencia. Son 2·D* aristas (70 en el nivel de 5
  // pares), así que recalcular su estilo al pulsar el botón no se nota.
  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !ready) return
    cy.edges('.minima').toggleClass('ver', verMinimas)
  }, [verMinimas, ready, pares])

  // Actualizar intensidades, ruta y etiquetas.
  //
  // Solo se tocan los elementos que cambiaron. Repasar los 2772 nodos y las
  // 3780 aristas del nivel de cinco pares en cada jugada costaba del orden de
  // medio segundo —se notaba como lentitud al mover una ficha—, y en realidad
  // una jugada cambia un nodo, una arista y la marca de «estás aquí». La
  // pasada completa queda para cuando cambia la normalización (algún camino
  // alcanzó un nuevo máximo de repeticiones) o el criterio de etiquetado.
  const aplicadoRef = useRef<{
    maxN: number; maxE: number
    nodos: number[]; aristas: number[]
    ruta: Set<number>; aristasRuta: Set<number>; cur: number
  } | null>(null)

  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !ready) return
    const maxE = Math.max(2, ...counts.aristas)
    const maxN = Math.max(2, ...counts.nodos)
    const enRuta = new Set(actual)
    const aristasRuta = new Set<number>()
    for (let i = 1; i < actual.length; i++) {
      const e = graph.edgeIndexOf(actual[i - 1], actual[i])
      if (e >= 0) aristasRuta.add(e)
    }
    const cur = actual.length ? actual[actual.length - 1] : -1
    // Sin números de estado sobre los nodos: saturaban el dibujo y tapaban el
    // recorrido, que es lo que hay que mirar. Quedan los tres rótulos que
    // orientan —Inicio, Fin y dónde estás— y el número de cada posición sigue
    // disponible al pasar el cursor por encima, junto con cuántas veces se
    // pasó por ella.
    const etiquetaDe = (id: number) =>
      id === graph.inicioId ? (id === cur && modo === 'juego' ? 'Inicio · Tú' : 'Inicio')
        : id === graph.finId ? 'Fin'
          : id === cur && modo === 'juego' ? 'Tú'
            : ''

    const aplicarNodo = (id: number) => {
      const n = cy.getElementById(`n${id}`)
      if (n.empty()) return
      const c = counts.nodos[id]
      n.data('int', c > 0 ? Math.min(1, c / maxN) : 0)
      n.toggleClass('ruta', enRuta.has(id))
      n.toggleClass('actual', id === cur)
      n.data('label', etiquetaDe(id))
    }
    const aplicarArista = (i: number) => {
      const e = cy.getElementById(`e${i}`)
      if (e.empty()) return
      const c = counts.aristas[i]
      e.data('int', c > 0 ? Math.min(1, c / maxE) : 0)
      e.toggleClass('ruta', aristasRuta.has(i))
    }

    const prev = aplicadoRef.current
    const completo = !prev || prev.maxN !== maxN || prev.maxE !== maxE || false

    cy.batch(() => {
      if (completo) {
        for (let id = 1; id <= graph.nodes.length; id++) aplicarNodo(id)
        for (let i = 0; i < graph.edges.length; i++) aplicarArista(i)
        return
      }
      const nodos = new Set<number>([prev.cur, cur])
      for (let id = 1; id <= graph.nodes.length; id++) {
        if (counts.nodos[id] !== prev.nodos[id]) nodos.add(id)
      }
      for (const id of enRuta) if (!prev.ruta.has(id)) nodos.add(id)
      for (const id of prev.ruta) if (!enRuta.has(id)) nodos.add(id)
      for (const id of nodos) if (id > 0) aplicarNodo(id)

      const aristas = new Set<number>()
      for (let i = 0; i < graph.edges.length; i++) {
        if (counts.aristas[i] !== prev.aristas[i]) aristas.add(i)
      }
      for (const i of aristasRuta) if (!prev.aristasRuta.has(i)) aristas.add(i)
      for (const i of prev.aristasRuta) if (!aristasRuta.has(i)) aristas.add(i)
      for (const i of aristas) aplicarArista(i)
    })

    aplicadoRef.current = {
      maxN, maxE,
      nodos: counts.nodos, aristas: counts.aristas, ruta: enRuta, aristasRuta, cur,
    }
  }, [counts, actual, graph, ready, modo])

  const cur = actual.length ? actual[actual.length - 1] : graph.inicioId
  const nodoActual = graph.nodes[cur - 1]
  // Mínimo para ganar desde aquí, sabiendo de dónde se llegó (Regla 2).
  const distFin = graph.distFinDesde(cur, actual.length > 1 ? actual[actual.length - 2] : 0)
  const repetidos = actual.length - new Set(actual).size
  const intentos = previos.length + (actual.length > 1 ? 1 : 0)

  // Figura HD para publicar (componerFiguraHD): el grafo tal como se ve, con
  // las rutas mínimas si están visibles, en 3× y con su marco.
  const [generandoHd, setGenerandoHd] = useState(false)
  async function descargarHd() {
    const cy = cyRef.current
    if (!cy || !figura) return
    setGenerandoHd(true)
    try {
      const png = cy.png({ full: true, scale: 3, bg: '#ffffff', maxWidth: 3200 })
      const url = await componerFiguraHD({
        grafoSrc: png, escudoSrc: escudoUd, titulo: figura.titulo,
        subtitulo: figura.subtitulo ?? '', leyenda: leyendaFigura(verMinimas, enInforme),
        comoLeer: textoComoLeer({ pares, estados: graph.nodes.length, jugadas: graph.edges.length, recorridos: intentos, conRutas: verMinimas }),
        creditos: `Generada con ${etiquetaVersion()} el ${fechaPrecisa()} · ${INSTITUCION} · ${PROGRAMA}.`,
        programa: PROGRAMA,
      })
      descargarDataUrl(`${figura.archivo ?? `grafo-${pares}-pares`}${verMinimas ? '-con-rutas' : ''}-hd.png`, url)
    } finally { setGenerandoHd(false) }
  }
  const hoverNode = hover !== null ? graph.nodes[hover - 1] : null
  const enInforme = modo === 'informe'
  const pasosDibujados = [...previos, actual].reduce((a, p) => a + Math.max(0, p.length - 1), 0)

  function verTodo() {
    const cy = cyRef.current
    if (!cy) return
    touchedRef.current = false
    cy.fit(undefined, MARGEN)
    z0Ref.current = cy.zoom()
  }

  function irAMiPosicion() {
    const cy = cyRef.current
    if (!cy) return
    const nodo = cy.getElementById(`n${cur}`)
    const zoom = Math.min(4, cy.maxZoom())
    if (grande) {
      const q = nodo.position()
      cy.viewport({ zoom, pan: { x: cy.width() / 2 - q.x * zoom, y: cy.height() / 2 - q.y * zoom } })
      return
    }
    cy.animate({ center: { eles: nodo }, zoom }, { duration: 300 })
  }

  const chip = (color: string, text: string, shape: 'dot' | 'hollow' | 'diamond' | 'line' | 'dashed' = 'dot') => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--color-paper-dim)' }}>
      <span aria-hidden="true" style={{
        width: shape === 'line' || shape === 'dashed' ? '16px' : '9px', height: shape === 'line' || shape === 'dashed' ? '3px' : '9px',
        background: shape === 'hollow' ? '#ffffff' : shape === 'dashed' ? `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 6px)` : color,
        border: shape === 'hollow' ? `1.5px solid ${color}` : undefined, boxSizing: 'border-box',
        borderRadius: shape === 'dot' || shape === 'hollow' ? '50%' : '1px', transform: shape === 'diamond' ? 'rotate(45deg) scale(0.85)' : undefined,
      }} />{text}
    </span>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: height === undefined ? '100%' : undefined, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'baseline' }}>
        {enInforme ? (
          <span style={{ fontSize: '12px', color: 'var(--color-paper-dim)' }}>
            {graph.nodes.length} posiciones posibles · {intentos} {intentos === 1 ? 'recorrido' : 'recorridos'} dibujados ·
            {' '}<b style={{ color: 'var(--color-paper)', fontFamily: 'var(--font-mono)' }}>{pasosDibujados}</b> movimientos en total
          </span>
        ) : (
          <>
            <span style={{ fontSize: '12px', color: 'var(--color-paper-dim)' }}>
              Estado <b style={{ color: 'var(--color-paper)', fontFamily: 'var(--font-mono)' }}>{cur}</b> de {graph.nodes.length}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--color-paper-dim)' }}>
              a <b style={{ color: 'var(--color-paper)', fontFamily: 'var(--font-mono)' }}>{nodoActual.distInicio}</b> movimientos del inicio
            </span>
            <span style={{ fontSize: '12px', color: 'var(--color-paper-dim)' }}>
              {distFin < 0
                ? <b style={{ color: 'var(--color-offline)' }}>{nodoActual.bloqueo ? 'Camino sin retorno: bloqueo' : 'Camino sin salida'}</b>
                : <>mínimo <b style={{ color: 'var(--color-paper)', fontFamily: 'var(--font-mono)' }}>{distFin}</b> para ganar</>}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--color-paper-dim)' }}>
              {repetidos > 0 ? <>estados repetidos en este intento: <b style={{ color: 'var(--color-caution)' }}>{repetidos}</b></> : 'sin estados repetidos'}
            </span>
          </>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
          {!enInforme && <button onClick={irAMiPosicion} style={smallBtn}>Ir a mi posición</button>}
          <button onClick={() => setVerMinimas(v => !v)} style={smallBtn}
            title="Los dos recorridos más cortos posibles del Inicio al Fin. Son exactamente dos, reflejo uno del otro.">
            {verMinimas ? 'Ocultar rutas mínimas' : 'Ver rutas mínimas'}
          </button>
          <button onClick={verTodo} style={smallBtn}>Ver todo</button>
          {enInforme && figura && (
            <button onClick={() => void descargarHd()} disabled={generandoHd} style={smallBtn}
              title="Imagen PNG en alta resolución, con leyenda, cómo leerla, créditos e identidad gráfica, para incluir en un artículo o una presentación. Respeta si las rutas mínimas están visibles.">
              {generandoHd ? 'Generando…' : 'Imagen HD'}
            </button>
          )}
        </span>
      </div>

      <div style={{
        position: 'relative', border: '1px solid var(--color-line)', borderRadius: 'var(--radius)', background: 'var(--color-bg)',
        ...(height === undefined ? { flex: '1 1 0', minHeight: '240px' } : { height: `${height}px` }),
      }}>
        <div ref={boxRef} role="img" aria-label={`Grafo de estados de ${graph.nodes.length} posiciones`} style={{ position: 'absolute', inset: 0 }} />
        {!ready && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', ...sectionLabel }}>Dibujando grafo…</div>}
        {hoverNode && (
          <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'var(--color-panel)', border: '1px solid var(--color-line-strong)', borderRadius: 'var(--radius)', padding: '8px 10px', pointerEvents: 'none' }}>
            <div style={{ ...sectionLabel, marginBottom: '6px' }}>
              Estado {hoverNode.id} · visitas {counts.nodos[hoverNode.id]}
              {hoverNode.bloqueo ? ' · camino sin retorno' : hoverNode.sinSalida ? ' · sin salida' : ''}
            </div>
            <MiniBoard pattern={patternOf(hoverNode.board)} size={16} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
        {chip(tema.inicio ?? 'var(--color-online)', 'Inicio')}
        {chip(tema.fin ?? 'var(--color-blue)', 'Fin')}
        {chip(tema.ruta ?? 'var(--color-caution)', enInforme ? 'Último recorrido' : 'Intento en curso', 'line')}
        {verMinimas && chip(tema.minima, `Rutas mínimas (contorno; discontinua donde no se pasó): los ${graph.rutasMinimas.caminos} caminos más cortos (${graph.nodes[graph.finId - 1].distInicio} movimientos)`, 'dashed')}
        {chip(tema.chipRampa, tema.textoRampa, 'line')}
        {chip(tema.bloqueo ?? 'var(--color-offline)', 'Camino sin retorno', 'diamond')}
        {chip(tema.sinSalida, 'Sin salida', tema.sinSalidaHueca ? 'hollow' : 'dot')}
        <span style={{ fontSize: '11px', color: 'var(--color-paper-faint)', marginLeft: 'auto' }}>
          {intentos} intento{intentos === 1 ? '' : 's'} · rueda para zoom, arrastra para mover
        </span>
      </div>
    </div>
  )
}

export default GrafoEstados

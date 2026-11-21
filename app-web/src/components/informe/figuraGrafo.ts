// Figura HD de un grafo de estados, lista para un artículo o una tesis:
// encabezado con la identidad del proyecto y de la Universidad Distrital,
// título, el grafo, la leyenda de cada color y forma, cómo leerlo y un pie
// con los créditos, la versión del software y la fecha al segundo.
//
// `componerFiguraHD` es AUTOCONTENIDA (no usa nada de fuera): el HTML
// descargable la lleva copiada con `componerFiguraHD.toString()`, así que la
// misma figura sale desde la aplicación y desde el archivo, sin conexión.
import { TEMA_CLARO } from '../simulation/GrafoEstados'

export const PROGRAMA = 'Maestría en Educación en Tecnología · Facultad de Ciencias y Educación'
export const INSTITUCION = 'Universidad Distrital Francisco José de Caldas'

export type ItemLeyenda = { color: string; texto: string; forma: 'punto' | 'hueco' | 'linea' | 'discontinua' | 'rombo' | 'grueso' }

export type ConfigFigura = {
  grafoSrc: string // PNG del grafo (data URL)
  escudoSrc: string // escudo de la UD (data URL)
  titulo: string
  subtitulo: string
  leyenda: ItemLeyenda[]
  comoLeer: string
  creditos: string
  programa: string
}

export async function componerFiguraHD(cfg: ConfigFigura): Promise<string> {
  const cargar = (src: string) => new Promise<HTMLImageElement>((ok, mal) => {
    const im = new Image(); im.onload = () => ok(im); im.onerror = mal; im.src = src
  })
  const [g, esc] = await Promise.all([cargar(cfg.grafoSrc), cargar(cfg.escudoSrc)])
  const W = Math.max(2000, Math.min(3200, g.width + 160))
  const P = Math.round(W * 0.045)
  const ancho = W - 2 * P
  const fuente = (px: number, peso = 400) => `${peso} ${Math.round(px)}px "IBM Plex Sans", "Segoe UI", Arial, sans-serif`
  const medidor = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D
  const partir = (texto: string, px: number, max: number, peso = 400) => {
    medidor.font = fuente(px, peso)
    const lineas: string[] = []
    let l = ''
    for (const p of texto.split(' ')) {
      const prueba = l ? l + ' ' + p : p
      if (medidor.measureText(prueba).width > max && l) { lineas.push(l); l = p } else l = prueba
    }
    if (l) lineas.push(l)
    return lineas
  }
  // Tamaños relativos al ancho: la figura se ve igual a cualquier resolución.
  const fTit = W * 0.019, fSub = W * 0.0118, fTxt = W * 0.0112, fPie = W * 0.0095
  const altoCab = W * 0.062
  const escH = altoCab * 0.78, escW = esc.width * (escH / esc.height)
  const gH = g.height * (ancho / g.width)
  const tit = partir(cfg.titulo, fTit, ancho, 700)
  const sub = partir(cfg.subtitulo, fSub, ancho)
  const lee = partir(cfg.comoLeer, fTxt, ancho)
  const pie = partir(cfg.creditos, fPie, ancho)
  // Leyenda en filas.
  medidor.font = fuente(fTxt)
  const filas: { it: ItemLeyenda; x: number }[][] = [[]]
  let x = 0
  for (const it of cfg.leyenda) {
    const w = fTxt * 2.6 + medidor.measureText(it.texto).width + fTxt * 1.6
    if (x + w > ancho && x > 0) { filas.push([]); x = 0 }
    filas[filas.length - 1].push({ it, x }); x += w
  }
  const lh = (f: number) => f * 1.45
  const H = Math.round(P * 0.7 + altoCab + P * 0.35 + 6 + P * 0.55 + tit.length * lh(fTit) + sub.length * lh(fSub) + P * 0.4
    + gH + P * 0.5 + filas.length * lh(fTxt) * 1.15 + P * 0.35 + lh(fTxt) + lee.length * lh(fTxt) + P * 0.5 + pie.length * lh(fPie) + P * 0.7)

  const cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const c = cv.getContext('2d') as CanvasRenderingContext2D
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H)
  c.textBaseline = 'alphabetic'
  let y = P * 0.7

  // Encabezado: logo de la escalera + proyecto a la izquierda, escudo a la derecha.
  const lg = altoCab * 0.62, lgW = lg * 1.6, ly = y + (altoCab - lg) / 2
  c.save(); c.translate(P, ly); c.scale(lgW / 32, lg / 20)
  c.fillStyle = '#0f62fe'; c.beginPath(); c.moveTo(0, 20); c.lineTo(5.3, 20); c.lineTo(5.3, 14); c.lineTo(10.6, 14); c.lineTo(10.6, 8); c.lineTo(16, 8); c.lineTo(16, 2); c.lineTo(16, 20); c.closePath(); c.fill()
  c.fillStyle = '#da1e28'; c.beginPath(); c.moveTo(16, 2); c.lineTo(16, 8); c.lineTo(21.3, 8); c.lineTo(21.3, 14); c.lineTo(26.7, 14); c.lineTo(26.7, 20); c.lineTo(32, 20); c.lineTo(16, 20); c.closePath(); c.fill()
  c.restore()
  c.fillStyle = '#0c1315'; c.font = fuente(altoCab * 0.34, 700)
  c.fillText('Escalera Inteligente', P + lgW + altoCab * 0.25, y + altoCab * 0.48)
  c.fillStyle = '#455457'; c.font = fuente(altoCab * 0.2)
  c.fillText(cfg.programa, P + lgW + altoCab * 0.25, y + altoCab * 0.8)
  c.drawImage(esc, W - P - escW, y + (altoCab - escH) / 2, escW, escH)
  y += altoCab + P * 0.35
  c.fillStyle = '#0f62fe'; c.fillRect(P, y, ancho / 2, 6)
  c.fillStyle = '#da1e28'; c.fillRect(P + ancho / 2, y, ancho / 2, 6)
  y += 6 + P * 0.55

  // Título y subtítulo.
  c.fillStyle = '#0c1315'; c.font = fuente(fTit, 700)
  for (const l of tit) { y += fTit; c.fillText(l, P, y); y += lh(fTit) - fTit }
  c.fillStyle = '#455457'; c.font = fuente(fSub)
  for (const l of sub) { y += fSub; c.fillText(l, P, y); y += lh(fSub) - fSub }
  y += P * 0.4

  // El grafo, con un filo tenue.
  c.drawImage(g, P, y, ancho, gH)
  c.strokeStyle = '#dbe1e3'; c.lineWidth = 2; c.strokeRect(P, y, ancho, gH)
  y += gH + P * 0.5

  // Leyenda: cada categoría con su forma.
  c.font = fuente(fTxt)
  for (const fila of filas) {
    const cy = y + lh(fTxt) * 0.55
    for (const { it, x: fx } of fila) {
      const sx = P + fx, s = fTxt
      c.fillStyle = it.color; c.strokeStyle = it.color
      if (it.forma === 'punto') { c.beginPath(); c.arc(sx + s * 0.6, cy - s * 0.3, s * 0.45, 0, Math.PI * 2); c.fill() }
      else if (it.forma === 'hueco') { c.lineWidth = s * 0.16; c.beginPath(); c.arc(sx + s * 0.6, cy - s * 0.3, s * 0.38, 0, Math.PI * 2); c.stroke() }
      else if (it.forma === 'rombo') { c.beginPath(); c.moveTo(sx + s * 0.6, cy - s * 0.85); c.lineTo(sx + s * 1.1, cy - s * 0.3); c.lineTo(sx + s * 0.6, cy + s * 0.25); c.lineTo(sx + s * 0.1, cy - s * 0.3); c.closePath(); c.fill() }
      else {
        c.lineWidth = it.forma === 'grueso' ? s * 0.55 : s * 0.3
        c.setLineDash(it.forma === 'discontinua' ? [s * 0.45, s * 0.25] : [])
        c.beginPath(); c.moveTo(sx, cy - s * 0.3); c.lineTo(sx + s * 2, cy - s * 0.3); c.stroke(); c.setLineDash([])
      }
      c.fillStyle = '#0c1315'; c.fillText(it.texto, sx + s * 2.6, cy)
    }
    y += lh(fTxt) * 1.15
  }
  y += P * 0.35

  // Cómo leerlo.
  c.fillStyle = '#0c1315'; c.font = fuente(fTxt, 700)
  y += fTxt; c.fillText('Cómo leerlo', P, y); y += lh(fTxt) - fTxt
  c.fillStyle = '#26363a'; c.font = fuente(fTxt)
  for (const l of lee) { y += fTxt; c.fillText(l, P, y); y += lh(fTxt) - fTxt }
  y += P * 0.5

  // Pie: créditos, versión y fecha.
  c.fillStyle = '#dbe1e3'; c.fillRect(P, y - P * 0.25, ancho, 2)
  c.fillStyle = '#6a787b'; c.font = fuente(fPie)
  for (const l of pie) { y += fPie; c.fillText(l, P, y); y += lh(fPie) - fPie }

  return cv.toDataURL('image/png')
}

// Leyenda de la figura con los colores del tema claro (los de los informes).
export function leyendaFigura(conRutas: boolean, enInforme = true): ItemLeyenda[] {
  const t = TEMA_CLARO
  return [
    { color: t.inicio!, texto: 'Inicio', forma: 'punto' },
    { color: t.fin!, texto: 'Fin (objetivo)', forma: 'punto' },
    { color: t.ruta!, texto: enInforme ? 'Último recorrido' : 'Recorrido en curso', forma: 'linea' },
    { color: t.rampaArista[1], texto: 'Jugadas más repetidas (más gruesas y oscuras)', forma: 'grueso' },
    ...(conRutas ? [{ color: t.minima, texto: 'Rutas mínimas (contorno; discontinua donde no se pasó)', forma: 'discontinua' as const }] : []),
    { color: t.bloqueo!, texto: 'Camino sin retorno', forma: 'rombo' },
    { color: t.sinSalida, texto: 'Posición sin salida', forma: 'hueco' },
    { color: t.arista, texto: 'Jugadas posibles no recorridas', forma: 'linea' },
  ]
}

// Explicación en palabras, con los números de ese grafo.
export function textoComoLeer(o: { pares: number; estados: number; jugadas: number; recorridos: number; conRutas: boolean }): string {
  const minimo = o.pares * o.pares + 2 * o.pares
  return `Cada punto es una posición posible del tablero con ${o.pares} ${o.pares === 1 ? 'par' : 'pares'} de fichas `
    + `(${o.estados} posiciones) y cada línea, una jugada legal entre dos posiciones (${o.jugadas} jugadas posibles). `
    + `El punto verde es la posición inicial y el azul, la meta. Se dibujan ${o.recorridos} ${o.recorridos === 1 ? 'recorrido' : 'recorridos'}: `
    + 'las líneas más gruesas y oscuras son las jugadas que más se repitieron, y la ocre es el último recorrido. '
    + (o.conRutas ? `En ciruela, las rutas mínimas: los recorridos más cortos posibles (${minimo} movimientos); donde el recorrido va sobre ellas, se avanzó por el camino óptimo. ` : '')
    + 'Los rombos rojos marcan caminos sin retorno (desde ahí ya no se puede llegar a la meta) y los círculos huecos, posiciones sin ninguna salida. '
    + 'Un recorrido que vuelve a pasar por las mismas posiciones indica buclicidad; uno que se aparta de las rutas mínimas en los puntos de decisión, ramificación.'
}

// Descarga una data URL como archivo.
export function descargarDataUrl(nombre: string, url: string) {
  const a = document.createElement('a'); a.href = url; a.download = nombre
  document.body.appendChild(a); a.click(); a.remove()
}

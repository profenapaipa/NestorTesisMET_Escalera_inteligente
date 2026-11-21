import type { Core } from 'cytoscape'
import { downloadFile } from '../../core/simulation/bitacora'
import type { Balance } from './interpretar'
import { METRICAS, REFERENCIAS, NOTA_ECUACIONES } from './fuentes'
// Escudo de la UD incrustado como data URL (?inline): el informe viaja solo,
// sin pedir archivos. Versión optimizada (~9 KB) de Escudo_UD2.png.
import escudoUd from '../../assets/marca/escudo-ud-horizontal-negro.png?inline'
import { fechaPrecisa, etiquetaVersion } from '../../core/version'
import { componerFiguraHD, leyendaFigura, textoComoLeer, PROGRAMA, INSTITUCION, type ItemLeyenda } from './figuraGrafo'
import { buildStateGraph } from '../../core/simulation/stateGraph'

// Identidad del proyecto: el logotipo de la escalera (el mismo de la app,
// ui/brand.tsx) con los colores de los dos equipos.
const LOGO_SVG = `<svg width="40" height="25" viewBox="0 0 32 20" aria-hidden="true"><path d="M0,20 L5.3,20 L5.3,14 L10.6,14 L10.6,8 L16,8 L16,2 L16,20 Z" fill="#0f62fe"/><path d="M16,2 L16,8 L21.3,8 L21.3,14 L26.7,14 L26.7,20 L32,20 L16,20 Z" fill="#da1e28"/></svg>`

// Informe descargable: un único archivo .html que se abre en cualquier
// navegador, se imprime o se guarda como PDF, y se puede enviar al tutor sin
// que tenga que abrir la aplicación ni pedir ningún otro archivo.
//
// Se construye a partir de los mismos datos que se ven en pantalla (no
// copiando el DOM): las tablas se reescriben y los grafos entran como imagen
// PNG, porque un grafo de Cytoscape vive en un <canvas> y no sobrevive a una
// copia de HTML. Tipografía del sistema y estilos incrustados: el archivo no
// hace ninguna llamada a la red (regla dura #5 del proyecto).

export type TablaDoc = {
  cols: string[]
  // 'izq' para texto, 'der' para números — por columna.
  alineacion?: ('izq' | 'der')[]
  filas: (string | number)[][]
  nota?: string
}

export type SeccionDoc = {
  titulo: string
  parrafos?: string[]
  tablas?: TablaDoc[]
  // Pares etiqueta/valor, para los resúmenes de cifras.
  datos?: { etiqueta: string; valor: string; nota?: string }[]
}

// `dataUrl`: el grafo con las rutas más cortas resaltadas; `dataUrlSinRutas`:
// el mismo grafo sin resaltarlas. Con las dos, el HTML deja verlas u ocultarlas
// y el PDF se genera como se haya elegido.
export type GraficoDoc = {
  titulo: string; dataUrl: string | null; dataUrlSinRutas?: string | null; nota?: string
  // Para la figura HD: nivel del grafo y cuántos recorridos dibuja.
  pares?: number; recorridos?: number
}

// Cómo entran los grafos en el archivo: con un interruptor para ver u ocultar
// las rutas más cortas (HTML), o fijos con ellas o sin ellas (PDF).
export type OpcionesGrafos = { rutas: 'interactivo' | 'con' | 'sin'; inicialConRutas?: boolean }

// Captura un grafo de Cytoscape dos veces: con y sin las rutas más cortas
// resaltadas (clase `ver` en las aristas `.minima`, ver GrafoEstados.tsx).
// Devuelve el grafo a como estaba en pantalla.
export function imagenesGrafo(cy: Core | null | undefined): { dataUrl: string | null; dataUrlSinRutas: string | null } {
  if (!cy) return { dataUrl: null, dataUrlSinRutas: null }
  try {
    const minimas = cy.edges('.minima')
    const estaban = minimas.filter('.ver')
    // 2×: nítido en el PDF y base de la figura HD del HTML (~2000 px de ancho).
    const opc = { full: true, scale: 2, bg: '#ffffff' }
    minimas.addClass('ver')
    const con = cy.png(opc)
    minimas.removeClass('ver')
    const sin = cy.png(opc)
    estaban.addClass('ver')
    return { dataUrl: con, dataUrlSinRutas: sin }
  } catch { return { dataUrl: null, dataUrlSinRutas: null } }
}

export type DocInforme = {
  etiqueta: string // "Informe del nivel" / "Informe general de la sesión"
  titulo: string
  subtitulo?: string
  meta: { etiqueta: string; valor: string }[]
  // Balance descriptivo (sin semáforo): va primero, para quien no lea las ecuaciones.
  balance?: Balance
  sintesis: string[]
  secciones: SeccionDoc[]
  graficos: GraficoDoc[]
  // Las gráficas (barras, medidores, evolución), tal como se ven en pantalla,
  // como HTML ya armado. Ver `capturarFiguras`.
  figuras?: string[]
}

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const ESTILO = `
:root {
  color-scheme: light;
  /* Las mismas variables del tema claro de la aplicación (.doc en index.css):
     las figuras capturadas de la pantalla se pintan con ellas. */
  --color-bg: #ffffff; --color-panel: #f2f5f6; --color-line: #dbe1e3; --color-line-strong: #aeb9bc;
  --color-paper: #0c1315; --color-paper-dim: #455457; --color-paper-faint: #6a787b;
  --color-blue: #0f62fe; --color-red: #da1e28; --color-online: #198038; --color-offline: #da1e28;
  --color-caution: #8e6a00;
  --font-sans: 'IBM Plex Sans', 'Segoe UI', system-ui, -apple-system, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
  --radius: 3px;
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 28px 30px 60px; background: #ffffff; color: #0c1315;
  font-family: 'IBM Plex Sans', 'Segoe UI', system-ui, -apple-system, sans-serif;
  font-size: 13.5px; line-height: 1.6;
}
main { max-width: 1000px; margin: 0 auto; }
h1 { font-size: 22px; margin: 0 0 2px; letter-spacing: -0.01em; }
h2 { font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: #455457;
     margin: 26px 0 10px; padding-bottom: 5px; border-bottom: 1px solid #aeb9bc; }
h3 { font-size: 13px; margin: 18px 0 6px; }
.etiqueta { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #0f62fe; font-weight: 600; }
.meta { font-size: 12px; color: #455457; margin: 8px 0 0; }
.meta span { margin-right: 14px; white-space: nowrap; }
.sintesis { border-left: 3px solid #0f62fe; background: #f2f5f6; padding: 12px 16px; margin: 10px 0 4px; }
.balance { border: 2px solid #0f62fe; padding: 12px 16px; margin: 18px 0 4px; }
.balance .titular { font-size: 15px; font-weight: 600; margin: 4px 0 10px; }
.sem { font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: .06em; }
.sem-bien { color: #198038; } .sem-medio { color: #8e6a00; }
.sem-bajo { color: #da1e28; } .sem-nd { color: #6a787b; }
.sintesis p { margin: 0 0 6px; }
.sintesis p:last-child { margin-bottom: 0; }
.datos { display: flex; flex-wrap: wrap; gap: 18px 26px; margin: 10px 0 4px; }
.datos div { min-width: 110px; }
.datos .k { font-size: 10px; letter-spacing: 0.09em; text-transform: uppercase; color: #6a787b; }
.datos .n { font-size: 11px; color: #6a787b; line-height: 1.35; margin-top: 2px; max-width: 200px; }
.datos .v { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 18px; font-weight: 700; }
table { width: 100%; border-collapse: collapse; margin: 8px 0 4px; font-size: 12px; }
/* Sin versalitas: en mayúsculas, la ν de retornos se vuelve N y la μ de
   bucles, M. */
th { text-align: right; font-size: 11px; letter-spacing: 0.04em; color: #6a787b;
     border-bottom: 1px solid #aeb9bc; padding: 5px 7px; white-space: nowrap; }
td { text-align: right; padding: 6px 7px; border-top: 1px solid #dbe1e3;
     font-family: 'IBM Plex Mono', ui-monospace, monospace; }
th.izq, td.izq { text-align: left; font-family: inherit; }
.nota { font-size: 11px; color: #6a787b; margin: 6px 0 0; }
.fig { margin: 14px 0 0; page-break-inside: avoid; }
/* Las figuras capturadas de la pantalla traen sus propios estilos en línea; solo hay que
   impedir que las reglas generales de <figure> y <figcaption> las pisen. */
.fig figure { margin: 0; }
.fig figcaption { font-size: inherit; color: inherit; margin-top: 0; }
.fig svg { max-width: 100%; height: auto; }
figure { margin: 14px 0 0; page-break-inside: avoid; }
figure img { width: 100%; height: auto; border: 1px solid #dbe1e3; border-radius: 3px; background: #fff; }
figcaption { font-size: 11px; color: #6a787b; margin-top: 5px; }
.falta { font-size: 12px; color: #6a787b; font-style: italic; }
button.hd { margin-left: 6px; font: 600 11px 'IBM Plex Sans', 'Segoe UI', sans-serif; padding: 3px 8px; cursor: pointer;
  border: 1px solid #aeb9bc; border-radius: 3px; background: #fff; color: #0f62fe; }
.conmutador { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 600; margin: 4px 0 6px; cursor: pointer;
  border: 1px solid #aeb9bc; border-radius: 3px; padding: 6px 10px; background: #f2f5f6; }
.conmutador span { font-weight: 400; color: #6a787b; }
.conmutador input { accent-color: #9a1b78; width: 15px; height: 15px; }
body.sin-rutas img.g-con, body:not(.sin-rutas) img.g-sin { display: none; }
body.sin-rutas .ley-rutas, body.sin-rutas .leer-con, body:not(.sin-rutas) .leer-sin { display: none; }
.ley-grafo { border: 1px solid #dbe1e3; border-top: none; border-radius: 0 0 3px 3px; padding: 8px 12px 10px; background: #fafbfb; }
.ley-titulo { font-size: 10px; letter-spacing: .09em; text-transform: uppercase; color: #6a787b; font-weight: 600; margin: 4px 0 4px; }
.ley-items { display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 11.5px; color: #0c1315; }
.ley-item { display: inline-flex; align-items: center; gap: 6px; }
.ley-grafo .leer { font-size: 11.5px; line-height: 1.5; color: #26363a; margin: 0; }
figure.grafo img { border-radius: 3px 3px 0 0; }
@media print { .ley-grafo { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
.refs { font-size: 12px; line-height: 1.6; color: #455457; padding-left: 20px; margin: 8px 0 0; }
.refs li { margin-bottom: 4px; }
footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #dbe1e3; font-size: 11px; color: #6a787b; }
/* Encabezado institucional: proyecto a la izquierda, universidad a la derecha,
   y la franja azul/roja de los dos equipos debajo. */
.marca { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding-bottom: 12px; }
.marca .proyecto { display: flex; align-items: center; gap: 10px; }
.marca .nombre { font-size: 17px; font-weight: 700; letter-spacing: -0.01em; line-height: 1.1; }
.marca .programa { font-size: 10.5px; color: #455457; line-height: 1.35; margin-top: 2px; }
.marca .ud { height: 46px; width: auto; display: block; }
.franja { height: 4px; background: linear-gradient(90deg, #0f62fe 0 50%, #da1e28 50% 100%); margin: 0 0 22px; border-radius: 2px; }
.pie-marca { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.pie-marca img { height: 26px; width: auto; opacity: .85; }
td:not(.izq) { white-space: nowrap; }
@media (max-width: 640px) {
  body { padding: 18px 16px 40px; }
  .meta span { white-space: normal; display: inline-block; }
  table { display: block; overflow-x: auto; }
  .marca { flex-direction: column; align-items: flex-start; }
  .marca .ud { height: 38px; }
}
@media print {
  body { padding: 0; font-size: 10.5pt; }
  main { max-width: none; }
  .conmutador, button.hd { display: none; }
  h2 { page-break-after: avoid; break-after: avoid; }
  table, figure, .fig, .balance, .datos { page-break-inside: avoid; break-inside: avoid; }
  .franja, .sintesis, .balance { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  /* A4 con número de página e institución en el margen inferior. */
  @page {
    size: A4; margin: 16mm 15mm 18mm;
    @bottom-left { content: "Escalera Inteligente · ${INSTITUCION}"; font: 8pt 'IBM Plex Sans', 'Segoe UI', sans-serif; color: #6a787b; }
    @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 8pt 'IBM Plex Sans', 'Segoe UI', sans-serif; color: #6a787b; }
  }
}
`

function tablaHtml(t: TablaDoc): string {
  const clase = (i: number) => ((t.alineacion?.[i] ?? 'der') === 'izq' ? ' class="izq"' : '')
  const encabezado = t.cols.map((c, i) => `<th${clase(i)}>${esc(c)}</th>`).join('')
  const cuerpo = t.filas.map(f => `<tr>${f.map((v, i) => `<td${clase(i)}>${esc(v)}</td>`).join('')}</tr>`).join('\n')
  return `<table><thead><tr>${encabezado}</tr></thead><tbody>\n${cuerpo}\n</tbody></table>`
    + (t.nota ? `<p class="nota">${esc(t.nota)}</p>` : '')
}

function muestraSvg(it: ItemLeyenda): string {
  const c = it.color
  const cuerpo = it.forma === 'punto' ? `<circle cx="13" cy="7" r="5" fill="${c}"/>`
    : it.forma === 'hueco' ? `<circle cx="13" cy="7" r="4.2" fill="#fff" stroke="${c}" stroke-width="1.8"/>`
    : it.forma === 'rombo' ? `<path d="M13 1.5 L18.5 7 L13 12.5 L7.5 7 Z" fill="${c}"/>`
    : it.forma === 'grueso' ? `<line x1="2" y1="7" x2="24" y2="7" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`
    : it.forma === 'discontinua' ? `<line x1="2" y1="7" x2="24" y2="7" stroke="${c}" stroke-opacity="0.35" stroke-width="7"/><line x1="2" y1="7" x2="24" y2="7" stroke="${c}" stroke-width="2.4" stroke-dasharray="4 2.5"/>`
    : `<line x1="2" y1="7" x2="24" y2="7" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/>`
  return `<svg width="26" height="14" viewBox="0 0 26 14" aria-hidden="true">${cuerpo}</svg>`
}

// Nomenclatura de un grafo: cada color y forma con su significado, y cómo
// leerlo. Va debajo de cada grafo, como los ejes de una gráfica.
function leyendaGrafoHtml(g: GraficoDoc, modo: 'interactivo' | 'con' | 'sin'): string {
  if (!g.pares) return ''
  const st = buildStateGraph(g.pares)
  const base = { pares: g.pares, estados: st.nodes.length, jugadas: st.edges.length, recorridos: g.recorridos ?? 0 }
  const items = leyendaFigura(modo !== 'sin').map(it => {
    const rutas = it.forma === 'discontinua'
    return `<span class="ley-item${rutas && modo === 'interactivo' ? ' ley-rutas' : ''}">${muestraSvg(it)}${esc(it.texto)}</span>`
  }).join('')
  const leer = modo === 'interactivo'
    ? `<p class="leer leer-con">${esc(textoComoLeer({ ...base, conRutas: true }))}</p><p class="leer leer-sin">${esc(textoComoLeer({ ...base, conRutas: false }))}</p>`
    : `<p class="leer">${esc(textoComoLeer({ ...base, conRutas: modo === 'con' }))}</p>`
  return `<div class="ley-grafo"><div class="ley-titulo">Nomenclatura</div><div class="ley-items">${items}</div><div class="ley-titulo">Cómo leerlo</div>${leer}</div>`
}

export function construirHtml(doc: DocInforme, grafos: OpcionesGrafos = { rutas: 'interactivo', inicialConRutas: true }): string {
  const generado = fechaPrecisa()
  const secciones = doc.secciones.map(s => {
    const partes: string[] = [`<h2>${esc(s.titulo)}</h2>`]
    if (s.datos?.length) {
      partes.push('<div class="datos">' + s.datos.map(d =>
        `<div><div class="k">${esc(d.etiqueta)}</div><div class="v">${esc(d.valor)}</div>${d.nota ? `<div class="n">${esc(d.nota)}</div>` : ''}</div>`).join('') + '</div>')
    }
    for (const p of s.parrafos ?? []) partes.push(`<p>${esc(p)}</p>`)
    for (const t of s.tablas ?? []) partes.push(tablaHtml(t))
    return partes.join('\n')
  }).join('\n')

  // Gráficas capturadas de la pantalla. Van antes de los grafos de estados,
  // en el mismo orden que el informe en pantalla.
  const figuras = doc.figuras?.length
    ? '<h2>Figuras</h2>\n' + doc.figuras.map(f => `<div class="fig">${f}</div>`).join('\n')
    : ''

  // Grafos de estados: en el HTML, un interruptor muestra u oculta las rutas
  // más cortas (cada grafo va dos veces, con y sin ellas); en el PDF, fijos.
  const interactivo = grafos.rutas === 'interactivo' && doc.graficos.some(g => g.dataUrl && g.dataUrlSinRutas)
  const leyendaRutas = grafos.rutas === 'con' ? ' Las rutas más cortas aparecen con contorno ciruela (línea discontinua donde nadie pasó).'
    : grafos.rutas === 'sin' ? ' Sin resaltar las rutas más cortas.' : ''
  const imgGrafo = (g: GraficoDoc) => {
    const alt = esc(g.titulo)
    if (interactivo && g.dataUrl && g.dataUrlSinRutas) {
      return `<img class="g-con" alt="${alt}" src="${g.dataUrl}"><img class="g-sin" alt="${alt}" src="${g.dataUrlSinRutas}">`
    }
    const src = grafos.rutas === 'sin' ? (g.dataUrlSinRutas ?? g.dataUrl) : g.dataUrl
    return `<img alt="${alt}" src="${src}">`
  }
  const conmutador = interactivo
    ? `<label class="conmutador"><input type="checkbox" ${grafos.inicialConRutas === false ? '' : 'checked'} onchange="document.body.classList.toggle('sin-rutas', !this.checked)"> Resaltar las rutas más cortas en los grafos <span>(interactivo: se puede activar o desactivar)</span></label>`
    : ''
  // Datos de cada figura HD (la misma composición que en la aplicación).
  const figurasHd = doc.graficos.map(g => {
    if (!g.pares) return null
    const st = buildStateGraph(g.pares)
    const base = { pares: g.pares, estados: st.nodes.length, jugadas: st.edges.length, recorridos: g.recorridos ?? 0 }
    return {
      titulo: g.titulo.replace(/^Figura \d+\.\s*/, ''), subtitulo: doc.titulo,
      leerCon: textoComoLeer({ ...base, conRutas: true }), leerSin: textoComoLeer({ ...base, conRutas: false }),
      leyendaCon: leyendaFigura(true), leyendaSin: leyendaFigura(false),
      creditos: `Generada con ${etiquetaVersion()} el ${generado} · ${INSTITUCION} · ${PROGRAMA}.`,
      programa: PROGRAMA, archivo: `grafo-${g.pares}-pares-${doc.graficos.indexOf(g) + 1}`,
    }
  })
  const guionFiguras = figurasHd.some(Boolean) ? `<script>
const FIGURAS = ${JSON.stringify(figurasHd).replace(/</g, '\\u003c')};
const componerFigura = (${componerFiguraHD.toString()});
function figuraHD(i) {
  const f = FIGURAS[i]; if (!f) return;
  const fig = document.querySelector('figure.grafo[data-i="' + i + '"]'); if (!fig) return;
  const con = !document.body.classList.contains('sin-rutas');
  const img = fig.querySelector(con ? 'img.g-con' : 'img.g-sin') || fig.querySelector('img');
  const conRutas = !!fig.querySelector('img.g-con') ? con : ${grafos.rutas !== 'sin'};
  componerFigura({ grafoSrc: img.src, escudoSrc: document.querySelector('.marca .ud').src, titulo: f.titulo, subtitulo: f.subtitulo,
    leyenda: conRutas ? f.leyendaCon : f.leyendaSin, comoLeer: conRutas ? f.leerCon : f.leerSin, creditos: f.creditos, programa: f.programa })
    .then(function (url) { const a = document.createElement('a'); a.href = url; a.download = f.archivo + (conRutas ? '-con-rutas' : '') + '-hd.png'; document.body.appendChild(a); a.click(); a.remove(); });
}
</script>` : ''
  const graficos = doc.graficos.length === 0 ? '' : `<h2>Grafos de estados</h2>\n${conmutador}\n` + doc.graficos.map((g, i) => (
    g.dataUrl
      // data-i = índice en doc.graficos (el mismo de FIGURAS): si un grafo anterior
      // no se capturó, contar los figure.grafo apuntaría a la figura equivocada.
      ? `<figure class="grafo" data-i="${i}">${imgGrafo(g)}<figcaption>${esc(g.titulo)}${g.nota ? ' — ' + esc(g.nota) : ''}${leyendaRutas}`
        + (g.pares ? ` <button type="button" class="hd" onclick="figuraHD(${i})">Descargar imagen HD</button>` : '')
        + `</figcaption>${leyendaGrafoHtml(g, interactivo ? 'interactivo' : grafos.rutas === 'sin' ? 'sin' : 'con')}</figure>`
      : `<figure><figcaption class="falta">${esc(g.titulo)} — el grafo no se pudo incluir (estaba oculto al descargar).</figcaption></figure>`
  )).join('\n')

  // El archivo viaja solo: lleva la lectura en palabras, las ecuaciones con
  // su número en la tesis y las referencias completas.
  const comoLeer = tablaHtml({
    cols: ['Símbolo', 'Métrica', 'Qué mide', 'Cómo se lee un valor'],
    alineacion: ['izq', 'izq', 'izq', 'izq'],
    filas: METRICAS.map(m => [m.simbolo, m.nombre, m.queMide, m.ejemplo]),
    nota: 'Esta tabla basta para interpretar todo el informe. Las fórmulas están debajo, para quien las necesite.',
  })
  const ecuaciones = tablaHtml({
    cols: ['Símbolo', 'Ecuación', 'En la tesis', 'Procedencia'],
    alineacion: ['izq', 'izq', 'der', 'izq'],
    filas: METRICAS.map(m => [m.simbolo, m.ecuacion, m.numero ?? '—', m.fuente]),
    nota: NOTA_ECUACIONES,
  })
  const referencias = '<ol class="refs">' + REFERENCIAS.map(r => `<li>${esc(r)}</li>`).join('') + '</ol>'

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(doc.etiqueta)} · ${esc(doc.titulo)}</title>
<style>${ESTILO}</style>
</head>
<body${interactivo && grafos.inicialConRutas === false ? ' class="sin-rutas"' : ''}>
<main>
<header class="marca">
<div class="proyecto">${LOGO_SVG}<div><div class="nombre">Escalera Inteligente</div><div class="programa">${esc(PROGRAMA)}</div></div></div>
<img class="ud" src="${escudoUd}" alt="${esc(INSTITUCION)}">
</header>
<div class="franja"></div>
<div class="etiqueta">${esc(doc.etiqueta)}</div>
<h1>${esc(doc.titulo)}</h1>
${doc.subtitulo ? `<p class="meta">${esc(doc.subtitulo)}</p>` : ''}
<p class="meta">${doc.meta.map(m => `<span><b>${esc(m.etiqueta)}:</b> ${esc(m.valor)}</span>`).join('')}</p>
${doc.balance ? `<div class="balance">
<div class="etiqueta">Balance general · lo esencial en una mirada</div>
<p class="titular">${esc(doc.balance.titular)}</p>
${doc.balance.indicadores.length ? tablaHtml({
  cols: ['Indicador', 'Valor', 'Lectura'],
  alineacion: ['izq', 'der', 'izq'],
  filas: doc.balance.indicadores.map(i => [i.nombre, i.valor, i.lectura]),
}) : ''}
</div>` : ''}
<h2>Síntesis</h2>
<div class="sintesis">${doc.sintesis.map(f => `<p>${esc(f)}</p>`).join('')}</div>
${secciones}
${figuras}
${graficos}
${guionFiguras}
<h2>Cómo leer las métricas</h2>
${comoLeer}
<h2>Ecuaciones y de dónde salen</h2>
${ecuaciones}
<h2>Referencias</h2>
${referencias}
<footer class="pie-marca">
<span>Generado por ${esc(etiquetaVersion())} el ${esc(generado)} ·${esc(INSTITUCION)}, ${esc(PROGRAMA)}. Este archivo es autónomo: no necesita ningún otro documento ni conexión a internet.</span>
<img src="${escudoUd}" alt="">
</footer>
</main>
</body>
</html>`
}

// Recoge las gráficas de la ventana del informe, tal como se ven. Cada figura
// lleva `data-figura`; se descartan las que contienen un <canvas> (los grafos
// de estados, que ya entran como imagen por otro camino, porque un canvas no
// sobrevive a una copia de HTML) y se quitan los botones, que en un archivo
// estático no hacen nada.
export function capturarFiguras(): string[] {
  const raiz = document.querySelector('[role="dialog"]')
  if (!raiz) return []
  const salida: string[] = []
  raiz.querySelectorAll<HTMLElement>('[data-figura]').forEach(el => {
    if (el.querySelector('canvas')) return
    const copia = el.cloneNode(true) as HTMLElement
    copia.querySelectorAll('button, input').forEach(n => n.remove())
    salida.push(copia.outerHTML)
  })
  return salida
}

export function nombreArchivo(base: string, participante: string): string {
  const sello = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const quien = (participante || 'sin-nombre').toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `${base}-${quien}-${sello}`
}

export function descargarHtml(nombre: string, doc: DocInforme, conRutas = true): void {
  downloadFile(`${nombre}.html`, construirHtml(doc, { rutas: 'interactivo', inicialConRutas: conRutas }), 'text/html;charset=utf-8')
}

// PDF del mismo informe, con la misma identidad gráfica. Se imprime el HTML
// autocontenido desde un marco oculto y el navegador lo guarda como PDF: así
// el texto queda como texto (seleccionable y nítido), las gráficas siguen
// siendo vectoriales y no se suma ninguna biblioteca. El título del documento
// es el nombre de archivo que el navegador propone al guardar.
export function descargarPdf(nombre: string, doc: DocInforme, conRutas = true): void {
  const html = construirHtml(doc, { rutas: conRutas ? 'con' : 'sin' }).replace(/<title>[^<]*<\/title>/, `<title>${esc(nombre)}</title>`)
  const marco = document.createElement('iframe')
  marco.setAttribute('aria-hidden', 'true')
  marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  document.body.appendChild(marco)
  const quitar = () => setTimeout(() => marco.remove(), 1000)
  marco.onload = () => {
    const w = marco.contentWindow
    if (!w) { quitar(); return }
    // Espera a que las imágenes (escudo y grafos) estén decodificadas.
    const imgs = Array.from(w.document.images)
    Promise.all(imgs.map(i => (i.complete ? Promise.resolve() : new Promise(r => { i.onload = i.onerror = () => r(null) }))))
      .then(() => {
        w.addEventListener('afterprint', quitar, { once: true })
        w.focus()
        w.print()
        // Algunos navegadores no emiten afterprint: se limpia igual.
        setTimeout(quitar, 60000)
      })
  }
  marco.srcdoc = html
}

export function descargarJson(nombre: string, datos: unknown): void {
  downloadFile(`${nombre}.json`, JSON.stringify(datos, null, 2), 'application/json')
}

export function descargarCsv(nombre: string, csv: string): void {
  downloadFile(`${nombre}.csv`, csv, 'text/csv;charset=utf-8')
}

// Filas planas de intentos para el CSV, compartidas por los dos informes.
export function csvDeIntentos(filas: (string | number)[][], cols: string[]): string {
  const esc2 = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""') + '"'
  return [cols.map(esc2).join(','), ...filas.map(f => f.map(esc2).join(','))].join('\n')
}

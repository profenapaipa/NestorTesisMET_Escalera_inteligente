// El paquete de datos de una sesión: todo lo registrado y todo lo derivado, en
// formatos que se pueden reutilizar, con su diccionario.
//
// Es lo que hace que una sesión se pueda reanalizar —o alinear con el EEG— sin
// abrir la aplicación. Contiene:
//
//   sesion.json                metadatos, versiones y relojes
//   eventos.csv                la bitácora completa, de todas las vistas
//   intentos.csv               una fila por intento, con las métricas 3.2–3.17
//   movimientos.csv            una fila por movimiento (la tabla de análisis)
//   mediacion_decisiones.csv   cada decisión con su grupo (señal, sugerencia descartada, sin señal)
//   marcadores_eeg.csv         marcadores derivados de la bitácora
//   ventanas.csv               línea base, intentos y señales, para cortar el EEG
//   codigos_marcador.csv       qué significa cada código
//   DICCIONARIO.md, datapackage.json, LEEME.md
//
// SEUDONIMIZADO por defecto: el participante y el operador viajan como códigos.
// El nombre real solo entra, en un archivo aparte (identidad.json), si quien
// exporta lo pide.
//
// Este módulo es puro (no toca el navegador): recibe todo lo que necesita, así
// que `scripts/verificarPaquete.ts` lo ejecuta en la compilación con datos
// sintéticos.

import { AUTO_OFF_MS } from '../ppa/ppaColors'
import { VERSION_COMPLETA } from '../version'
import { CODIGOS_MARCADOR, marcadoresDeSesion } from '../control/marcadoresEeg'
import { detalleMovimientos } from '../simulation/detalleMovimientos'
import { normalizarMetricas } from '../simulation/metricas'
import { efectoMediacion } from './mediacion'
import {
  CAMPOS_SESION, ESQUEMA, TABLAS, datapackage, diccionarioMarkdown, escribirCsv, tablaCodigos, TABLA_CODIGOS,
  type Valor,
} from './diccionario'
import type { EventoSesion, IntentoSesion } from './sesion'

export type SesionParaPaquete = {
  sesionId: string
  perfilId: string
  participante: string
  operador: string
  inicio: string
  fin: string
  intentos: IntentoSesion[]
  eventos: EventoSesion[]
}

export type OpcionesPaquete = {
  participanteId: string // código seudónimo
  operadorId: string
  // Código seudónimo de la sesión (su identificador real puede llevar el nombre).
  sesionCodigo?: string
  // Incluye identidad.json con los nombres reales. Apagado por defecto.
  incluirIdentidad?: boolean
  generado?: string // ISO; se puede fijar para que la salida sea reproducible
  agente?: string
}

export type ArchivoPaquete = { nombre: string; contenido: string }

const ms = (iso: string | undefined) => {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : null
}
const iso = (t: number | null) => (t === null ? null : new Date(t).toISOString())
const seg3 = (t: number | null) => (t === null ? null : Number((t / 1000).toFixed(3)))
const redondeo = (x: number | null | undefined) => (x === null || x === undefined ? null : Math.round(x))

// Origen de tiempos de cada intento: el instante en que el tablero quedó
// disponible (`juego_listo`), si la vista lo registró.
function origenesDeIntentos(eventos: EventoSesion[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const e of eventos) {
    if (e.tipo !== 'juego_listo' || e.intentoNum === undefined) continue
    const t = ms(e.ts)
    if (t !== null) m.set(`${e.seccion}|${e.intentoNum}`, t)
  }
  return m
}

export type Ventana = {
  tipo: 'basal' | 'intento' | 'pausar' | 'pensar' | 'actuar'
  seccion?: string
  intento?: number
  nivel?: number
  inicio: number
  fin: number
}

// Las ventanas para segmentar el EEG: la línea base (de un marcador 50 al 51
// siguiente), cada intento (del origen de tiempos al cierre) y cada señal
// confirmada (desde que se activa hasta que se apaga sola).
export function ventanasDeSesion(s: SesionParaPaquete): Ventana[] {
  const out: Ventana[] = []
  const marcas = marcadoresDeSesion(s.eventos)
  let abierta: number | null = null
  for (const m of marcas) {
    if (m.codigo === CODIGOS_MARCADOR.basal_inicio) abierta = m.tsMs
    else if (m.codigo === CODIGOS_MARCADOR.basal_fin && abierta !== null) {
      out.push({ tipo: 'basal', inicio: abierta, fin: m.tsMs })
      abierta = null
    }
  }
  const origenes = origenesDeIntentos(s.eventos)
  for (const i of s.intentos) {
    const fin = ms(i.fin)
    if (fin === null) continue
    const o = origenes.get(`${i.seccion}|${i.numero}`) ?? (i.tiempos ? fin - i.segundos * 1000 : null)
    if (o === null) continue
    out.push({ tipo: 'intento', seccion: i.seccion, intento: i.numero, nivel: i.pares, inicio: o, fin })
  }
  for (const e of s.eventos) {
    if (e.tipo !== 'decision_ppa' || e.decision === 'descartada' || !e.fase) continue
    const t = ms(e.ts)
    if (t === null) continue
    out.push({ tipo: e.fase, seccion: e.seccion, intento: e.intentoNum, nivel: e.pares, inicio: t, fin: t + AUTO_OFF_MS })
  }
  return out.sort((a, b) => a.inicio - b.inicio)
}

// Una fila de intentos.csv. Aparte porque la usan el paquete completo y el CSV
// de intentos de los informes: son la misma tabla con el mismo diccionario.
function filaDeIntento(i: IntentoSesion, comun: { sesion_id: string; participante_id: string }, origen: number | null): Record<string, Valor> {
  const m = normalizarMetricas(i.metricas)
  const gano = i.resultado === 'victoria'
  return {
    ...comun, seccion: i.seccion, intento: i.numero, nivel_pares: i.pares, resultado: i.resultado,
      juego_listo_utc: iso(origen), fin_utc: i.fin, segundos: i.segundos,
      L: m.movimientos, D_estrella: m.optimo,
      Q: gano && m.movimientos > 0 ? m.circuidad : null,
      E: gano && m.movimientos > 0 ? m.eficiencia : null,
      K: m.puntosDecision, R: m.ramificacion, alfa: m.tasaAcierto,
      delta_media: m.movimientos > 0 ? m.gradoLibertadMedio : null,
      nu: m.retornos, beta: m.movimientos > 0 ? m.buclicidad : null, mu: m.ciclosIndependientes,
      V_distintos: m.estadosDistintos,
      tamanos_bucle: m.tamanosBucle.length ? m.tamanosBucle.join(' ') : null,
      t_ini_ms: redondeo(m.latenciaInicial), t_dec_ms: redondeo(m.latenciaDecision), t_for_ms: redondeo(m.latenciaForzada),
      n_sin_elegir_unica: m.jugadasSinElegir.unica, n_sin_elegir_equivalente: m.jugadasSinElegir.equivalentes,
      faltas: i.errores,
    }
}

// La sesión con las métricas de cada intento en su significado actual: R y α
// vacíos (null) donde no hubo decisiones. Es lo que sale en los JSON.
export function normalizarSesion<T extends { intentos: IntentoSesion[] }>(s: T): T {
  return { ...s, intentos: s.intentos.map(i => ({ ...i, metricas: normalizarMetricas(i.metricas) })) }
}

export function filasIntentosCrudas(s: SesionParaPaquete, o: OpcionesPaquete): Record<string, Valor>[] {
  const comun = { sesion_id: o.sesionCodigo ?? s.sesionId, participante_id: o.participanteId }
  const origenes = origenesDeIntentos(s.eventos)
  return s.intentos.map(i => filaDeIntento(i, comun, origenes.get(`${i.seccion}|${i.numero}`) ?? null))
}

// Los nombres no solo están en los identificadores: el texto libre de la bitácora
// («detalle», «motivo») puede mencionarlos, con o sin tildes y en cualquier
// combinación de mayúsculas. Se sustituyen —el nombre completo y cada una de sus
// palabras de tres letras o más— por el código del participante o del operador.
const ACENTOS: Record<string, string> = {
  a: 'aáàäâã', e: 'eéèëê', i: 'iíìïî', o: 'oóòöôõ', u: 'uúùüû', n: 'nñ', c: 'cç',
}
function patronDe(palabra: string): RegExp {
  const clase = [...palabra.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')]
    .map(c => (ACENTOS[c] ? `[${ACENTOS[c]}]` : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('')
  return new RegExp(`(?<![\\p{L}])${clase}(?![\\p{L}])`, 'giu')
}

function limpiador(s: SesionParaPaquete, o: OpcionesPaquete): (t: string | undefined) => string | undefined {
  const reemplazos: [RegExp, string][] = []
  const quitar = (nombre: string, codigo: string) => {
    const n = nombre.trim()
    if (!n || /^\(.*\)$/.test(n)) return
    reemplazos.push([patronDe(n), codigo])
    for (const palabra of n.split(/[\s\-_]+/)) if (palabra.length >= 3) reemplazos.push([patronDe(palabra), codigo])
  }
  quitar(s.participante, o.participanteId)
  quitar(s.operador, o.operadorId)
  quitar(s.perfilId, o.participanteId)
  return t => (t === undefined ? t : reemplazos.reduce((acc, [re, c]) => acc.replace(re, c), t))
}

export function construirPaquete(s: SesionParaPaquete, o: OpcionesPaquete): ArchivoPaquete[] {
  const generado = o.generado ?? new Date().toISOString()
  const sesionId = o.sesionCodigo ?? s.sesionId
  const limpio = limpiador(s, o)
  const comun = { sesion_id: sesionId, participante_id: o.participanteId }
  const origenes = origenesDeIntentos(s.eventos)

  // ── eventos.csv ──
  const t0Intento = new Map<string, number>()
  const filasEventos: Record<string, Valor>[] = s.eventos.map((e, k) => {
    const t = ms(e.ts)
    const clave = e.intentoNum !== undefined ? `${e.seccion}|${e.intentoNum}` : null
    if (e.tipo === 'juego_listo' && clave && t !== null) t0Intento.set(clave, t)
    const origen = clave ? (t0Intento.get(clave) ?? origenes.get(clave)) : undefined
    return {
      ...comun,
      evento_id: k + 1, ts_utc: e.ts, ts_unix_ms: t,
      t_rel_ms: origen !== undefined && t !== null && t >= origen ? t - origen : null,
      fuente_tiempo: e.fuenteTiempo ?? 'pantalla',
      latencia_corregida_ms: e.latenciaMs ?? null,
      desfase_reloj_ms: e.dr ?? null,
      seccion: e.seccion, nivel_pares: e.nivel ?? e.pares ?? null, intento: e.intentoNum ?? null,
      tipo: e.tipo, detalle: limpio(e.detalle),
      fase: e.fase ?? null, decision: e.decision ?? null, origen: e.origen ?? null, motivo: limpio(e.motivo) ?? null,
      version_ppa: e.versionPpa ?? null, nodo_grafo: e.nodoGrafo ?? null, error_tipo: e.errorTipo ?? null,
    }
  })

  // ── mediación ──
  const med = efectoMediacion(s.eventos)
  const grupoPorMovimiento = new Map<string, { grupo: string; fase: string | null }>()
  for (const d of med.decisiones) {
    if (d.intentoNum !== null) grupoPorMovimiento.set(`${d.seccion}|${d.intentoNum}|${d.k}`, { grupo: d.grupo, fase: d.fase })
  }
  const filasMediacion: Record<string, Valor>[] = med.decisiones.map(d => ({
    ...comun, seccion: d.seccion, intento: d.intentoNum, k: d.k, nodo: d.nodo, ts_utc: d.ts,
    grupo: d.grupo, fase: d.fase, origen: d.origen, C_k: d.calidad,
    latencia_ms: redondeo(d.latenciaMs), latencia_desde_senal_ms: redondeo(d.latenciaDesdeSenalMs),
  }))

  // ── intentos.csv y movimientos.csv ──
  const filasIntentos: Record<string, Valor>[] = []
  const filasMovimientos: Record<string, Valor>[] = []
  for (const i of s.intentos) {
    const origen = origenes.get(`${i.seccion}|${i.numero}`) ?? null
    filasIntentos.push(filaDeIntento(i, comun, origen))
    if (i.recorrido.length < 2) continue
    const ts = i.tiempos && i.tiempos.length === i.recorrido.length - 1 ? i.tiempos : null
    for (const d of detalleMovimientos(i.pares, i.recorrido)) {
      const g = grupoPorMovimiento.get(`${i.seccion}|${i.numero}|${d.k}`)
      const tRel = ts ? ts[d.k - 1] : null
      filasMovimientos.push({
        ...comun, seccion: i.seccion, intento: i.numero, nivel_pares: i.pares, k: d.k,
        nodo_previo: d.nodoPrevio, nodo: d.nodo, delta_k: d.opciones,
        d_min: d.dMin, d_max: d.dMax, d_elegida: d.dElegida, elegida_sin_salida: d.elegidaSinSalida,
        es_decision: d.esDecision, C_k: d.calidad, sin_elegir: d.sinElegir, retorno: d.retorno,
        t_rel_ms: redondeo(tRel),
        intervalo_ms: ts ? redondeo(d.k === 1 ? ts[0] : ts[d.k - 1] - ts[d.k - 2]) : null,
        ts_unix_ms: ts && origen !== null ? Math.round(origen + ts[d.k - 1]) : null,
        grupo_mediacion: d.esDecision ? (g?.grupo ?? 'sin_senal') : null,
        fase_senal: d.esDecision ? (g?.fase ?? null) : null,
      })
    }
  }

  // ── marcadores y ventanas ──
  const marcadores = marcadoresDeSesion(s.eventos)
  const filasMarcadores: Record<string, Valor>[] = marcadores.map(m => ({
    ...comun, timestamp_unix: Number((m.tsMs / 1000).toFixed(3)), hora_iso: new Date(m.tsMs).toISOString(),
    codigo: m.codigo, evento: m.evento, detalle: limpio(m.detalle), intento: m.intentoNum ?? null,
    origen: m.origen, latencia_ms: redondeo(m.latenciaMs),
  }))
  const filasVentanas: Record<string, Valor>[] = ventanasDeSesion(s).map((v, k) => ({
    ...comun, ventana_id: k + 1, tipo: v.tipo, seccion: v.seccion ?? null, intento: v.intento ?? null,
    nivel_pares: v.nivel ?? null, inicio_unix: seg3(v.inicio), fin_unix: seg3(v.fin),
    inicio_utc: iso(v.inicio), fin_utc: iso(v.fin), duracion_ms: Math.round(v.fin - v.inicio),
    inicio_muestra: null, fin_muestra: null,
  }))

  // ── sesion.json ──
  const dr = s.eventos.flatMap(e => (e.dr === undefined ? [] : [e.dr]))
  const saltos: { despues_del_evento: number; salto_ms: number }[] = []
  for (let k = 1; k < s.eventos.length; k++) {
    const a = s.eventos[k - 1], b = s.eventos[k]
    // Mismo arranque de página (el reloj monótono no retrocede) y desfase distinto: salto del reloj de pared.
    if (a.tm !== undefined && b.tm !== undefined && b.tm >= a.tm && a.dr !== undefined && b.dr !== undefined && Math.abs(b.dr - a.dr) > 20) {
      saltos.push({ despues_del_evento: k, salto_ms: b.dr - a.dr })
    }
  }
  const secciones = [...new Set([...s.intentos.map(i => i.seccion), ...s.eventos.map(e => e.seccion)])]
  const sesionJson = {
    esquema: ESQUEMA, aplicacion: 'Escalera Inteligente', generado_utc: generado,
    // Versión del software que registró la sesión y la que generó este paquete.
    version_app_registro: (s as { versionApp?: string }).versionApp ?? null, version_app_paquete: VERSION_COMPLETA,
    sesion_id: sesionId, participante_id: o.participanteId, operador_id: o.operadorId,
    inicio_utc: s.inicio, fin_utc: s.fin,
    secciones, niveles_pares: [...new Set(s.intentos.map(i => i.pares))].sort((a, b) => a - b),
    intentos: s.intentos.length, eventos: s.eventos.length,
    versiones_ppa: [...new Set(s.eventos.flatMap(e => (e.versionPpa ? [e.versionPpa] : [])))],
    reloj: {
      fuente: 'reloj del computador (Date.now); el EEG debe grabarse en el mismo computador, o con --desfase',
      desfase_min_ms: dr.length ? Math.min(...dr) : null,
      desfase_max_ms: dr.length ? Math.max(...dr) : null,
      saltos_de_reloj: saltos,
    },
    tiempos: {
      fisico_estimado: 'Control: hora estimada del apoyo del cubo = llegada al backend − mitad del viaje − espera en el maestro − 25 ms de antirrebote. Es una estimación.',
      pantalla: 'Hora de llegada a la pantalla, o de la acción del participante en las vistas en pantalla.',
      origen_de_tiempos: 'juego_listo: el instante en que el tablero queda disponible, después de la cuenta regresiva.',
    },
    mediacion: {
      activaciones: med.activaciones, descartadas: med.descartadas, fuera_de_intento: med.fueraDeIntento,
      decisiones: { con_senal: med.conSenal.n, sugerida_descartada: med.descartada.n, sin_senal: med.sinSenal.n },
    },
    ecuaciones: 'main.tex, sección «Fundamento matemático de las métricas de análisis» (ecuaciones 3.2 a 3.17)',
    agente: o.agente ?? null,
    campos: CAMPOS_SESION,
  }

  const leeme = [
    '# Paquete de datos de una sesión de Escalera Inteligente',
    '',
    `Esquema \`${ESQUEMA}\`. Generado el ${generado}.`,
    '',
    'Qué hay aquí y para qué sirve cada archivo está en DICCIONARIO.md (todas las columnas, con su tipo, unidad y la ecuación de la tesis donde se define). datapackage.json describe los CSV para cargarlos en R o Python.',
    '',
    '## Cómo se une todo',
    '',
    '- `intentos.csv` tiene una fila por intento; `movimientos.csv`, una por movimiento del intento (clave: `seccion`, `intento`, `k`); `eventos.csv`, una por evento de la bitácora.',
    '- `mediacion_decisiones.csv` repite, para las decisiones reales, el grupo del análisis de la mediación; también está en `movimientos.csv` (`grupo_mediacion`).',
    '- `marcadores_eeg.csv` y `ventanas.csv` son lo que se necesita para alinear con un registro EEG: ver herramientas/sincronizar_eeg.py.',
    '',
    '## Lo que hay que saber antes de analizar',
    '',
    '- **Un dato ausente va vacío.** Un intento sin ninguna decisión tiene `R` y `alfa` vacíos, no 0 ni 1.',
    '- **Las horas tienen dos fuentes** (`fuente_tiempo`): la estimada del apoyo físico del cubo, y la de pantalla. No son directamente comparables entre vistas.',
    '- **El origen de tiempos** de la planificación es `juego_listo`, no el momento de pulsar Iniciar: entre los dos corre una cuenta regresiva de tres segundos.',
    '- **La comparación de la mediación** que mejor se sostiene es la de la señal confirmada frente a la sugerencia descartada (mismo criterio cumplido, sin señal), no frente a todo lo demás.',
    '- **Reloj:** si `reloj.saltos_de_reloj` de sesion.json no está vacío, el reloj del sistema se ajustó durante la sesión y los tiempos posteriores al salto están desplazados.',
    '',
    '## Seudonimización',
    '',
    'El participante y el operador van como códigos. Los nombres reales no están en este paquete' + (o.incluirIdentidad ? ' salvo en identidad.json, que se incluyó por petición expresa y no debe compartirse.' : '.'),
    '',
  ].join('\n')

  const recursos = [
    TABLAS.eventos.archivo, TABLAS.intentos.archivo, TABLAS.movimientos.archivo,
    TABLAS.mediacion_decisiones.archivo, TABLAS.marcadores_eeg.archivo, TABLAS.ventanas.archivo, TABLA_CODIGOS.archivo,
  ]
  const archivos: ArchivoPaquete[] = [
    { nombre: 'LEEME.md', contenido: leeme },
    { nombre: 'DICCIONARIO.md', contenido: diccionarioMarkdown() },
    { nombre: 'datapackage.json', contenido: JSON.stringify(datapackage(`Sesión ${o.participanteId} · ${sesionId}`, generado, recursos), null, 2) },
    { nombre: 'sesion.json', contenido: JSON.stringify(sesionJson, null, 2) },
    { nombre: TABLAS.eventos.archivo, contenido: escribirCsv(TABLAS.eventos, filasEventos) },
    { nombre: TABLAS.intentos.archivo, contenido: escribirCsv(TABLAS.intentos, filasIntentos) },
    { nombre: TABLAS.movimientos.archivo, contenido: escribirCsv(TABLAS.movimientos, filasMovimientos) },
    { nombre: TABLAS.mediacion_decisiones.archivo, contenido: escribirCsv(TABLAS.mediacion_decisiones, filasMediacion) },
    { nombre: TABLAS.marcadores_eeg.archivo, contenido: escribirCsv(TABLAS.marcadores_eeg, filasMarcadores) },
    { nombre: TABLAS.ventanas.archivo, contenido: escribirCsv(TABLAS.ventanas, filasVentanas) },
    { nombre: TABLA_CODIGOS.archivo, contenido: tablaCodigos() },
  ]
  if (o.incluirIdentidad) {
    archivos.push({
      nombre: 'identidad.json',
      contenido: JSON.stringify({
        AVISO: 'Datos personales. No compartir con el resto del paquete.',
        participante_id: o.participanteId, participante: s.participante,
        operador_id: o.operadorId, operador: s.operador,
      }, null, 2),
    })
  }
  return archivos
}

// Solo el CSV de intentos, para los botones «CSV» de los informes: numérico,
// con las mismas columnas y el mismo diccionario que el paquete.
export function csvDeIntentosCrudo(s: SesionParaPaquete, o: OpcionesPaquete): string {
  return construirPaquete(s, o).find(a => a.nombre === TABLAS.intentos.archivo)!.contenido
}

import { Bloque, Tabla, ThM, td, tdIzq } from './ModalInforme'
import { Medidor } from './graficos'
import type { EfectoMediacion } from '../../core/session/mediacion'
import { textoMediacion } from './resumenes'

// Efecto de la mediación Pausar–Pensar–Actuar sobre la decisión siguiente.
//
// Es la pregunta de la investigación, así que el bloque está escrito para no
// prometer más de lo que los datos dan: con pocas decisiones dice que es una
// observación y no una medida, y cuando no hay con qué comparar lo dice en lugar
// de dibujar una diferencia. El texto sale de resumenes.ts (textoMediacion), el
// mismo que lleva el archivo descargable.

export default function BloqueMediacion({ efecto }: { efecto: EfectoMediacion }) {
  const t = textoMediacion(efecto)

  if (t.vacio) {
    return (
      <Bloque titulo="Efecto de la mediación">
        <p style={{ fontSize: '13.5px', lineHeight: 1.6, color: 'var(--color-paper-dim)', margin: 0 }}>{t.parrafos[0]}</p>
      </Bloque>
    )
  }

  const { conSenal, descartada, sinSenal } = efecto
  const medidores = [
    { g: conSenal, etiqueta: 'Tras una señal', texto: 'calidad media de las decisiones que siguieron a una señal confirmada' },
    { g: descartada, etiqueta: 'Tras una sugerencia descartada', texto: 'calidad media de las decisiones que siguieron a una sugerencia que el operador descartó' },
    { g: sinSenal, etiqueta: 'Resto de decisiones', texto: 'calidad media del resto de decisiones del mismo aprendiz' },
  ].filter(x => x.g.n > 0 && x.g.calidad !== null)

  return (
    <Bloque titulo="Efecto de la mediación">
      <p style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--color-paper-faint)', margin: '0 0 10px', borderLeft: '3px solid var(--color-line-strong)', paddingLeft: '8px' }}>
        Análisis descriptivo, no causal: la persona que opera decide qué señales enviar, así que una diferencia entre grupos describe lo que ocurrió, no prueba que la señal la cause.
      </p>
      {t.parrafos.map((p, i) => (
        <p key={i} style={{ fontSize: '13.5px', lineHeight: 1.6, color: 'var(--color-paper)', margin: '0 0 12px' }}>{p}</p>
      ))}

      <Tabla nota="«Decisiones» cuenta solo las jugadas en que había algo que elegir. El grupo de la sugerencia descartada parte del mismo estado que el de la señal y no recibe señal: es la comparación principal. El intervalo se calcula por remuestreo de las decisiones, con semilla fija.">
        <thead><tr>
          <ThM izq titulo="Grupo" />
          <ThM titulo="Decisiones" ayuda="Cuántas decisiones reales hay en el grupo." />
          <ThM titulo="Calidad" simbolo="C" ayuda="0 = eligió la mejor jugada disponible; 1 = la peor. Media ± desviación estándar." />
          <ThM titulo="Desde la jugada anterior" ayuda="Tiempo transcurrido desde el movimiento anterior. En los grupos con señal incluye lo que dura la señal." />
          <ThM titulo="Desde el fin de la señal" ayuda="Tiempo transcurrido desde que la señal terminó (o desde que se descartó la sugerencia)." />
        </tr></thead>
        <tbody>
          {t.filas.map((f, i) => (
            <tr key={i}>
              <td style={tdIzq}>{f[0]}</td>
              {f.slice(1).map((c, j) => <td key={j} style={td}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </Tabla>

      {medidores.length > 1 && (
        <div style={{ display: 'flex', gap: '16px', margin: '14px 0 0', flexWrap: 'wrap' }}>
          {medidores.map(x => (
            <div key={x.etiqueta} style={{ flex: '1 1 200px' }}>
              <Medidor etiqueta={`${x.etiqueta} · ${x.g.n} ${x.g.n === 1 ? 'decisión' : 'decisiones'}`}
                valor={x.g.calidad as number} optimoEn={0} texto={x.texto} />
            </div>
          ))}
        </div>
      )}

      {(t.comparaciones.length > 0 || t.avisos.length > 0) && (
        <div style={{ margin: '12px 0 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {t.comparaciones.map((c, i) => (
            <p key={i} style={{ fontSize: '13.5px', lineHeight: 1.6, color: 'var(--color-paper)', margin: 0 }}>{c}</p>
          ))}
          {t.avisos.map((a, i) => (
            <p key={i} style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--color-caution)', margin: 0 }}>{a}</p>
          ))}
        </div>
      )}
    </Bloque>
  )
}

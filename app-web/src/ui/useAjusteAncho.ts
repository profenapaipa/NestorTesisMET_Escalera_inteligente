// Escala para que un tablero de ancho fijo quepa completo en su contenedor
// (celulares y columnas angostas). Nunca agranda: en pantallas anchas la
// escala es 1 y el tablero se ve igual que siempre.
//
// `ref` es una referencia de función: mide el contenedor cuando aparece, aunque
// se monte después (por ejemplo, el tablero del observador, que solo existe
// cuando llegan datos de Control).
import { useCallback, useEffect, useState } from 'react'

export function useAjusteAncho(anchoNatural: number, minimo = 0.3) {
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  const [disponible, setDisponible] = useState(0)
  const ref = useCallback((nodo: HTMLDivElement | null) => setEl(nodo), [])
  useEffect(() => {
    if (!el) return
    const ro = new ResizeObserver(() => setDisponible(el.clientWidth))
    ro.observe(el)
    setDisponible(el.clientWidth)
    return () => ro.disconnect()
  }, [el])
  const escala = disponible > 0 ? Math.max(minimo, Math.min(1, (disponible - 24) / anchoNatural)) : 1
  return { ref, escala }
}

// Ancho natural de una fila de casillas: n casillas de `celda` px con `hueco` px entre ellas.
export const anchoFila = (n: number, celda = 72, hueco = 6) => n * celda + (n - 1) * hueco

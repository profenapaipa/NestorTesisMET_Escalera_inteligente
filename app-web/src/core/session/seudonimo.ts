import { leerLocal, escribirLocal } from './almacen'

// Códigos seudónimos para el paquete de datos.
//
// El paquete que se entrega a quien analiza (otro investigador, un revisor) no
// lleva el nombre del participante ni del operador: lleva un código estable
// —P01, P02…; O01…— que el mismo navegador conserva entre exportaciones, de
// modo que las sesiones de una misma persona se pueden unir sin saber quién es.
//
// No es un hash del nombre a propósito: el hash de un nombre se invierte
// probando nombres. La tabla que relaciona códigos y nombres vive solo en este
// navegador, y solo sale en un archivo aparte (identidad.json) si quien exporta
// lo pide expresamente.

const CLAVE = 'escalera.seudonimos.v1'

type Tabla = { participantes: Record<string, string>; operadores: Record<string, string>; sesiones: Record<string, string> }

function leer(): Tabla {
  try {
    const crudo = leerLocal(CLAVE)
    if (crudo) {
      const t = JSON.parse(crudo) as Partial<Tabla>
      return { participantes: t.participantes ?? {}, operadores: t.operadores ?? {}, sesiones: t.sesiones ?? {} }
    }
  } catch { /* tabla ilegible: se empieza otra */ }
  return { participantes: {}, operadores: {}, sesiones: {} }
}

function codigo(mapa: Record<string, string>, clave: string, prefijo: string): string {
  if (mapa[clave]) return mapa[clave]
  const usados = new Set(Object.values(mapa))
  let n = Object.keys(mapa).length + 1
  while (usados.has(`${prefijo}${String(n).padStart(2, '0')}`)) n++
  return `${prefijo}${String(n).padStart(2, '0')}`
}

export function codigoDeParticipante(perfilId: string): string {
  if (perfilId === 'admin') return 'ADMIN'
  const t = leer()
  const c = codigo(t.participantes, perfilId, 'P')
  if (!t.participantes[perfilId]) {
    t.participantes[perfilId] = c
    escribirLocal(CLAVE, JSON.stringify(t))
  }
  return c
}

export function codigoDeOperador(operador: string): string {
  const clave = operador.trim().toUpperCase()
  if (!clave || clave === '(SIN ASIGNAR)') return 'sin-asignar'
  const t = leer()
  const c = codigo(t.operadores, clave, 'O')
  if (!t.operadores[clave]) {
    t.operadores[clave] = c
    escribirLocal(CLAVE, JSON.stringify(t))
  }
  return c
}

// El identificador de una sesión importada lleva el nombre del participante
// (`importada-<nombre>-…`): en el paquete viaja un código, S01, S02…
export function codigoDeSesion(sesionId: string): string {
  const t = leer()
  const c = codigo(t.sesiones, sesionId, 'S')
  if (!t.sesiones[sesionId]) {
    t.sesiones[sesionId] = c
    escribirLocal(CLAVE, JSON.stringify(t))
  }
  return c
}

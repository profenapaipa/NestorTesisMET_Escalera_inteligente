// Catálogo de los perfiles simulados que trae la aplicación.
//
// Ninguno es una persona: son jugadores simulados por el programa, con el
// mismo motor de reglas y semillas fijas (scripts/generarSesionesSinteticas.ts).
// Cada uno se generó para ilustrar una combinación de ramificación (R) y
// buclicidad (β), calculadas con las mismas fórmulas del informe, y la
// auditoría `importacion:verificar` comprueba que sigan cumpliéndola.
//
// Lenguaje: se describe lo que ocurre en el recorrido (decisiones, retornos,
// llegada a la meta), nunca a quien juega. Nada de «bueno/malo», «hábil» ni
// «con dificultades»: un perfil es un patrón de datos, no una persona.

export type PerfilSimulado = {
  archivo: string
  nombre: string // nombre visible del perfil
  categoria: string // combinación que ilustra
  R: string
  beta: string
  muestra: string // qué se ve en las gráficas
  indica: string // cómo leer sus datos
}

export const PERFILES_SIMULADOS: PerfilSimulado[] = [
  {
    archivo: 'perfil-experto.json', nombre: 'Simulado 1 · Ruta mínima',
    categoria: 'R baja · β nula', R: '0', beta: '0',
    muestra: 'En cada punto de decisión elige la jugada que más acerca a la meta y nunca vuelve a una posición ya visitada.',
    indica: 'Es la referencia: el recorrido coincide con una de las dos rutas mínimas (n² + 2n movimientos). Sirve para ver cómo se ven los datos cuando no hay desvíos ni retornos.',
  },
  {
    archivo: 'perfil-desvios.json', nombre: 'Simulado 2 · Desvíos sin regresar',
    categoria: 'R media · β nula', R: '≈ 0,28', beta: '0',
    muestra: 'Toma con frecuencia jugadas que no son la más cercana a la meta, pero nunca repite una posición.',
    indica: 'Muestra que R y β miden cosas distintas: el recorrido se alarga por las decisiones (R), no por volver atrás (β = 0).',
  },
  {
    archivo: 'perfil-en-bucle.json', nombre: 'Simulado 3 · Retornos con buenas decisiones',
    categoria: 'R baja · β alta', R: '≈ 0,11', beta: '≈ 0,20',
    muestra: 'Donde hay que decidir, casi siempre elige bien, pero recorre ciclos y vuelve a posiciones ya visitadas.',
    indica: 'El caso contrario al anterior: lo que alarga el recorrido son los retornos (β), no las decisiones (R). En el grafo se ven tramos repetidos más gruesos.',
  },
  {
    archivo: 'perfil-erratico.json', nombre: 'Simulado 4 · Exploración con muchos retornos',
    categoria: 'R alta · β alta', R: '≈ 0,58', beta: '0,36–0,66',
    muestra: 'Elige con frecuencia jugadas que alejan de la meta y vuelve muchas veces a posiciones ya visitadas; no llega a la meta.',
    indica: 'Ilustra una exploración amplia del espacio del problema, con bloqueos. Ayuda a reconocer en las gráficas cuándo suben a la vez las dos métricas.',
  },
  {
    archivo: 'perfil-aprendiz.json', nombre: 'Simulado 5 · Mejora intento a intento',
    categoria: 'R y β bajan en cada nivel', R: '0,75 → 0', beta: '0,29 → 0',
    muestra: 'En cada nivel empieza con muchas decisiones alejadas de la meta y retornos, y en los últimos intentos sigue la ruta mínima.',
    indica: 'Sirve para leer las tendencias: la pendiente de R y β por nivel es negativa, y el informe la reporta solo cuando hay datos suficientes.',
  },
]

// Para buscar la descripción a partir del perfil guardado (por nombre).
export function perfilSimuladoPorNombre(nombre: string): PerfilSimulado | undefined {
  const n = nombre.trim().toUpperCase()
  return PERFILES_SIMULADOS.find(p => p.nombre.toUpperCase() === n)
}

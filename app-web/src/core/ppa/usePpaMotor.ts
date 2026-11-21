// Estado del motor PPA para una vista (Control Mago de Oz, Control simulado o
// Simulación libre). Los criterios viven en motorPpa.ts; aquí se lleva la
// carga de cada anillo, la sugerencia pendiente (un anillo lleno que el
// operador aún no envió) y se emiten los eventos que cada vista registra.
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CONFIG_PPA, MOTIVO_INICIATIVA, MOTIVO_NO_ENVIADA, acotarUmbralS,
  type FasePpa, type OrigenActivacion,
} from './motorPpa'

export type SugerenciaPpa = { fase: FasePpa; motivo: string; cuboSugerido?: number }

// Lo que el motor le pide registrar a la vista. Todos llevan `versionPpa`.
export type EventoPpa =
  | { tipo: 'sugerencia_ppa'; fase: FasePpa; motivo: string; cuboSugerido?: number; versionPpa: string; detalle: string }
  | {
      tipo: 'decision_ppa'; fase: FasePpa; motivo: string; decision: 'confirmada' | 'descartada';
      motivoDescarte?: string; activacionEfectiva: boolean; origen: OrigenActivacion;
      versionPpa: string; detalle: string
    }
  | { tipo: 'ajuste_umbral'; umbralMs: number; versionPpa: string; detalle: string }

type Opciones = {
  // El juego está en curso: solo entonces corre el tiempo de Actuar.
  activo: boolean
  onEvento: (e: EventoPpa) => void
}

export function usePpaMotor({ activo, onEvento }: Opciones) {
  const [sugerencia, setSugerencia] = useState<SugerenciaPpa | null>(null)
  const [fallasSeguidas, setFallasSeguidas] = useState(0)
  // Pensar queda «cargado» tras enviar Pausar, hasta que se envía o el juego sigue.
  const [pensarCargado, setPensarCargado] = useState(false)
  const [umbralS, setUmbralS] = useState<number>(CONFIG_PPA.actuar.porDefectoS)
  const [msSinMover, setMsSinMover] = useState(0)
  const ultimaJugadaRef = useRef<number>(Date.now())
  const actuarSugeridoRef = useRef(false)
  // La sugerencia pendiente se lee también por referencia: los cierres de los
  // manejadores (socket, temporizadores) no deben ver un estado viejo.
  const sugRef = useRef<SugerenciaPpa | null>(null)
  const onEventoRef = useRef(onEvento)
  onEventoRef.current = onEvento
  const emitir = (e: EventoPpa) => onEventoRef.current(e)

  const ponerSug = (s: SugerenciaPpa | null) => { sugRef.current = s; setSugerencia(s) }

  const sugerir = useCallback((s: SugerenciaPpa, detalle: string) => {
    ponerSug(s)
    emitir({ tipo: 'sugerencia_ppa', fase: s.fase, motivo: s.motivo, cuboSugerido: s.cuboSugerido, versionPpa: CONFIG_PPA.version, detalle })
  }, [])

  // Si había un anillo lleno sin enviar, queda como descartado con su motivo.
  const cerrarPendiente = useCallback((motivo: string) => {
    const s = sugRef.current
    if (!s) return
    emitir({
      tipo: 'decision_ppa', fase: s.fase, motivo: s.motivo, decision: 'descartada', motivoDescarte: motivo,
      activacionEfectiva: false, origen: 'sugerencia', versionPpa: CONFIG_PPA.version,
      detalle: `${s.fase.toUpperCase()} no enviada (${motivo})`,
    })
    ponerSug(null)
  }, [])

  const fallasRef = useRef(0)
  const ponerFallas = (n: number) => { fallasRef.current = n; setFallasSeguidas(n) }

  // Una jugada válida: corta la racha, reinicia el tiempo y cierra lo pendiente.
  const registrarMovimiento = useCallback(() => {
    // El cierre se escribe DESPUÉS del evento de la jugada (al terminar el
    // manejador que la registra): así el análisis de la mediación ve primero
    // la jugada hecha con el anillo lleno y cuenta su tiempo desde que el
    // anillo se llenó (core/session/mediacion.ts).
    queueMicrotask(() => cerrarPendiente(MOTIVO_NO_ENVIADA.jugada))
    ponerFallas(0)
    setPensarCargado(false)
    ultimaJugadaRef.current = Date.now()
    actuarSugeridoRef.current = false
  }, [cerrarPendiente])

  // Una jugada inválida. Devuelve true si llenó el anillo de Pausar.
  //
  // Decisión (auditoría 2026-11-20, M1): una falla es un intento de jugar, así
  // que reinicia el tiempo sin mover — Actuar mide inactividad, no intentos.
  // Y el criterio de Pausar tiene prioridad sobre otro anillo pendiente: si
  // Actuar (o el Pensar encadenado) seguía esperando, se cierra como
  // «reemplazada» y Pausar queda sugerido y registrado. Antes el contador
  // mostraba 2/2 sin que la bitácora lo registrara.
  const registrarFalla = useCallback((cuboId?: number): boolean => {
    const n = fallasRef.current + 1
    ponerFallas(Math.min(n, CONFIG_PPA.fallasParaPausar))
    ultimaJugadaRef.current = Date.now()
    actuarSugeridoRef.current = false
    if (n < CONFIG_PPA.fallasParaPausar || sugRef.current?.fase === 'pausar') return false
    if (sugRef.current) {
      if (sugRef.current.fase === 'pensar') setPensarCargado(false)
      cerrarPendiente(MOTIVO_NO_ENVIADA.reemplazada)
    }
    sugerir({ fase: 'pausar', motivo: 'dos fallas consecutivas', cuboSugerido: cuboId }, 'Anillo de Pausar lleno (dos fallas consecutivas)')
    return true
  }, [sugerir, cerrarPendiente])

  // Nuevo intento o tablero recién disponible: todo a cero.
  const reiniciarTurno = useCallback(() => {
    cerrarPendiente(MOTIVO_NO_ENVIADA.turno)
    ponerFallas(0)
    setPensarCargado(false)
    ultimaJugadaRef.current = Date.now()
    actuarSugeridoRef.current = false
  }, [cerrarPendiente])

  // El operador envía una fase (toca su anillo). Si el anillo estaba lleno es
  // una sugerencia confirmada; si no, iniciativa. Devuelve el origen.
  const enviar = useCallback((fase: FasePpa, detalleIniciativa: string): OrigenActivacion => {
    const s = sugRef.current
    let origen: OrigenActivacion
    if (s && s.fase === fase) {
      origen = 'sugerencia'
      emitir({
        tipo: 'decision_ppa', fase, motivo: s.motivo, decision: 'confirmada', activacionEfectiva: true,
        origen, versionPpa: CONFIG_PPA.version, detalle: `${fase.toUpperCase()} enviada por el operador (anillo lleno)`,
      })
      ponerSug(null)
    } else {
      origen = 'iniciativa'
      // Había otro anillo lleno (auditoría A3): se cierra antes de registrar la
      // iniciativa, para que no siga latiendo, no bloquee el Pensar encadenado
      // y su cierre no llegue después como un descarte espurio.
      if (s) {
        if (s.fase === 'pensar') setPensarCargado(false)
        cerrarPendiente(MOTIVO_NO_ENVIADA.reemplazada)
      }
      emitir({
        tipo: 'decision_ppa', fase, motivo: MOTIVO_INICIATIVA[fase], decision: 'confirmada',
        activacionEfectiva: true, origen, versionPpa: CONFIG_PPA.version, detalle: detalleIniciativa,
      })
    }
    ultimaJugadaRef.current = Date.now()
    actuarSugeridoRef.current = false
    if (fase === 'pausar') {
      ponerFallas(0)
      if (CONFIG_PPA.pensarEncadenadoTrasPausar && !sugRef.current) {
        setPensarCargado(true)
        sugerir({ fase: 'pensar', motivo: 'encadenado tras enviar Pausar (mismo ciclo)', cuboSugerido: s?.cuboSugerido },
          'Anillo de Pensar lleno (encadenado tras Pausar)')
      }
    } else if (fase === 'pensar') {
      setPensarCargado(false)
    }
    return origen
  }, [sugerir, cerrarPendiente])

  // El juego vuelve a correr tras una pausa o una corrección del tablero
  // (auditoría A5): el tiempo sin mover cuenta desde aquí, no desde la última
  // jugada, para que Actuar no se llene al instante por un tiempo en que el
  // aprendiz no podía jugar. No toca la racha de fallas ni lo pendiente.
  const reanudarReloj = useCallback(() => {
    ultimaJugadaRef.current = Date.now()
    actuarSugeridoRef.current = false
    setMsSinMover(0)
  }, [])

  // El operador deja pasar el anillo lleno sin enviarlo.
  const dejarPasar = useCallback(() => {
    if (sugRef.current?.fase === 'pensar') setPensarCargado(false)
    if (sugRef.current?.fase === 'pausar') ponerFallas(0)
    cerrarPendiente(MOTIVO_NO_ENVIADA.dejada)
  }, [cerrarPendiente])

  // El operador cambia el umbral de Actuar (segundos). Queda registrado.
  const ajustarUmbral = useCallback((segundos: number) => {
    const s = acotarUmbralS(segundos)
    setUmbralS(s)
    emitir({ tipo: 'ajuste_umbral', umbralMs: s * 1000, versionPpa: CONFIG_PPA.version, detalle: `Umbral de Actuar ajustado por el operador a ${s} s` })
  }, [])

  // Tiempo sin mover en vivo; al llegar al umbral el anillo de Actuar queda
  // lleno (una vez por turno, y solo si no hay otro anillo pendiente).
  useEffect(() => {
    if (!activo) { setMsSinMover(0); return }
    const id = setInterval(() => {
      const t = Date.now() - ultimaJugadaRef.current
      setMsSinMover(t)
      if (t >= umbralS * 1000 && !actuarSugeridoRef.current && sugRef.current === null) {
        actuarSugeridoRef.current = true
        sugerir({ fase: 'actuar', motivo: `tiempo sin mover ≥ ${umbralS} s (umbral del operador)` },
          `Anillo de Actuar lleno (${umbralS} s sin mover)`)
      }
    }, 250)
    return () => clearInterval(id)
  }, [activo, umbralS, sugerir])

  return {
    sugerencia, fallasSeguidas, pensarCargado, msSinMover, umbralS,
    registrarMovimiento, registrarFalla, reiniciarTurno, reanudarReloj, enviar, dejarPasar, ajustarUmbral,
  }
}

export type MotorPpa = ReturnType<typeof usePpaMotor>

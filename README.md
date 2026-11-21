# La Escalera inteligente

Herramienta híbrida físico-virtual del juego **La Escalera** (salto de la rana): un tablero de cubos inteligentes (ESP32) y una aplicación web. Las dos comparten el mismo motor de reglas, el grafo del espacio del problema en vivo, las métricas de trayectoria y un protocolo de mediación Pausar–Pensar–Actuar bajo control Mago de Oz.

**Versión actual: 0.11.0** (en desarrollo activo). Cómo ha evolucionado: tabla en [Historial de versiones](#historial-de-versiones); detalle en [`app-web/CHANGELOG.md`](app-web/CHANGELOG.md).

**Pruébala en el navegador, sin instalar nada:** https://profenapaipa.github.io/NestorTesisMET_Escalera_inteligente/

Sin hardware funcionan el Tutorial guiado, la Simulación libre, el Control simulado y los Informes. Control Mago de Oz aparece como «Desconectado», porque necesita la base y los cubos. Los perfiles de ejemplo son **simulados**: los genera el programa con las mismas reglas del juego, para ilustrar combinaciones de ramificación y buclicidad, y no contienen datos de ninguna persona.

## Contenido

| Carpeta | Qué hay |
|---|---|
| `app-web/` | Aplicación React + TypeScript + Vite (vistas, motor de reglas, grafo, métricas, informes). |
| `backend/` | Servidor Node.js (Express + Socket.IO) entre la aplicación y el maestro ESP32. |
| `firmware/` | Firmware v3 del maestro (`Maestro_v3`, ESP32) y de los cubos (`Cubo_Esclavo_v3`, ESP32-C3). |
| `herramientas/` | Scripts de análisis: prueba de banco y sincronización con EEG. |
| `docs/` | Manual de encendido y conexiones, guía de ensayo y estado visual de los cubos. |

## Uso local

Requisitos: Node.js 20 o superior.

```bash
cd app-web
npm ci
npm run dev          # http://localhost:5173
```

Con el hardware, el servidor se arranca aparte (`cd backend && npm ci && npm run dev`). En Windows, `iniciar-cubos.bat` abre las dos ventanas.

### Comprobaciones automáticas

```bash
cd app-web
npm run reglas:auditar && npm run grafo:verificar && npm run metricas:verificar \
  && npm run caminos:verificar && npm run animaciones:verificar \
  && npm run importacion:verificar && npm run ppa:verificar && npm run datos:verificar
```

## Firmware

Las credenciales WiFi **no** están en el código. En cada carpeta de `firmware/`, copia `secrets.example.h` como `secrets.h` y completa los valores. `secrets.h` está excluido de git. Se compila con Arduino IDE o `arduino-cli`. El maestro usa ESP32 DevKit V1 y los cubos ESP32-C3 SuperMini; en cada cubo solo se configura `NUMERO_CUBO` (1 a 10).

## Historial de versiones

El software se ha desarrollado y mejorado por etapas. Cada informe, sesión y paquete de datos dice con qué versión se hizo.

<!-- tabla-versiones:inicio -->
| Versión | Fecha | Hito | Qué cambió |
|---|---|---|---|
| **0.11.0** | 2026-11-21 | Primera versión pública con historial propio | Colores de los grafos auditados para daltonismo y contraste; leyenda y «cómo leerlo» en cada grafo; correcciones de una auditoría independiente (análisis de la mediación, motor PPA, importación, exportación). |
| **0.10.0** \* | 2026-11-20 | Celulares, ayuda integrada y grafos para publicar | Interfaz adaptada a celulares; limitaciones conocidas y guía rápida en la app; paleta académica; figura HD de cada grafo con leyenda y créditos. |
| **0.9.0** \* | 2026-11-20 | Versionado y trazabilidad | Versión y commit en cada informe, sesión y paquete; fechas al segundo con zona horaria; HTML interactivo con rutas mínimas; perfiles simulados descriptivos. |
| **0.8.0** \* | 2026-11-20 | Repositorio público y protección de datos | Software publicado aparte; ejemplos sintéticos; credenciales fuera del código; un motor de mediación para las tres vistas; paquete de datos seudonimizado; marcadores EEG. |
| **0.7.0** \* | 2026-10-22 | Métricas, mediación y cubos v3 | Agregación ponderada y eficiencia; tiempos de planificación; efecto de la mediación en los informes; firmware v3 tras la prueba de banco; respaldo durable. |
| **0.6.0** \* | 2026-10-17 | Tablero físico en vivo | Estado real del tablero, vista del jugador, telemetría de los cubos y sincronización con el EEG. |
| **0.5.0** \* | 2026-10-08 | Informes y perfiles | Informes en dos niveles, perfiles con historial, publicación en GitHub Pages; las métricas consideran que la solución mínima no es única. |
| **0.4.0** \* | 2026-10-02 | Reglas oficiales y grafo de estados | Reglas del juego según el libro (Fig. 3.3) y grafo del espacio del problema en vivo. |
| **0.3.0** \* | 2026-09-25 | Tutorial y simulación | Tutorial guiado con motor pedagógico, Simulación libre y Vista de observador. |
| **0.2.0** \* | 2026-09-18 | Consola de operación | Menor latencia entre maestro y cubos, control de partida con código de colores e identidad visual. |
| **0.1.0** \* | 2026-09-01 | Estructura propia sobre ACACIA | Pestañas de Control, Simulación y Observador, controlador simulado y bitácoras, sobre la línea base del proyecto ACACIA (módulo INNOVA). |

\* Versión interna, desarrollada en el repositorio privado de la tesis antes de que empezara el historial público (numerada a partir de los hitos de su historial de commits). El historial público empieza en la **0.11.0**.
<!-- tabla-versiones:fin -->

## Origen

El diseño mecánico y electrónico de los cubos y una primera versión del software de control provienen del módulo INNOVA del proyecto ACACIA (ver `NOTICE.md`). Este repositorio contiene la versión reescrita y ampliada que se desarrolló en el trabajo de grado de maestría de Nestor Paipa (Universidad Distrital Francisco José de Caldas).

## Seguridad y datos

Ver `SECURITY.md`. Este repositorio no debe contener nunca datos de participantes ni credenciales.

# Historial de versiones · Escalera Inteligente

La numeración sigue [Versionado Semántico](https://semver.org/lang/es/): `MAYOR.MENOR.PARCHE`.

- **MAYOR** cambia cuando se rompe la compatibilidad de los datos: una bitácora o un paquete de una versión anterior dejaría de leerse igual.
- **MENOR** cambia con funciones nuevas que no rompen lo anterior.
- **PARCHE** cambia con correcciones.

Mientras la versión empiece por `0.`, el software está en desarrollo activo.

Cada sesión guarda la versión con que se registró (`versionApp`, por ejemplo `0.9.0+a1b2c3d`: versión más commit). Cada informe y cada paquete de datos dicen con qué versión se calcularon.

Las versiones de 0.1.0 a 0.8.0 se asignaron después, el 2026-11-20, a partir de los hitos del historial de commits.

## Resumen de versiones

<!-- tabla-versiones:inicio -->
| Versión | Fecha | Hito | Qué cambió |
|---|---|---|---|
| **0.14.2** | 2026-11-24 | Lo físico y lo virtual sincronizados | La pantalla reproduce paso a paso los efectos del firmware (bloqueo, victoria, cuenta regresiva) y el sonido de encaje suena en el mismo instante en que el cubo golpea la base. |
| **0.14.1** | 2026-11-24 | Juego fluido en cualquier equipo y sonido de encaje | El grafo sigue al jugador centrado y con zoom sin volver a dibujarse en cada jugada; el tablero 3D dibuja cada cubo por separado y comparte sus efectos; sonido suave de encaje (madera e imán) que se puede apagar con un botón. |
| **0.14.0** | 2026-11-23 | Tablero 3D realista y órdenes con confirmación | Vista 3D del tablero (MDF por defecto, también Minimalista) con cámara central y luz realista, en Control y en las simulaciones; señales PPA, error y desconexión animados como el cubo real; las órdenes al maestro ya no se pierden: se confirman y se reenvían. |
| **0.13.0** | 2026-11-23 | Enlace confiable con el maestro y pausa técnica | El servidor y la pantalla reconocen envíos repetidos o perdidos del maestro y avisan si se reinició; pausa técnica separada de Pausar; la vista del jugador ya no muestra diagnóstico; historial de versiones con el detalle de cada una. |
| **0.12.3** | 2026-11-21 | El juego al centro de la atención | Simulación libre y Tutorial guiado: el tablero ocupa el 60 % del ancho y el grafo el 40 % (antes el grafo se llevaba más de la mitad). Vista de observador: tablero, registro de observaciones y grafo, en ese orden, con el cronómetro centrado. |
| **0.12.2** | 2026-11-21 | Logo oficial en la pestaña del navegador | La pestaña del navegador muestra la marca de Escalera Inteligente (escalera azul y roja) en lugar del ícono genérico de la herramienta de compilación, que además no cargaba en GitHub Pages; ícono para iPhone/iPad y color de la barra del navegador en el celular. |
| **0.12.1** | 2026-11-21 | Textos sin montarse en celular y computador | Barra superior en dos carriles: las pestañas no se parten en dos líneas y las acciones (versión, Terminar sesión, perfil) siempre se ven; nombres cortos de pestaña cuando no caben; en el celular, «Cómo usar esta vista» empieza cerrada, las tarjetas de nivel del tutorial y las de Pausar/Pensar/Actuar ya no se exprimen y los títulos de sección bajan de línea en vez de partirse. |
| **0.12.0** | 2026-11-21 | Accesibilidad | Página en español para lectores de pantalla; más contraste en textos secundarios y bordes; conexión de cada cubo con símbolo además del color; respeto de «reducir movimiento»; controles de 44 px en pantallas táctiles; pestañas como navegación con nombre; avisos del tutorial anunciados. |
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


## 0.14.2 · 2026-11-24 · lo físico y lo virtual sincronizados

- **Corrección: efectos de fin de intento.** Al perder, Control saltaba directo a blanco y las simulaciones no mostraban nada. Ahora la pantalla reproduce paso a paso los efectos del firmware (`EF=4` bloqueo: rojo con vibración decreciente → blanco fijo; `EF=5` victoria: verde/dorado → blanco fijo; `EF=6/7` cuenta regresiva: destello cian / verde) con el mismo color, vibración y duración que el cubo (`src/core/ppa/efectosCubo.ts`).
- **Auditoría `efectos:verificar`:** lee las tablas `EFECTO_<n>_*` de `Cubo_Esclavo_v3.ino` y las compara con las de la pantalla; forma parte de la verificación de cada publicación.
- **Corrección: sonido de encaje tardío.** El cubo frenaba al llegar y no había un instante de contacto. Ahora cae acelerando (encaje imantado) y el vuelo entre casillas es balístico; el golpe ocurre a los 340 ms exactos y el sonido se programa en el reloj de audio para ese instante con la latencia de salida del navegador (`getOutputTimestamp`). Medido: el golpe de madera suena a ±5 ms del cuadro del impacto.

## 0.14.1 · 2026-11-24 · juego fluido en cualquier equipo y sonido de encaje

- **Grafo en modo seguimiento:** mientras se juega, el grafo completo se pinta una sola vez como imagen y en cada jugada solo se dibuja la trayectoria del intento; el centrado y el zoom los hace la tarjeta gráfica. La posición actual queda siempre centrada. Al terminar el intento o al tocar el grafo vuelve la vista interactiva en el mismo encuadre.
- **Corrección: cortes al mover un cubo.** Con 5 pares, redibujar el grafo bloqueaba la animación hasta ~460 ms; ahora el cuadro más lento es de ~20 ms en un equipo normal y de ~100-200 ms con la CPU frenada 4 veces.
- **Tablero 3D más liviano:** cada cubo se redibuja solo cuando cambia lo suyo; la vibración de las señales usa un único reloj; los filtros de sombra, halo y LED y la textura del MDF se crean una sola vez para todo el tablero.
- **Sonido de encaje:** «pop» sutil de madera con el clic del conector imantado, sintetizado como percusión física (modos resonantes del MDF, sin archivos de audio), cuando un cubo llega a su casilla, se baja o se reconecta; elegido de oído entre cinco variantes. Botón del altavoz en la esquina del tablero para apagarlo; la elección se recuerda en el navegador.

## 0.14.0 · 2026-11-23 · tablero 3D realista y órdenes con confirmación

- **Vista 3D del tablero:** perspectiva de cámara central, luz y sombras realistas, y acabados MDF (predeterminado) y Minimalista; la 2D sigue disponible en el mismo selector. También en Simulación libre, Control simulado y Tutorial, donde los cubos se mueven con clic sobre el 3D.
- **Luces como el cubo real:** en las señales PPA, el cubo se ilumina con el color de la fase, vibra con su patrón programado y su LED emite un cono de luz; la jugada inválida se ve en naranja; el cubo desconectado flota y encaja al conectarse.
- **Corrección: órdenes perdidas.** Si una respuesta al maestro llegaba incompleta, sus órdenes se perdían sin aviso. Ahora cada orden lleva un número (`oid`), queda pendiente hasta la confirmación (`ack`) del maestro y se reenvía; si no se confirma tras 10 envíos o 30 s, se registra como `orden_no_confirmada`. Compatible con el firmware v3, que sigue funcionando como antes.
## 0.13.0 · 2026-11-23 · enlace confiable con el maestro y pausa técnica

- **Corrección: jugadas duplicadas.** Una jugada que llegaba dos veces sumaba dos movimientos y duplicaba su marcador EEG. Ahora cada envío del maestro lleva un número de arranque y de secuencia, y el servidor y la pantalla descartan las copias.
- **Corrección: reinicio del maestro.** Si el maestro se reiniciaba, la pantalla conservaba la lista de cubos anterior y podía iniciar un intento sin identificarlos. Ahora avisa del reinicio, cancela un inicio en curso y reidentifica los cubos solo cuando no hay intento; un arranque viejo ya no puede volver a mover el tablero.
- **Calidad del enlace:** `GET /api/enlace` informa, por arranque, envíos recibidos, repetidos, perdidos, tardíos y sin clasificar; la bitácora anota cada salto de secuencia (`enlace_perdidas`) y cada reinicio (`maestro_reiniciado`). La latencia de cada jugada usa un reloj común entre el maestro y el servidor. Prueba automática del servidor: `node server/probar_enlace.mjs`.
- **Compatibilidad:** el firmware publicado sigue siendo el v3, que no envía secuencia; con él todo funciona como antes.
- **Pausa técnica:** botón aparte de «Pausar» para detener el intento por un problema del montaje (cubo, batería, cable). Se registra como `pausa_tecnica` / `fin_pausa_tecnica` en la bitácora de cubos (marcadores EEG 59 y 60), no en la de mediación, y el jugador ve «Un momento · Estamos acomodando el tablero».
- **Jugadas rechazadas:** cada `falla_movimiento` anota `msDesdeListaCubos` y `edadDatoCuboMs`, para filtrar después las que pudieron deberse a un cubo ya desconectado. La regla de clasificación no cambia.
- **Vista del jugador:** ya no muestra «N de 10 cubos»; ese diagnóstico queda en la consola del operador.
- **Historial de versiones:** cada versión se despliega con sus correcciones, mejoras y novedades, con filtros por tipo.

## 0.12.3 · 2026-11-21 · el juego al centro de la atención

- **Simulación libre y Tutorial guiado:** en pantallas de 1100 px o más, el tablero ocupa 3/5 del ancho y el grafo 2/5 (antes 5:6, con el grafo por encima de la mitad: la atención, que está en los cubos, quedaba a un lado de la pantalla). Anchos mínimos de 520 px para el juego y 380 px para el grafo.
- **Vista de observador:** el orden pasa a ser tablero en vivo, registrar observación y grafo de estados; el cronómetro queda centrado, como en Control, con movimientos y pares a la derecha (en el celular, todo centrado en una columna).

## 0.12.2 · 2026-11-21 · logo oficial en la pestaña

- La pestaña del navegador muestra la marca de Escalera Inteligente (la escalera de `Logo`, mitad azul y mitad roja), centrada para leerse a 16 px. Antes mostraba el ícono genérico de Vite con una ruta absoluta (`/vite.svg`) que en GitHub Pages ni siquiera cargaba.
- `favicon.svg` para navegadores actuales, `favicon-32.png` como respaldo y `apple-touch-icon.png` (180 px, fondo de la app) para iPhone y iPad; rutas relativas.
- En el celular, la barra del navegador toma el color de fondo de la app (`theme-color`).

## 0.12.1 · 2026-11-21 · textos sin montarse

Auditoría automática de las seis vistas en cinco anchos (390, 768, 1280, 1440 y 1920 px), bajando por cada vista: textos que desbordan su caja, recortados, solapados, fuera de pantalla y controles de la barra ocultos. Resultado: 0 hallazgos (antes: el botón «Terminar sesión» cortado o fuera de la barra en el computador, tarjetas de nivel ilegibles en el celular).

- **Barra superior en dos carriles.** Las pestañas se desplazan si no caben, sin partirse en dos líneas; versión, «Terminar sesión» y perfil quedan siempre a la vista. En el celular, las acciones van en una fila propia sobre las pestañas, con un difuminado que avisa que hay más pestañas a los lados, y la pestaña elegida se centra.
- **Nombres de pestaña cortos** («1 · Control», «2 · Tutorial»…) cuando la barra mide menos de 1500 px; el nombre completo sigue como etiqueta accesible. El modo de la vista queda como punto de color con su texto para lectores de pantalla y al pasar el puntero.
- **«Cómo usar esta vista»** empieza cerrada en el celular y, abierta, ocupa como máximo un tercio de la pantalla (antes, más de la mitad fija sobre la vista).
- **Tutorial:** por debajo de 1100 px, las tarjetas de nivel muestran número y estrellas (el título está en el panel del nivel y en la etiqueta del botón).
- **Celular:** las tarjetas Pausar/Pensar/Actuar/Estado inicial van de dos en dos; los títulos de sección y el encabezado del tablero bajan de línea lo de la derecha en vez de partirse en una columna.

## 0.12.0 · 2026-11-21 · accesibilidad

- La página se declara en español (`<html lang="es">`): los lectores de pantalla ya no la leen con pronunciación inglesa.
- **Contraste WCAG:** texto secundario de 3,6:1 a 4,8:1; bordes de campos y botones de 1,8:1 a 3,4:1; casilla vacía del tablero de 2,3:1 a 3,1:1; ajustes equivalentes en la superficie de los informes.
- La conexión de cada cubo ya no depende solo del color: círculo lleno con ✓ si está conectado, aro con ✕ si no, con nombre accesible (Control y Vista de observador).
- Se respeta «reducir movimiento» del sistema: sin destello del trazo ni barras de vibración animadas; las señales de fase conservan un halo fijo de su color.
- Controles de al menos 24 px con mouse y 44 px en pantallas táctiles.
- Las pestañas forman una navegación con nombre y la activa se anuncia; los campos de nombre tienen etiqueta real; el mensaje del Tutorial guiado se anuncia a lectores de pantalla.
- Los campos que confirman con Enter ya no lo hacen a mitad de una composición de IME.

## 0.11.0 · 2026-11-21 · primera versión del historial público

- **Auditoría de color de los grafos.** Se midió el contraste WCAG contra el fondo y la distancia CIEDE2000 entre cada par de categorías, con visión normal y simulando protanopia, deuteranopia y tritanopia (Machado et al., 2009).
  - **Tema claro** (informes, PDF y figuras): el último recorrido pasa a ocre (el naranja no llegaba al contraste mínimo y, oscurecido, se confundía con el rojo), el camino sin retorno a carmín, las rutas mínimas a ciruela y «sin salida» a círculo hueco. Todas las categorías (inicio, fin, recorrido, repeticiones, sin retorno, rutas mínimas) superan contraste 3 y el par más cercano queda en ΔE 12,4. Los nodos y aristas de fondo quedan tenues a propósito, como contexto. «Sin retorno» y «sin salida» comparten el color carmín y se distinguen por la forma: rombo relleno y círculo hueco.
  - **Tema oscuro** (consola): el verde del inicio y el rojo del camino sin retorno se confundían con deuteranopia (ΔE 4,6); con los colores nuevos, el par más cercano queda en 15,5.
- **Nomenclatura en cada grafo:** en el HTML y en el PDF, cada grafo lleva debajo la leyenda de colores y formas y «Cómo leerlo», con los números de ese grafo. En el HTML interactivo se ajusta a si las rutas mínimas están visibles.
- La leyenda en pantalla distingue las formas: rutas mínimas en línea discontinua y «sin salida» como círculo hueco.
- **Correcciones de una auditoría independiente del código de hoy:**
  - **Análisis de la mediación:** una sugerencia descartada o pendiente mientras había una señal vigente ya no le quita a la señal la decisión que la siguió («descartadas absorbidas», informadas aparte). Una sugerencia reemplazada por otra fase no cuenta como «no intervenir» («reemplazadas», también aparte). La regla del anillo pendiente se aplica solo a bitácoras ppa-v2, así que las ppa-v1 se reanalizan como antes. Los escenarios de la auditoría quedan como pruebas en `ppa:verificar`.
  - **Motor PPA:** al enviar otra fase se cierra la sugerencia pendiente. Pausar (dos fallas) tiene prioridad sobre un Actuar pendiente. El tiempo sin mover se reinicia tras una corrección o una pausa en Control.
  - **Importación:** las bitácoras importadas conservan la versión PPA, el origen y los motivos, así que se reanalizan igual que en vivo.
  - **Exportación:** el botón de imagen HD del HTML usa un índice estable y ya no falla si un grafo anterior no se capturó.
  - **Versión:** una compilación con cambios sin commit lo dice («+commit-modificado»), para no citar una combinación versión+commit que no existe.
  - **Celular:** el menú de perfil ya no queda recortado.
- La limitación sobre los datos aclara que, en Control, el servidor local también escribe un archivo con el nombre del participante.

## 0.10.0 · 2026-11-20

- **Celulares:** la aplicación se adapta a pantallas angostas.
  - Las pestañas quedan en una sola línea con desplazamiento propio.
  - Las columnas se apilan.
  - Los tableros de 11 casillas se reducen para caber completos.
  - Los botones se reparten en varias líneas.
- **Advertencias (fase 1):** distintivo «v0.10.0 · en desarrollo» que abre las limitaciones conocidas. Cada limitación aparece también donde se decide: datos solo en el navegador y mediación descriptiva, no causal.
- **Guía rápida (fase 2):** panel «¿Primera vez?» con tres caminos en la pantalla de inicio, y «Cómo usar esta vista» en cada pestaña.
- **Grafos para publicar:** en el tema de los informes, paleta apta para daltonismo (Okabe e Ito):
  - Inicio verde azulado, Fin azul, último recorrido naranja, camino sin retorno bermellón y rutas mínimas magenta.
  - Las repeticiones en escala gris azulada, que se lee también impresa en blanco y negro.
  - Inicio y Fin conservan su color aunque el recorrido pase por ellos.
- **Figura HD de cada grafo:** se descarga desde la vista previa del informe y desde el HTML. Lleva encabezado con la identidad del proyecto y de la UD, título, leyenda de colores y formas, cómo leerla con los números de ese grafo, y pie con créditos, versión y fecha al segundo.

## 0.9.0 · 2026-11-20

- **Versión y marcas de tiempo:** la versión del software y el commit aparecen en cada informe y quedan en cada sesión y paquete de datos. Las fechas se escriben al segundo y con zona horaria, por ejemplo `2026-11-20 18:42:07 (UTC−05:00)`.
- **Mediación (ppa-v2):** tres anillos discretos. Actuar se mide por tiempo, con un umbral que fija la persona que opera (de 2 a 30 s); se retiró la calibración por percentil 90. El análisis de la mediación cuenta como descartada la jugada hecha con un anillo lleno que no se envió.
- **Informes:**
  - PDF con la identidad del proyecto y de la Universidad Distrital.
  - Menú de descarga (PDF, HTML, CSV, JSON) con la descripción de cada formato.
  - HTML interactivo, con un interruptor para mostrar u ocultar las rutas más cortas.
  - Opción de exportar los grafos con o sin esas rutas.
  - «Guardar en el historial», con nombre editable.
- **Grafos:** las rutas mínimas pasan a magenta, con contorno sobre los recorridos y línea discontinua donde no se pasó, para que contrasten aunque haya muchos recorridos encima.
- **Perfiles simulados:** cinco perfiles con nombres descriptivos, cada uno con su combinación de R y β y cómo leer sus datos. Ya no se cargan EJEMPLO-A ni EJEMPLO-B: siguen en el repositorio porque la tesis publica sus cifras.
- **Auditorías:** los perfiles simulados entran en `importacion:verificar` y `datos:verificar`.

## 0.8.0 · 2026-11-20

- Repositorio público con el software solamente, y protección de datos:
  - sesiones de ejemplo sintéticas;
  - retiro, al arrancar la aplicación, de las sesiones reales que dejó en los navegadores una versión anterior;
  - credenciales fuera del código.
- Un mismo motor de mediación para las tres vistas, registro ampliado, paquete de datos seudonimizado con diccionario, marcadores para EEG y verificación previa al inicio.

## 0.7.0 · 2026-10-22

- Agregación ponderada, eficiencia E y estratificación por nivel; tiempos de planificación y latencia por decisión.
- Efecto de la mediación en los informes.
- Cubos v3, con las correcciones de la prueba de banco.
- Respaldo durable de sesiones e informes, y la misma información en pantalla y en archivo.

## 0.6.0 · 2026-10-17

- Estado real del tablero, vista del jugador, telemetría de los cubos y sincronización con el EEG.

## 0.5.0 · 2026-10-08

- Informes en dos niveles, perfiles con historial y trazabilidad entre sesiones.
- Publicación en GitHub Pages.
- Las métricas tienen en cuenta que la solución mínima no es única.

## 0.4.0 · 2026-10-02

- Reglas oficiales del juego (libro, Fig. 3.3) y grafo de estados en vivo.

## 0.3.0 · 2026-09-25

- Tutorial guiado con motor pedagógico, Simulación libre y Vista de observador.

## 0.2.0 · 2026-09-18

- Menor latencia entre el maestro y los cubos, control de partida con código de colores, y rediseño de la consola con su identidad visual.

## 0.1.0 · 2026-09-01

- Primera estructura propia sobre la línea base de ACACIA: pestañas de Control, Simulación y Observador, controlador simulado y bitácoras independientes.


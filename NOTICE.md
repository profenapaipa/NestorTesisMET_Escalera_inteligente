# Créditos

## Línea base: proyecto ACACIA, módulo INNOVA

De la entrega del módulo INNOVA del proyecto ACACIA provienen el diseño mecánico y electrónico de los cubos inteligentes y de la base, el firmware original de los cubos y del maestro, y una primera versión del software de control (interfaz en React y servidor en Node.js con Socket.IO).

## Desarrollado en este trabajo

- Firmware v3 de los cubos y del maestro: tareas concurrentes, TCP persistente, antirrebote, secuencias en el cubo, eco y telemetría, identidad por IP y patrones de vibración por fase.
- Comunicación: descubrimiento automático del servidor, estado de conexión de la base y de cada cubo, y cola de órdenes con medición de latencia.
- Aplicación: motor de reglas oficial, grafo del espacio del problema en vivo, métricas de trayectoria, informes, seis vistas, bitácoras, paquete de datos y marcadores para EEG.
- Protocolo Mago de Oz: motor de sugerencias Pausar–Pensar–Actuar con confirmación del operador.

Trabajo de grado de maestría de Nestor Paipa, Universidad Distrital Francisco José de Caldas.

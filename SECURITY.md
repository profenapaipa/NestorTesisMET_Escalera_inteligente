# Seguridad y protección de datos

## Qué nunca se sube a este repositorio

- **Datos de participantes:** bitácoras de sesión, exportaciones, videos, registros EEG o cualquier archivo con nombres o identificadores reales. Las sesiones de ejemplo de `app-web/src/assets/sesiones/` son sintéticas.
- **Credenciales:** las claves WiFi del firmware van en `firmware/*/secrets.h`, que está en `.gitignore`. Solo se publica la plantilla `secrets.example.h`.
- **Bitácoras del servidor:** `backend/bitacoras/` está excluida.

## La aplicación publicada

La versión de GitHub Pages funciona por completo en el navegador. Las sesiones que se juegan quedan en el almacenamiento local de ese navegador (IndexedDB) y no se envían a ningún servidor. El paquete de datos que exporta la aplicación sale seudonimizado por defecto.

## El servidor local

`backend/` está pensado para una red local cerrada durante una sesión (computador del operador + maestro ESP32). No tiene autenticación y no debe exponerse a internet.

## Reportar un problema

Si encuentras una credencial, un dato personal o una vulnerabilidad, abre un *issue* sin incluir el dato en el texto, o escribe al autor por los medios de contacto de su perfil de GitHub.

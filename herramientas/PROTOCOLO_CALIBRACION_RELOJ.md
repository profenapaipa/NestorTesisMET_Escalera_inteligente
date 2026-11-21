# Protocolo de calibración del reloj (EEG ↔ aplicación)

**Para qué sirve.** `sincronizar_eeg.py` alinea los marcadores con el EEG por la hora del computador y informa un «error típico» del ajuste. Ese error es la dispersión de los sellos de hora alrededor de la recta; **no** es la exactitud absoluta. Este protocolo mide el desfase constante que el ajuste no ve (latencia del dongle y del programa de adquisición) y deja una cifra propia de cada montaje que sustituye a la que cita la tesis como cota.

**Qué lo hace válido.** Un parpadeo fuerte deja un artefacto grande y reconocible en los canales frontales del EEG. Si el parpadeo y el clic del botón «Calibración (parpadeo)» ocurren a la vez, la diferencia entre el instante del artefacto y el del marcador es el desfase del sistema.

## Antes de grabar

1. El OpenBCI GUI y la aplicación corren en el **mismo computador** (mismo reloj).
2. Abre una consola y anota el estado del servicio de hora: `w32tm /query /status`. Si es posible, desactiva «Establecer la hora automáticamente» durante la grabación (y vuélvela a activar después): un ajuste del reloj a mitad de sesión desplaza los eventos. La aplicación detecta esos saltos (`saltos_de_reloj` en `sesion.json`), pero es mejor que no ocurran.
3. Verifica que el canal 0 (Fp1) tiene buen contacto: se ve el parpadeo en el GUI.

## Durante la sesión

1. **Línea base:** pulsa «Inicio de la línea base», un minuto en reposo, «Fin de la línea base». (La duración y la condición —ojos abiertos o cerrados— las define el protocolo de la tesis, no este documento.)
2. **Calibración al inicio:** 10 parpadeos fuertes, separados al menos 3 s. En cada uno, **parpadea y pulsa «Calibración (parpadeo)» en el mismo instante**. No esperes a ver el parpadeo para pulsar: eso suma el tiempo de reacción (200–400 ms) y falsea la medida.
3. **Calibración al final:** otros 10 antes de «Fin de la sesión». Si el desfase cambió entre el principio y el final, el reloj se movió durante la grabación.

## Después

```
python -I sincronizar_eeg.py "Sesion 1.txt" marcadores_eeg.csv --calibracion
```

Resultado: nº de parejas (parpadeo, marcador), la **mediana** del desfase y su dispersión (MAD).

- Con menos de 5 parejas no es fiable: repetir.
- Un desfase positivo significa que el marcador llega **antes** que el artefacto en la señal. Para corregir, pasarlo con `--desfase`.
- Si pasa de 0,5 s: relojes distintos, o un EEG que no es de esa sesión.

## Qué NO resuelve

- La sincronía entre un parpadeo y un clic de una misma persona no es exacta (decenas de ms): la medida sirve para detectar desfases de cientos de milisegundos y para acotar el desfase sistemático, **no** para afinar por debajo de unos 50 ms.
- Para análisis sincronizados con cada jugada (ERD por jugada, potenciales) hace falta un marcador dentro de la propia señal: el reenvío UDP al GUI (nivel 1, `OPENBCI_MARCADORES` en el backend; la diferencia entre el momento de envío, anotado en el registro `marcador_udp` de la bitácora, y la hora que el GUI graba mide ese tramo), un flujo LSL (nivel 2) o un disparador por cable (nivel 3). Estos dos últimos no están implementados.
- El nivel 1 está preparado pero no probado con un casco real: hay que comprobar qué widget y qué puerto admite la versión instalada del GUI.

"""Prueba de sincronizar_eeg.py con un EEG sintético (sin datos de nadie).

Fabrica un registro de 125 Hz cuyos sellos de hora llegan por lotes (como los del
OpenBCI GUI), con parpadeos de posición conocida, y marcadores puestos con un
desfase conocido. Comprueba que el script:
  - recupera la frecuencia de muestreo,
  - asigna cada marcador a su muestra,
  - descarta los repetidos de otra instancia pero conserva dos seguidos de la misma,
  - arma las ventanas (línea base, intento, señal),
  - mide el desfase de la calibración.

Uso:  python -I probar_sincronizar_eeg.py
"""
import importlib.util
import math
import random
import sys
import tempfile
from pathlib import Path

ruta = Path(__file__).resolve().parent / 'sincronizar_eeg.py'
spec = importlib.util.spec_from_file_location('sincronizar_eeg', ruta)
se = importlib.util.module_from_spec(spec)
spec.loader.exec_module(se)

fallos = 0


def chk(ok, msg):
    global fallos
    print(('  OK    · ' if ok else '  FALLO · ') + msg)
    if not ok:
        fallos += 1


FS = 125.0
T0 = 1_760_000_000.0  # hora Unix de la primera muestra
N = int(FS * 120)  # dos minutos
rnd = random.Random(7)

# Parpadeos (µV) en instantes conocidos; los marcadores de calibración se ponen
# con un desfase verdadero de +120 ms (el marcador llega 120 ms antes que el artefacto).
DESFASE_VERDADERO = 0.12
INSTANTES_PARPADEO = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]


def sello(k):
    """Los sellos de hora de OpenBCI llegan por lotes de 5 muestras."""
    return T0 + (k // 5) * 5 / FS


with tempfile.TemporaryDirectory() as tmp:
    eeg = Path(tmp) / 'sintetico.txt'
    with eeg.open('w', encoding='utf-8') as f:
        f.write('%OpenBCI Raw EXG Data\n%Number of channels = 16\n%Sample Rate = 125 Hz\n')
        cols = ['Sample Index'] + [f'EXG Channel {c}' for c in range(16)] + ['Timestamp']
        f.write(', '.join(cols) + '\n')
        for k in range(N):
            t = k / FS
            v0 = rnd.gauss(0, 8)
            for tb in INSTANTES_PARPADEO:
                v0 += 180 * math.exp(-((t - tb) ** 2) / (2 * 0.06 ** 2))
            fila = [str(k % 256), f'{v0:.3f}'] + [f'{rnd.gauss(0, 8):.3f}' for _ in range(15)] + [f'{sello(k):.6f}']
            f.write(', '.join(fila) + '\n')

    cab, datos, i_ts, fs_nom = se.leer_eeg(eeg)
    a, b, rms, peor, _, _ = se.ajustar_reloj(datos, i_ts)
    chk(abs(1 / b - FS) < 0.5, f'recupera la frecuencia de muestreo: {1 / b:.2f} Hz (esperada {FS})')

    marcas = []
    for tb in INSTANTES_PARPADEO:
        marcas.append({'t': T0 + tb - DESFASE_VERDADERO, 'codigo': 53, 'evento': 'calibracion',
                       'detalle': '', 'intento': '', 'instancia': 'A'})

    def m(t, codigo, evento, intento, inst):
        return {'t': T0 + t, 'codigo': codigo, 'evento': evento, 'detalle': '', 'intento': intento, 'instancia': inst}

    # una línea base, un intento con su señal, un duplicado de otra ventana y dos fallas seguidas de la misma
    marcas += [
        m(2, 50, 'basal_inicio', '', 'A'), m(8, 51, 'basal_fin', '', 'A'),
        m(12.0, 11, 'inicio_juego', 1, 'A'), m(12.1, 11, 'inicio_juego', 1, 'B'),
        m(15.0, 22, 'falla_movimiento', 1, 'A'), m(15.1, 22, 'falla_movimiento', 1, 'A'),
        m(16.0, 32, 'senal_pausar', 1, 'A'), m(30.0, 40, 'victoria', 1, 'A'),
    ]
    marcas.sort(key=lambda x: x['t'])
    limpios, repetidos = se.quitar_duplicados(marcas)
    chk(repetidos == 1, f'descarta un marcador repetido de otra ventana (descartó {repetidos})')
    chk(sum(1 for x in limpios if x['codigo'] == 22) == 2, 'conserva dos fallas seguidas de la misma ventana')

    peor_error = max(abs(se.a_muestra(x['t'], a, b) - round((x['t'] - T0) * FS)) for x in limpios)
    chk(peor_error <= 6, f'cada marcador cae en su muestra (peor error {peor_error} muestras; el sello por lotes admite hasta 5)')

    vent = se.ventanas_de_marcadores(limpios)
    tipos = {v[0] for v in vent}
    chk(tipos >= {'basal', 'intento', 'pausar'}, f'arma ventanas de línea base, intento y señal: {sorted(tipos)}')
    basal = [v for v in vent if v[0] == 'basal'][0]
    chk(abs((basal[3] - basal[2]) - 6.0) < 1e-6, 'la línea base dura lo que hay entre sus dos marcadores')
    inte = [v for v in vent if v[0] == 'intento'][0]
    chk(abs((inte[3] - inte[2]) - 18.0) < 0.2 and inte[1] == 1, 'el intento va de «inicio_juego» a «victoria»')

    med = se.calibrar(datos, cab, a, b, 1 / b, limpios, 0, 0.0)
    # Los sellos por lotes de 5 muestras van, en promedio, 2 muestras (16 ms) por
    # detrás de la hora real: ese sesgo es parte del sistema, y la calibración lo
    # recoge. Por eso lo esperado es el desfase verdadero menos esos 16 ms.
    esperado = DESFASE_VERDADERO - 2 / FS
    chk(med is not None and abs(med - esperado) < 0.02,
        f'mide el desfase de la calibración: {None if med is None else round(med * 1000)} ms '
        f'(esperado {round(esperado * 1000)} ms = 120 ms de desfase menos 16 ms del sello por lotes)')

print('\n>>> SINCRONIZACIÓN EEG OK' if not fallos else f'\n>>> {fallos} FALLOS en sincronizar_eeg.py')
sys.exit(1 if fallos else 0)

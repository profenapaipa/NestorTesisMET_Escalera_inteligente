"""Alinea los marcadores de una sesión de Cubos Inteligentes con el EEG.

El archivo crudo del OpenBCI GUI ("OpenBCI Raw EXG Data", Cyton+Daisy)
trae en cada muestra la hora del PC (columna "Timestamp", segundos Unix).
La aplicación guarda sus marcadores con la hora del mismo reloj, así
que cada marcador cae en la muestra cuya hora es la más cercana.

La columna Timestamp no avanza muestra a muestra: el GUI la pone al recibir
cada paquete, así que muchas muestras seguidas comparten la misma hora y hay
saltos. Por eso no se busca la muestra "más cercana" a lo bruto, sino que se
ajusta una recta hora = a + b * muestra a todo el registro (el reloj de la
placa es estable) y con ella se convierte la hora de cada marcador en número
de muestra. El script informa la frecuencia que resulta del ajuste y el
error típico, para ver de un vistazo si el registro tuvo cortes.

Qué mide ese error y qué no: la dispersión de los sellos de hora alrededor de
la recta. NO es la exactitud absoluta de la alineación: el desfase constante
entre el instante real del evento y el de la muestra (latencia del dongle y del
programa de adquisición) no se ve ahí. Para medirlo está --calibracion.

Requisito: el OpenBCI GUI y el navegador con la aplicación deben correr en el
MISMO computador (mismo reloj). Si no, hay que medir la diferencia entre
relojes y pasarla con --desfase.

Entradas de marcadores aceptadas:
  - el CSV `marcadores_eeg.csv` del paquete de datos de la sesión (sale de la
    bitácora y vale para TODAS las vistas), o el que descarga Control
    ("Descargar marcadores EEG"), o
  - la bitácora en disco del backend (bitacoras/<sesion>.jsonl). Si dos
    ventanas de Control estuvieron abiertas, cada marcador aparece dos veces;
    aquí se descartan los repetidos de instancias distintas.

Salidas (junto al archivo EEG, o en --salida):
  - <eeg>_eventos.txt  tabla para EEGLAB: latency (s), type (código), evento, intento
  - <eeg>_marcadores.csv  con la muestra asignada a cada marcador y su error
  - <eeg>_ventanas.csv  inicio y fin (en muestras) de la línea base, de cada
    intento y de cada señal: lo que hace falta para promediar por ventana (alfa TRP)
  - con --fusionar: <eeg>_con_marcadores.txt, el mismo archivo crudo con una
    columna "Marker" añadida (código del marcador en su muestra, 0 en el resto)

Uso:
  python -I sincronizar_eeg.py "Sesion 1.txt" marcadores_eeg.csv
  python -I sincronizar_eeg.py "Sesion 1.txt" ../Backend-Cubos-Inteligentes-main/bitacoras/xxx.jsonl --fusionar
  python -I sincronizar_eeg.py "Sesion 1.txt" marcadores_eeg.csv --ventanas ventanas.csv
  python -I sincronizar_eeg.py "Sesion 1.txt" marcadores_eeg.csv --calibracion

--calibracion mide el desfase del reloj con los marcadores de código 53
(calibracion): ver PROTOCOLO_CALIBRACION_RELOJ.md.

En EEGLAB (MATLAB), tras cargar el EEG:
  EEG = pop_importevent(EEG, 'event', 'Sesion 1_eventos.txt', ...
        'fields', {'latency','type','evento','intento'}, 'skipline', 1, 'timeunit', 1);
"""

import argparse
import csv
import json
import math
import sys
from pathlib import Path

# Códigos fijos de los marcadores (src/core/control/marcadoresEeg.ts).
COD_INICIO_JUEGO = 11
COD_FIN_INTENTO = {40, 41, 42, 44}  # victoria, derrota, reinicio, terminar
COD_SENALES = {32: 'pausar', 33: 'pensar', 34: 'actuar'}
COD_BASAL_INICIO, COD_BASAL_FIN, COD_CALIBRACION = 50, 51, 53
DURACION_SENAL_S = 5.0  # AUTO_OFF_MS: la señal se apaga sola a los 5 s
DUPLICADO_S = 0.25


def leer_eeg(ruta: Path):
    """Devuelve (cabecera, lineas_de_datos, indice_timestamp, frecuencia_nominal)."""
    cabecera, datos = [], []
    fs_nominal = None
    with ruta.open(encoding='utf-8', errors='replace') as f:
        for linea in f:
            if linea.startswith('%'):
                cabecera.append(linea)
                if 'Sample Rate' in linea:
                    try:
                        fs_nominal = float(linea.split('=')[1].split()[0])
                    except (IndexError, ValueError):
                        pass
                continue
            if linea.lstrip().startswith('Sample Index'):
                cabecera.append(linea)
                continue
            if linea.strip():
                datos.append(linea.rstrip('\r\n'))
    columnas = [c.strip() for c in cabecera[-1].split(',')]
    if 'Timestamp' not in columnas:
        sys.exit('El archivo EEG no tiene columna "Timestamp" (¿es un archivo crudo del OpenBCI GUI?).')
    return cabecera, datos, columnas.index('Timestamp'), fs_nominal


def ajustar_reloj(datos, i_ts):
    """Recta hora = a + b * muestra por mínimos cuadrados."""
    xs, ys = [], []
    for k, linea in enumerate(datos):
        partes = linea.split(',')
        try:
            t = float(partes[i_ts])
        except (IndexError, ValueError):
            continue
        if t > 1e9:  # hora Unix válida
            xs.append(k)
            ys.append(t)
    if len(xs) < 10:
        sys.exit('Muy pocas muestras con hora válida en la columna Timestamp.')
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    b = sxy / sxx
    a = my - b * mx
    residuos = [y - (a + b * x) for x, y in zip(xs, ys)]
    rms = math.sqrt(sum(r * r for r in residuos) / n)
    peor = max(abs(r) for r in residuos)
    return a, b, rms, peor, ys[0], ys[-1]


def leer_marcadores(ruta: Path):
    """Lista de dicts {t (s Unix), codigo, evento, detalle, intento, instancia}."""
    out = []
    if ruta.suffix.lower() == '.jsonl':
        with ruta.open(encoding='utf-8') as f:
            for linea in f:
                if not linea.strip():
                    continue
                r = json.loads(linea)
                m = r.get('marcador') if r.get('registro') == 'marcador_eeg' else None
                if m:
                    out.append({'t': m['tsMs'] / 1000, 'codigo': int(m['codigo']), 'evento': m['evento'],
                                'detalle': m.get('detalle', ''), 'intento': m.get('intentoNum') or '',
                                'instancia': r.get('instancia')})
    else:
        with ruta.open(encoding='utf-8-sig', newline='') as f:
            for r in csv.DictReader(f):
                out.append({'t': float(r['timestamp_unix']), 'codigo': int(r['codigo']), 'evento': r['evento'],
                            'detalle': r.get('detalle', ''), 'intento': r.get('intento', ''), 'instancia': None})
    out.sort(key=lambda m: m['t'])
    return out


def quitar_duplicados(marcadores):
    """Descarta el marcador repetido que escribe una segunda ventana de Control.

    Dos marcadores con el mismo código e intento, a menos de 0,25 s y de
    INSTANCIAS DISTINTAS son el mismo hecho registrado dos veces. Dos de la misma
    instancia son hechos distintos y se conservan.
    """
    limpios, ultimos = [], {}
    descartados = 0
    for m in marcadores:
        clave = (m['codigo'], str(m['intento']))
        previos = ultimos.setdefault(clave, [])
        if any(abs(m['t'] - t) < DUPLICADO_S and inst != m['instancia'] and (inst is not None or m['instancia'] is not None)
               for t, inst in previos):
            descartados += 1
            continue
        previos.append((m['t'], m['instancia']))
        limpios.append(m)
    return limpios, descartados


def ventanas_de_marcadores(marcadores):
    """Ventanas (tipo, intento, inicio, fin) a partir de los códigos de marcador."""
    out = []
    basal = None
    inicio_intento = None
    for m in marcadores:
        c, t = m['codigo'], m['t']
        if c == COD_BASAL_INICIO:
            basal = t
        elif c == COD_BASAL_FIN and basal is not None:
            out.append(('basal', '', basal, t))
            basal = None
        elif c == COD_INICIO_JUEGO:
            inicio_intento = (t, m['intento'])
        elif c in COD_FIN_INTENTO and inicio_intento is not None:
            out.append(('intento', inicio_intento[1], inicio_intento[0], t))
            inicio_intento = None
        elif c in COD_SENALES:
            out.append((COD_SENALES[c], m['intento'], t, t + DURACION_SENAL_S))
    return sorted(out, key=lambda v: v[2])


def leer_ventanas(ruta: Path):
    """Ventanas del paquete de datos (ventanas.csv)."""
    out = []
    with ruta.open(encoding='utf-8-sig', newline='') as f:
        for r in csv.DictReader(f):
            out.append((r['tipo'], r.get('intento', ''), float(r['inicio_unix']), float(r['fin_unix'])))
    return out


def a_muestra(t, a, b):
    return round((t - a) / b)


# ── Calibración del reloj ──────────────────────────────────────────────────

def mediana(xs):
    s = sorted(xs)
    n = len(s)
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2


def picos_de_artefacto(datos, columna, fs, umbral_mad=6.0):
    """Instantes (en muestras) de los parpadeos: picos grandes de un canal frontal.

    Se quita la deriva con una media móvil de 1 s, se mide el ruido con la MAD y se
    toma como parpadeo el máximo local de |x| que supera `umbral_mad` veces ese
    ruido, con 0,5 s de separación mínima.
    """
    x = []
    for linea in datos:
        partes = linea.split(',')
        try:
            x.append(float(partes[columna]))
        except (IndexError, ValueError):
            x.append(0.0)
    n = len(x)
    w = max(3, int(fs))
    acum = [0.0]
    for v in x:
        acum.append(acum[-1] + v)
    y = []
    for i in range(n):
        lo, hi = max(0, i - w // 2), min(n, i + w // 2 + 1)
        y.append(x[i] - (acum[hi] - acum[lo]) / (hi - lo))
    ruido = mediana([abs(v) for v in y]) * 1.4826 or 1.0
    # |x| suavizado con 0,1 s: el pico de un parpadeo es ancho y el ruido crea
    # máximos locales en su flanco de subida; quedarse con el primero adelantaría
    # el pico. Se agrupan las muestras que superan el umbral y se toma, en cada
    # grupo, el máximo del suavizado.
    h = max(1, int(0.05 * fs))
    absy = [abs(v) for v in y]
    ac = [0.0]
    for v in absy:
        ac.append(ac[-1] + v)
    suave = [(ac[min(n, i + h + 1)] - ac[max(0, i - h)]) / (min(n, i + h + 1) - max(0, i - h)) for i in range(n)]
    sobre = [i for i in range(n) if absy[i] > umbral_mad * ruido]
    picos, grupo = [], []
    for i in sobre:
        if grupo and i - grupo[-1] > 0.4 * fs:
            picos.append(max(grupo, key=lambda q: suave[q]))
            grupo = []
        grupo.append(i)
    if grupo:
        picos.append(max(grupo, key=lambda q: suave[q]))
    return picos


def calibrar(datos, cabecera, a, b, fs, marcadores, canal, desfase):
    """Estima el desfase marcador->EEG con los marcadores de calibración.

    Cada marcador se pone al MISMO TIEMPO que un parpadeo fuerte (no después de
    verlo: eso sumaría el tiempo de reacción). Para cada uno se busca el pico de
    artefacto más cercano a +/-1 s; la mediana de las diferencias es el desfase.
    """
    columnas = [c.strip() for c in cabecera[-1].split(',')]
    nombre = f'EXG Channel {canal}'
    if nombre not in columnas:
        sys.exit(f'No encuentro la columna "{nombre}" en el archivo EEG.')
    picos = picos_de_artefacto(datos, columnas.index(nombre), fs)
    marcas = [m for m in marcadores if m['codigo'] == COD_CALIBRACION]
    if not marcas:
        sys.exit('No hay marcadores de calibración (código 53) en el archivo de marcadores.')
    difs = []
    for m in marcas:
        k = a_muestra(m['t'] + desfase, a, b)
        cerca = [p for p in picos if abs(p - k) <= fs]
        if cerca:
            p = min(cerca, key=lambda q: abs(q - k))
            difs.append((p - k) / fs)
    print(f'\nCalibración: {len(marcas)} marcadores, {len(picos)} parpadeos detectados en el canal {canal}, {len(difs)} emparejados.')
    if len(difs) < 5:
        print('  AVISO: con menos de 5 parejas la estimación no es fiable. Repetir el protocolo con más parpadeos.')
    if not difs:
        return None
    med = mediana(difs)
    mad = mediana([abs(d - med) for d in difs]) * 1.4826
    print(f'  Desfase estimado (parpadeo - marcador): mediana {med * 1000:+.0f} ms, dispersión {mad * 1000:.0f} ms (MAD)')
    print('  Un valor positivo significa que el marcador llega ANTES que el artefacto en la señal: sumar ese tiempo con --desfase.')
    print('  Cota de exactitud: la sincronía entre un parpadeo y un clic de una misma persona no es exacta (decenas de ms);')
    print('  esta medida sirve para detectar desfases de cientos de ms, no para afinar por debajo de unos 50 ms.')
    if abs(med) > 0.5:
        print('  AVISO: el desfase pasa de 0,5 s: ¿relojes distintos o EEG de otra sesión?')
    return med


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('eeg', type=Path, help='archivo crudo del OpenBCI GUI (.txt)')
    ap.add_argument('marcadores', type=Path, help='marcadores_eeg.csv, CSV de marcadores de Control o bitácora .jsonl del backend')
    ap.add_argument('--desfase', type=float, default=0.0,
                    help='segundos a sumar a la hora de los marcadores (si el EEG se grabó en otro PC)')
    ap.add_argument('--salida', type=Path, help='carpeta de salida (por defecto, la del EEG)')
    ap.add_argument('--fusionar', action='store_true', help='escribir también el EEG con una columna Marker')
    ap.add_argument('--ventanas', type=Path, help='ventanas.csv del paquete de datos (si no, se deducen de los marcadores)')
    ap.add_argument('--calibracion', action='store_true', help='medir el desfase con los marcadores de código 53')
    ap.add_argument('--canal-frontal', type=int, default=0, help='canal EXG con el parpadeo más claro (por defecto 0, Fp1)')
    args = ap.parse_args()

    cabecera, datos, i_ts, fs_nominal = leer_eeg(args.eeg)
    a, b, rms, peor, t_ini, t_fin = ajustar_reloj(datos, i_ts)
    fs = 1 / b
    print(f'EEG: {len(datos)} muestras, {t_fin - t_ini:.1f} s de registro')
    print(f'Frecuencia según el reloj del PC: {fs:.2f} Hz (nominal {fs_nominal or "?"} Hz)')
    print(f'Ajuste del reloj: error típico {rms * 1000:.1f} ms, peor {peor * 1000:.1f} ms')
    print('  (es la dispersión de los sellos de hora, no la exactitud absoluta de la alineación)')
    if fs_nominal and abs(fs - fs_nominal) / fs_nominal > 0.02:
        print('  AVISO: la frecuencia difiere más de un 2 % de la nominal — ¿hubo cortes o paquetes perdidos?')
    if peor > 0.5:
        print('  AVISO: algún tramo se aparta más de 0,5 s de la recta — revisar si el registro se pausó.')

    marcadores = leer_marcadores(args.marcadores)
    if not marcadores:
        sys.exit('No hay marcadores en el archivo indicado.')
    marcadores, repetidos = quitar_duplicados(marcadores)
    if repetidos:
        print(f'Se descartaron {repetidos} marcadores repetidos (el mismo hecho escrito por dos ventanas de Control).')

    if args.calibracion:
        calibrar(datos, cabecera, a, b, fs, marcadores, args.canal_frontal, args.desfase)

    dentro, fuera = [], 0
    for m in marcadores:
        t = m['t'] + args.desfase
        muestra = a_muestra(t, a, b)
        if 0 <= muestra < len(datos):
            dentro.append({**m, 'muestra': muestra, 'latencia_s': muestra / fs})
        else:
            fuera += 1
    print(f'Marcadores: {len(marcadores)} en total, {len(dentro)} dentro del registro EEG, {fuera} fuera')
    if fuera and not dentro:
        print('  Ninguno cae dentro del EEG: ¿son de otra sesión, o el EEG se grabó en otro PC (usar --desfase)?')

    salida = args.salida or args.eeg.parent
    salida.mkdir(parents=True, exist_ok=True)
    base = args.eeg.stem

    with (salida / f'{base}_eventos.txt').open('w', encoding='utf-8', newline='') as f:
        f.write('latency\ttype\tevento\tintento\n')
        for m in dentro:
            f.write(f"{m['latencia_s']:.4f}\t{m['codigo']}\t{m['evento']}\t{m['intento']}\n")

    with (salida / f'{base}_marcadores.csv').open('w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(['timestamp_unix', 'muestra', 'latencia_s', 'codigo', 'evento', 'intento', 'detalle'])
        for m in dentro:
            w.writerow([f"{m['t']:.3f}", m['muestra'], f"{m['latencia_s']:.4f}", m['codigo'], m['evento'], m['intento'], m['detalle']])

    ventanas = leer_ventanas(args.ventanas) if args.ventanas else ventanas_de_marcadores(marcadores)
    colisiones = 0
    vistas = {}
    for m in dentro:
        if m['muestra'] in vistas and vistas[m['muestra']] != m['codigo']:
            colisiones += 1
        vistas.setdefault(m['muestra'], m['codigo'])
    if colisiones:
        print(f'  AVISO: {colisiones} marcadores distintos caen en la misma muestra; en --fusionar solo queda el primero (en eventos.txt están todos).')
    with (salida / f'{base}_ventanas.csv').open('w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(['tipo', 'intento', 'inicio_unix', 'fin_unix', 'inicio_muestra', 'fin_muestra', 'duracion_s'])
        for tipo, intento, ini, fin in ventanas:
            mi, mf = a_muestra(ini + args.desfase, a, b), a_muestra(fin + args.desfase, a, b)
            if mf < 0 or mi >= len(datos):
                continue
            w.writerow([tipo, intento, f'{ini:.3f}', f'{fin:.3f}', max(mi, 0), min(mf, len(datos) - 1), f'{fin - ini:.3f}'])

    if args.fusionar:
        por_muestra = {}
        for m in dentro:
            por_muestra.setdefault(m['muestra'], m['codigo'])  # si dos caen en la misma muestra, queda el primero
        with (salida / f'{base}_con_marcadores.txt').open('w', encoding='utf-8', newline='') as f:
            for linea in cabecera[:-1]:
                f.write(linea if linea.endswith('\n') else linea + '\n')
            f.write(cabecera[-1].rstrip('\r\n') + ', Marker\n')
            for k, linea in enumerate(datos):
                f.write(f'{linea}, {por_muestra.get(k, 0)}\n')

    print(f'Listo: {salida / (base + "_eventos.txt")}')


if __name__ == '__main__':
    main()

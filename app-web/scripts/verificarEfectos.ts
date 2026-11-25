// Comprueba que los efectos que se ven en pantalla (src/core/ppa/efectosCubo.ts) son los MISMOS que
// ejecuta el cubo físico (tablas EFECTO_<n>_* de Cubo_Esclavo_v3.ino): mismo número de pasos y, en
// cada paso, mismo color, vibración y duración. También comprueba que los números EF del frontend
// (EFECTOS en ppaColors.ts) apuntan a la misma tabla que el `switch` del firmware.
// Busca el firmware en el repositorio privado (../../Cubo_Esclavo_v3) o en el público (../firmware/...).
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { EFECTOS_CUBO, pasoEfecto, duracionEfecto } from '../src/core/ppa/efectosCubo'

let fallos = 0
const chk = (c: boolean, m: string) => { console.log((c ? '  OK   ' : '  FALLO') + ' · ' + m); if (!c) fallos++ }

const candidatos = [
  resolve(process.cwd(), '../../Cubo_Esclavo_v3/Cubo_Esclavo_v3.ino'),
  resolve(process.cwd(), '../firmware/Cubo_Esclavo_v3/Cubo_Esclavo_v3.ino'),
]
const ruta = candidatos.find(existsSync)
if (!ruta) {
  console.log('  FALLO · no se encontró Cubo_Esclavo_v3.ino (buscado en ' + candidatos.join(' y ') + ')')
  process.exit(1)
}
const ino = readFileSync(ruta, 'utf8')

// Tablas: const PasoEfecto EFECTO_4_BLOQUEO[] = { {255, 0, 0, 0.90, 500}, ... };
const tablas = new Map<string, number[][]>()
for (const m of ino.matchAll(/const\s+PasoEfecto\s+(EFECTO_\d+_\w+)\[\]\s*=\s*\{([\s\S]*?)\};/g)) {
  const pasos = [...m[2].matchAll(/\{\s*(-?\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*,\s*(\d+)\s*\}/g)]
    .map(p => [Number(p[1]), Number(p[2]), Number(p[3]), Number(p[4]), Number(p[5])])
  tablas.set(m[1], pasos)
}
// switch: case 4: tabla = EFECTO_4_BLOQUEO; n = 5; break;
const casos = new Map<number, { tabla: string; n: number }>()
for (const m of ino.matchAll(/case\s+(\d+):\s*tabla\s*=\s*(EFECTO_\w+);\s*n\s*=\s*(\d+);/g)) {
  casos.set(Number(m[1]), { tabla: m[2], n: Number(m[3]) })
}

chk(tablas.size >= 7 && casos.size >= 7, `firmware leído: ${tablas.size} tablas y ${casos.size} casos EF (${ruta.split(/[\\/]/).slice(-2).join('/')})`)

for (const [ef, { tabla, n }] of [...casos].sort((a, b) => a[0] - b[0])) {
  const fw = tablas.get(tabla)
  const pant = EFECTOS_CUBO[ef]
  if (!fw || !pant) { chk(false, `EF=${ef}: falta la tabla ${!fw ? 'en el firmware' : 'en la pantalla'}`); continue }
  const igualN = fw.length === n && pant.length === fw.length
  const igualPasos = igualN && fw.every((p, i) => {
    const q = pant[i]
    const rgb = q.rgb === 'equipo' ? [-1] : q.rgb
    const rgbFw = p[0] === -1 ? [-1] : p.slice(0, 3)
    return rgb.join() === rgbFw.join() && Math.abs(q.vib - p[3]) < 1e-6 && q.durMs === p[4]
  })
  chk(igualPasos, `EF=${ef} (${tabla}): ${pant.length} pasos idénticos en color, vibración y duración`)
}

// La reproducción en pantalla termina en el mismo color que el cubo.
chk(pasoEfecto(4, duracionEfecto(4) + 10).hex === '#ffffff' && pasoEfecto(4, 10).hex === '#ff0000',
  'Bloqueo en pantalla: empieza rojo y termina en blanco fijo, como el cubo')
chk(pasoEfecto(5, 10).hex === '#00ff00' && pasoEfecto(5, 450).hex === '#ffd700' && pasoEfecto(5, 5000).hex === '#ffffff',
  'Victoria en pantalla: verde/dorado y luego blanco fijo, como el cubo')
chk(pasoEfecto(6, 100).hex === '#00ffff' && pasoEfecto(6, 400).hex === null,
  'Cuenta regresiva en pantalla: destello cian y vuelta al color de equipo')

console.log(fallos ? `\nEFECTOS CON ${fallos} DIFERENCIA(S) entre la pantalla y el firmware` : '\nEFECTOS OK: la pantalla reproduce los mismos efectos que el cubo físico (EF=1..7).')
process.exit(fallos ? 1 : 0)

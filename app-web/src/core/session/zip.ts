// Un .zip mínimo, sin compresión (método «store»), para entregar el paquete de
// datos como UN solo archivo sin traer una librería. Los CSV pesan poco, así que
// no comprimir no cuesta nada, y el formato sin compresión es el más sencillo de
// escribir y de leer bien.

const TABLA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(datos: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < datos.length; i++) c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export type ArchivoZip = { nombre: string; contenido: string | Uint8Array }

const enc = new TextEncoder()

// Fecha y hora en el formato de MS-DOS que usa el zip.
function fechaDos(d: Date): { fecha: number; hora: number } {
  return {
    fecha: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
  }
}

export function crearZip(archivos: ArchivoZip[], ahora = new Date()): Uint8Array {
  const { fecha, hora } = fechaDos(ahora)
  const locales: Uint8Array[] = []
  const centrales: Uint8Array[] = []
  let posicion = 0
  for (const a of archivos) {
    const nombre = enc.encode(a.nombre)
    const datos = typeof a.contenido === 'string' ? enc.encode(a.contenido) : a.contenido
    const crc = crc32(datos)

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint16(6, 0x0800, true) // nombres en UTF-8
    local.setUint16(8, 0, true) // sin compresión
    local.setUint16(10, hora, true)
    local.setUint16(12, fecha, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, datos.length, true)
    local.setUint32(22, datos.length, true)
    local.setUint16(26, nombre.length, true)
    local.setUint16(28, 0, true)
    locales.push(new Uint8Array(local.buffer), nombre, datos)

    const central = new DataView(new ArrayBuffer(46))
    central.setUint32(0, 0x02014b50, true)
    central.setUint16(4, 20, true)
    central.setUint16(6, 20, true)
    central.setUint16(8, 0x0800, true)
    central.setUint16(10, 0, true)
    central.setUint16(12, hora, true)
    central.setUint16(14, fecha, true)
    central.setUint32(16, crc, true)
    central.setUint32(20, datos.length, true)
    central.setUint32(24, datos.length, true)
    central.setUint16(28, nombre.length, true)
    central.setUint32(42, posicion, true)
    centrales.push(new Uint8Array(central.buffer), nombre)

    posicion += 30 + nombre.length + datos.length
  }
  const tamCentral = centrales.reduce((a, b) => a + b.length, 0)
  const fin = new DataView(new ArrayBuffer(22))
  fin.setUint32(0, 0x06054b50, true)
  fin.setUint16(8, archivos.length, true)
  fin.setUint16(10, archivos.length, true)
  fin.setUint32(12, tamCentral, true)
  fin.setUint32(16, posicion, true)

  const partes = [...locales, ...centrales, new Uint8Array(fin.buffer)]
  const salida = new Uint8Array(partes.reduce((a, b) => a + b.length, 0))
  let o = 0
  for (const p of partes) { salida.set(p, o); o += p.length }
  return salida
}

// Lee de vuelta un zip hecho con `crearZip` y comprueba cada CRC. Existe para
// poder verificar el paquete en la compilación sin depender de ninguna
// herramienta externa.
export function leerZip(zip: Uint8Array): { nombre: string; contenido: Uint8Array }[] {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
  let fin = zip.length - 22
  while (fin >= 0 && v.getUint32(fin, true) !== 0x06054b50) fin--
  if (fin < 0) throw new Error('No es un zip: falta el final del directorio central.')
  const n = v.getUint16(fin + 10, true)
  let p = v.getUint32(fin + 16, true)
  const out: { nombre: string; contenido: Uint8Array }[] = []
  const dec = new TextDecoder()
  for (let i = 0; i < n; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('Directorio central dañado.')
    const crc = v.getUint32(p + 16, true)
    const tam = v.getUint32(p + 24, true)
    const largoNombre = v.getUint16(p + 28, true)
    const extra = v.getUint16(p + 30, true)
    const comentario = v.getUint16(p + 32, true)
    const desde = v.getUint32(p + 42, true)
    const nombre = dec.decode(zip.subarray(p + 46, p + 46 + largoNombre))
    const lNombre = v.getUint16(desde + 26, true)
    const lExtra = v.getUint16(desde + 28, true)
    const ini = desde + 30 + lNombre + lExtra
    const contenido = zip.subarray(ini, ini + tam)
    if (crc32(contenido) !== crc) throw new Error(`CRC incorrecto en ${nombre}.`)
    out.push({ nombre, contenido })
    p += 46 + largoNombre + extra + comentario
  }
  return out
}

// ZIP STORE: images are already compressed, so another compression pass adds
// CPU time without meaningful savings. CRC-32 and central directory follow ZIP 2.0.
export async function createZip(files: { name: string; blob: Blob }[]): Promise<Blob> {
  if (files.length > 65535) throw new Error("Too many files for a ZIP archive")
  const parts: BlobPart[] = []
  const directory: Uint8Array<ArrayBuffer>[] = []
  let offset = 0
  for (const file of files) {
    const name = new TextEncoder().encode(file.name)
    const data = new Uint8Array(await file.blob.arrayBuffer())
    if (name.length > 65535 || offset + data.length > 0xffffffff) {
      throw new Error("ZIP archive exceeds the supported size")
    }
    let crc = 0xffffffff
    for (const byte of data) {
      crc ^= byte
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
    }
    crc = (crc ^ 0xffffffff) >>> 0
    const local = new Uint8Array(30 + name.length)
    const view = new DataView(local.buffer)
    view.setUint32(0, 0x04034b50, true)
    view.setUint16(4, 20, true)
    view.setUint16(6, 0x800, true) // UTF-8 names
    view.setUint16(12, 33, true) // 1980-01-01
    view.setUint32(14, crc, true)
    view.setUint32(18, data.length, true)
    view.setUint32(22, data.length, true)
    view.setUint16(26, name.length, true)
    local.set(name, 30)
    parts.push(local, file.blob)
    const central = new Uint8Array(46 + name.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    central.set(local.subarray(4, 30), 6)
    cv.setUint32(42, offset, true)
    central.set(name, 46)
    directory.push(central)
    offset += local.length + data.length
  }
  const directorySize = directory.reduce((sum, entry) => sum + entry.length, 0)
  if (offset + directorySize > 0xffffffff) throw new Error("ZIP archive exceeds the supported size")
  const end = new Uint8Array(22)
  const view = new DataView(end.buffer)
  view.setUint32(0, 0x06054b50, true)
  view.setUint16(8, files.length, true)
  view.setUint16(10, files.length, true)
  view.setUint32(12, directorySize, true)
  view.setUint32(16, offset, true)
  return new Blob([...parts, ...directory, end], { type: "application/zip" })
}

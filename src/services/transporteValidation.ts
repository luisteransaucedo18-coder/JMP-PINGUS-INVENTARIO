export function admiteDecimales(unidad: string) {
  return ["MTS", "GLD", "ROLLO"].includes(unidad.trim().toUpperCase())
}
export function validarCantidad(
  cantidad: number,
  unidad: string,
  max: number,
  cero = false,
) {
  return (
    Number.isFinite(cantidad) &&
    cantidad >= (cero ? 0 : 0.001) &&
    cantidad <= max &&
    Math.abs(cantidad * 1000 - Math.round(cantidad * 1000)) < 0.000001 &&
    (admiteDecimales(unidad) || Number.isInteger(cantidad))
  )
}
export async function validarArchivo(file: File) {
  if (
    !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(
      file.type,
    ) ||
    file.size <= 0 ||
    file.size > 10 * 1024 * 1024
  )
    throw new Error("Usa PDF, JPG, PNG o WebP de hasta 10 MB.")
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end))
  const valid =
    file.type === "application/pdf"
      ? ascii(0, 5) === "%PDF-"
      : file.type === "image/jpeg"
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : file.type === "image/png"
          ? bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10"
          : ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP"
  if (!valid)
    throw new Error("El contenido del archivo no coincide con su tipo.")
}

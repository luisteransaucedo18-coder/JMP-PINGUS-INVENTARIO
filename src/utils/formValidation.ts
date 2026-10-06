export const PROJECT_NAME_MAX = 100

export function validateText(value: unknown, label: string, max: number, required = false) {
  if (typeof value !== 'string' || (required && !value.trim()))
    throw new Error(`${label}: completa este campo.`)
  if (value.length > max) throw new Error(`${label}: máximo ${max} caracteres.`)
}

export function validateNumber(value: unknown, label: string, min = 0, max = 100000000, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value)))
    throw new Error(`${label}: ingresa un número ${integer ? 'entero ' : ''}entre ${min} y ${max}.`)
}

export function validateProject(project: Record<string, unknown>) {
  validateText(project.nombre, 'Nombre del proyecto', PROJECT_NAME_MAX, true)
  validateText(project.cliente, 'Cliente', 150, true)
  validateText(project.responsable, 'Responsable', 150, true)
  validateText(project.ubicacion, 'Dirección', 300, true)
}

export function validateDocument(value: string) {
  if (value && !/^\d{8}$/.test(value)) throw new Error('DNI: ingresa exactamente 8 dígitos.')
}

export function validEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

// Validate only user-entered fields. IDs, storage paths and URLs have separate rules.
export function validateTextFields(value: unknown) {
  const limits: Record<string, number> = {
    nombre: 150, tecnico: 150, transportista: 150, guia: 150, numero_comprobante: 150,
    descripcion: 1000, observaciones: 1000, detalle: 1000, motivo: 1000, nota: 1000,
    alcance: 1000, condiciones: 1000, alternativa: 150, comprobante: 300,
    unidad: 20, unidadCotizada: 20, cargo: 120, bio: 1000, telefono: 30,
  }
  if (Array.isArray(value)) { value.forEach(validateTextFields); return }
  if (!value || typeof value !== 'object') return
  for (const [key, field] of Object.entries(value)) {
    if (field != null && key in limits) validateText(field, key, limits[key])
    else if (field && typeof field === 'object') validateTextFields(field)
  }
}

export function validatePhone(value: string) {
  if (value && (!/^\+?[0-9 ()-]+$/.test(value) || !/^[0-9]{7,15}$/.test(value.replace(/\D/g, ''))))
    throw new Error('Teléfono: ingresa entre 7 y 15 dígitos; puedes incluir +, espacios, paréntesis y guiones.')
}

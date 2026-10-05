import locations from "./peruLocations.json"
import ubigeo from "./peruUbigeo.json"

export const PERU_UBIGEO: Record<string, Record<string, { ubigeo: string; nombre: string }[]>> = ubigeo
export const provincesForDepartment = (department: string) =>
  Object.keys(PERU_UBIGEO[department] ?? {}).sort((a, b) => a.localeCompare(b, "es"))
export const districtsForProvince = (department: string, province: string) =>
  [...(PERU_UBIGEO[department]?.[province] ?? [])].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
export const validPeruLocation = (department: string, province: string, district: string) =>
  districtsForProvince(department, province).some((d) => d.nombre === district)

// Infer old city values only when their district belongs to a single province.
export function resolveLegacyLocation(department: string, city: string) {
  const matches = Object.entries(PERU_UBIGEO[department] ?? {}).flatMap(([provincia, districts]) =>
    districts.filter((d) => normalizeLocation(d.nombre) === normalizeLocation(city))
      .map((d) => ({ provincia, distrito: d.nombre })),
  )
  return matches.length === 1 ? matches[0] : { provincia: "", distrito: "" }
}

export const PERU_LOCATIONS: Record<string, string[]> = locations
export const DEPARTAMENTOS = Object.keys(PERU_LOCATIONS).sort((a, b) =>
  a.localeCompare(b, "es"),
)
export const normalizeLocation = (value: string) =>
  value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
export function departmentForCity(city: string) {
  const matches = DEPARTAMENTOS.filter((d) =>
    PERU_LOCATIONS[d].some(
      (c) => normalizeLocation(c) === normalizeLocation(city),
    ),
  )
  return matches.length === 1 ? matches[0] : ""
}
export function validLocation(department: string, city: string) {
  return (PERU_LOCATIONS[department] ?? []).includes(city)
}

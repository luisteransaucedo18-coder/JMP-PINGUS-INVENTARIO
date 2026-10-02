import locations from "./peruLocations.json"

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

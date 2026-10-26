export const isSharedSector = (sector: string) => sector.trim().toLocaleUpperCase("pt-BR") === "TODOS";

export function requestSectors(sectors: string[]) {
  return [...new Set(sectors.filter(sector => !isSharedSector(sector)))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

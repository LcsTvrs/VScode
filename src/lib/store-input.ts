export const BRAZIL_STATES = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

export function parseStoreLocation(input: Record<string, unknown>) {
  const city = typeof input.city === "string" ? input.city.trim().replace(/\s+/g, " ") : "";
  const state = typeof input.state === "string" ? input.state.trim().toUpperCase() : "";
  if (city.length < 2 || city.length > 100 || !BRAZIL_STATES.includes(state)) return null;
  return { city, state };
}

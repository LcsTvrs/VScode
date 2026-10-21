export const REQUEST_TIME_ZONE = "America/Sao_Paulo";

const dayFormatter = new Intl.DateTimeFormat("en", {
  timeZone: REQUEST_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
});

export function requestDay(value: string | Date): string {
  const parts = dayFormatter.formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

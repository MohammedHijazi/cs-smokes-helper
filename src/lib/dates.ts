/** The device's local calendar date, as YYYY-MM-DD. */
export function toLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Adds whole calendar days. Works from noon, so clock changes can't shift the date. */
export function addDays(day: string, days: number): string {
  const [year, month, date] = day.split("-").map(Number);
  return toLocalDate(new Date(year, month - 1, date + days, 12));
}

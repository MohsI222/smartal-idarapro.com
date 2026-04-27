/**
 * Local calendar date as ISO `YYYY-MM-DD` (always ASCII/Latin numerals) for `<input type="date">` values.
 * Prefer this over `toISOString().slice(0, 10)` so the date matches the user’s timezone, not UTC.
 */
export function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Same local-noon parse as `YYYY-MM-DD` date inputs, plus `years` to end date. */
export function addCalendarYearsIsoLocal(iso: string, years: number): string {
  const d = new Date(`${iso.trim()}T12:00:00`);
  if (Number.isNaN(d.getTime())) return todayIsoLocal();
  d.setFullYear(d.getFullYear() + years);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

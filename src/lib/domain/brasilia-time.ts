/**
 * Dates the admin types are Brasília time wherever the admin is sitting, because that is the clock the
 * store's customers read. Brazil dropped daylight saving in 2019, so the offset is fixed.
 */
const OFFSET_MS = 3 * 60 * 60 * 1000;
const INPUT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** `datetime-local` value ("2026-10-23T20:00") read as Brasília time, to an ISO instant. */
export function fromBrasiliaInput(value: string): string | null {
  if (!INPUT.test(value)) return null;
  const t = Date.parse(`${value}:00-03:00`);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** ISO instant to the `datetime-local` value that shows it in Brasília time. */
export function toBrasiliaInput(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  return Number.isNaN(t) ? "" : new Date(t - OFFSET_MS).toISOString().slice(0, 16);
}

export function addHoursToInput(value: string, hours: number): string {
  const iso = fromBrasiliaInput(value);
  return iso ? toBrasiliaInput(new Date(Date.parse(iso) + hours * 3_600_000).toISOString()) : "";
}

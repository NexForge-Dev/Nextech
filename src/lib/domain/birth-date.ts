/** Purchases are contracts: buyers must be adults (Código Civil, arts. 3º a 5º). */
export const MIN_BUYER_AGE = 18;

/** Today's calendar date in Brazil, where the store sells, as YYYY-MM-DD. */
export function brazilToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

/** A real calendar date in YYYY-MM-DD, from 1900 up to today. */
export function isValidBirthDate(value: string, today = brazilToday()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return false;
  return value >= "1900-01-01" && value <= today;
}

/** Completed years. Dates are compared as text, so time zones and leap years cannot shift a birthday. */
export function ageOn(birthDate: string, today = brazilToday()): number {
  const years = Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4));
  return today.slice(5) >= birthDate.slice(5) ? years : years - 1;
}

export function isAdult(birthDate: string, today = brazilToday()): boolean {
  return isValidBirthDate(birthDate, today) && ageOn(birthDate, today) >= MIN_BUYER_AGE;
}

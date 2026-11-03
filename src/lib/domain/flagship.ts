/**
 * The home always opens with a product. The one picked in the admin comes first; the rest of the list
 * stays as the fallback, so a picked product that goes off sale never leaves the top of the page empty.
 */
export function flagshipCandidates<T extends { id: string }>(rows: T[], pickedId: string): T[] {
  const picked = rows.find((r) => r.id === pickedId);
  return picked ? [picked, ...rows.filter((r) => r !== picked)] : rows;
}

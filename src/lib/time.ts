/** Helpers kept outside components so render functions stay pure (react-hooks/purity). */
export function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export function olderThanDays(iso: string | null | undefined, days: number): boolean {
  return !!iso && Date.now() - new Date(iso).getTime() > days * 86_400_000;
}

/** The first bytes of the file really are the declared image type (needs at least 12 bytes). */
export function hasImageSignature(bytes: Uint8Array, type: string): boolean {
  const starts = (sig: number[], at = 0) => sig.every((b, i) => bytes[at + i] === b);
  if (type === "image/jpeg") return starts([0xff, 0xd8, 0xff]);
  if (type === "image/png") return starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (type === "image/webp") return starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8);
  return false;
}

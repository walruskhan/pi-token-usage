export function number(value: unknown): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

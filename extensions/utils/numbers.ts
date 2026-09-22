export function number(value: unknown): number {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

/** Monetary usage reported by a provider cannot reduce the cost total. */
export function nonNegativeNumber(value: unknown): number {
  return Math.max(0, number(value));
}

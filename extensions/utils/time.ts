import { number } from "./numbers.ts";

export function timestamp(value: unknown): string {
  const date = new Date(number(value) || Date.now());
  return Number.isNaN(date.getTime())
    ? new Date().toISOString()
    : date.toISOString();
}

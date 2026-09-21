export function sqlString(value: unknown): string {
  return `'${String(value ?? "").replaceAll("'", "''")}'`;
}

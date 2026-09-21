import Mustache from "mustache";

export function money(value: unknown): string {
  return `$${Number(value || 0).toFixed(4)}`;
}

export function num(value: unknown): string {
  return Number(value || 0).toLocaleString();
}

export function periodLabel(period: string): string {
  return period.length === 10
    ? `${period} ${new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: "UTC" }).format(new Date(`${period}T00:00:00Z`))}`
    : period;
}

export function escapeHtml(value: unknown): string {
  return Mustache.escape(String(value ?? ""));
}

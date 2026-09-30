/** Only valid IANA zones cross the shared scene boundary. */
export function readTimeZone(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 80) return undefined;
  try { return new Intl.DateTimeFormat("pt-BR", { timeZone: value }).resolvedOptions().timeZone; }
  catch { return undefined; }
}

export function officeTime(date: Date, zone: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: zone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(date);
}

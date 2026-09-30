import type { JobForm } from "./job-form";
import { isProviderId } from "./providers";

export const DESKS_STORAGE_KEY = "escritorio-de-ia.desks";

export type DeskRecord = {
  id: string;
  form: JobForm;
  createdAt: string;
};

export function serializeDesks(desks: readonly DeskRecord[]): string {
  return JSON.stringify({ version: 1, desks });
}

export function loadDesks(raw: string | null): DeskRecord[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; desks?: unknown };
    if (parsed.version !== 1 || !Array.isArray(parsed.desks)) return [];
    return parsed.desks.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const desk = entry as Record<string, unknown>;
      const form = desk.form;
      if (!form || typeof form !== "object") return [];
      const ficha = form as Record<string, unknown>;
      if (typeof desk.id !== "string" || !desk.id) return [];
      if (typeof ficha.role !== "string" || !ficha.role.trim()) return [];
      if (!isProviderId(ficha.provider)) return [];
      if (typeof desk.createdAt !== "string") return [];
      return [
        {
          id: desk.id,
          createdAt: desk.createdAt,
          form: { role: ficha.role.trim(), provider: ficha.provider },
        },
      ];
    });
  } catch {
    return [];
  }
}

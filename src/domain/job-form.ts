import { isProviderId, type ProviderId } from "./providers";

/**
 * The only hiring form. Later phases (HR, dispatch) should reuse this type
 * instead of inventing another ficha.
 */
export type JobForm = {
  role: string;
  provider: ProviderId;
};

export type JobFormError =
  | "role_required"
  | "provider_required"
  | "provider_unavailable";

export function parseJobForm(
  input: { role?: unknown; provider?: unknown },
  allowed: readonly ProviderId[],
): { ok: true; form: JobForm } | { ok: false; error: JobFormError } {
  const role = typeof input.role === "string" ? input.role.trim() : "";
  if (!role) return { ok: false, error: "role_required" };
  if (!isProviderId(input.provider)) {
    return { ok: false, error: "provider_required" };
  }
  if (!allowed.includes(input.provider)) {
    return { ok: false, error: "provider_unavailable" };
  }
  return {
    ok: true,
    form: { role: role.slice(0, 80), provider: input.provider },
  };
}

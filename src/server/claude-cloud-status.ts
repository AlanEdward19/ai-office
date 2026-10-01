import "server-only";

import {
  ClaudeStatusHttpError,
  readClaudeNextPage,
  type ClaudeCloudClient,
} from "@/domain/claude-cloud-status";

const BASE = "https://api.anthropic.com";
const PAGE_CAP = 4;

/**
 * Lists Managed Agent sessions while the caller holds the page open.
 * The key stays in the request header. The returned pages are parsed down
 * to id and status before anything is written to the browser.
 */
export function createClaudeCloudClient(apiKey: string): ClaudeCloudClient {
  return {
    async listSessions(signal) {
      const combined: unknown[] = [];
      let page: string | null = null;
      for (let index = 0; index < PAGE_CAP; index += 1) {
        const payload = await fetchSessionPage(apiKey, page, signal);
        if (!payload || typeof payload !== "object" || !Array.isArray((payload as { data?: unknown }).data)) {
          return payload;
        }
        combined.push(...(payload as { data: unknown[] }).data);
        const next = readClaudeNextPage(payload);
        if (!next) break;
        page = next;
      }
      return { data: combined };
    },
  };
}

async function fetchSessionPage(apiKey: string, page: string | null, signal: AbortSignal): Promise<unknown> {
  const params = new URLSearchParams({ limit: "50", order: "desc" });
  if (page) params.set("page", page);
  const response = await fetch(`${BASE}/v1/sessions?${params.toString()}`, {
    signal,
    cache: "no-store",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "managed-agents-2026-04-01",
      Accept: "application/json",
    },
  });
  if (!response.ok) throw new ClaudeStatusHttpError(response.status);
  return response.json();
}

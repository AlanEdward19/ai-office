import "server-only";

import {
  cursorCreateBody,
  readCreatedCursorAgent,
  type CreatedCursorAgent,
} from "@/domain/dispatch";
import { readAgentList, readRunStatus } from "@/domain/cursor-status";
import { ObserveHttpError, type CursorCloudClient } from "@/domain/observe-cursor";
import { takeSseBlocks, type SseMessage } from "@/domain/sse";

const BASE = "https://api.cursor.com";

async function cursorFetch(apiKey: string, path: string, signal: AbortSignal, accept: string) {
  const response = await fetch(`${BASE}${path}`, {
    signal,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: accept,
    },
  });
  if (!response.ok) throw new ObserveHttpError(response.status);
  return response;
}

export async function createCursorCloudAgent(
  apiKey: string,
  issue: { identifier: string; title: string; url: string; description: string | null },
  signal?: AbortSignal,
): Promise<CreatedCursorAgent> {
  const response = await fetch(`${BASE}/v1/agents`, {
    method: "POST",
    signal,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cursorCreateBody(issue)),
  });
  if (!response.ok) throw new ObserveHttpError(response.status);
  const agent = readCreatedCursorAgent(await response.json());
  if (!agent) throw new ObserveHttpError(502);
  return agent;
}

export function createCursorClient(apiKey: string): CursorCloudClient {
  return {
    async me(signal) {
      const response = await cursorFetch(apiKey, "/v1/me", signal, "application/json");
      return response.json();
    },
    async listAgents(signal) {
      const response = await cursorFetch(
        apiKey,
        "/v1/agents?limit=20&includeArchived=false",
        signal,
        "application/json",
      );
      return readAgentList(await response.json());
    },
    async getRun(agentId, runId, signal) {
      const response = await cursorFetch(
        apiKey,
        `/v1/agents/${encodeURIComponent(agentId)}/runs/${encodeURIComponent(runId)}`,
        signal,
        "application/json",
      );
      return { status: readRunStatus(await response.json()) };
    },
    streamRun(agentId, runId, signal) {
      return streamCursorRun(apiKey, agentId, runId, signal);
    },
  };
}

async function* streamCursorRun(
  apiKey: string,
  agentId: string,
  runId: string,
  signal: AbortSignal,
): AsyncIterable<SseMessage> {
  const response = await fetch(
    `${BASE}/v1/agents/${encodeURIComponent(agentId)}/runs/${encodeURIComponent(runId)}/stream`,
    {
      signal,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "text/event-stream",
      },
    },
  );
  if (!response.ok) throw new ObserveHttpError(response.status);
  if (!response.body) throw new ObserveHttpError(response.status || 502);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const taken = takeSseBlocks(buffer);
      buffer = taken.rest;
      for (const message of taken.messages) yield message;
    }
  } finally {
    reader.releaseLock();
  }
}

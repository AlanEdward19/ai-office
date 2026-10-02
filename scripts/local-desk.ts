import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { LOCAL_DESK_PORT } from "../src/domain/office-machines";
import { openLocalStream } from "../src/server/local-stream";

const OFFICE_PORT = 3847;
const FIRST_BEAT_MS = 180_000;
const BEAT_GAP_MS = 8_000;

const started = Date.now();
let lastBeat = 0;
let sawBeat = false;
let stopped = false;

const abort = new AbortController();

const clients = new Set<ServerResponse>();
const latest = new Map<string, string>();
let pending = "";

function remember(text: string): string[] {
  pending += text;
  const frames: string[] = [];
  while (true) {
    const split = pending.indexOf("\n\n");
    if (split < 0) break;
    const body = pending.slice(0, split);
    pending = pending.slice(split + 2);
    if (!body.trim() || body.startsWith(":")) continue;
    const frame = `${body}\n\n`;
    const event = body.match(/^event: (.+)$/m)?.[1] ?? "message";
    let key = event;
    if (event === "agent") {
      const data = body.match(/^data: (.*)$/m)?.[1] ?? "";
      try {
        const parsed = JSON.parse(data) as { provider?: unknown };
        if (typeof parsed.provider === "string" && parsed.provider) key = `agent:${parsed.provider}`;
      } catch {
        key = "agent";
      }
    }
    latest.set(key, frame);
    frames.push(frame);
  }
  return frames;
}

function replay(response: ServerResponse) {
  for (const frame of latest.values()) response.write(frame);
}

function cors(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Private-Network": "true",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

function shutdown() {
  if (stopped) return;
  stopped = true;
  abort.abort();
  for (const client of clients) client.end();
  server.close();
  // The bridge uninstalls hooks on a short timer. Stay up long enough for that
  // write, then leave. An immediate exit would keep the other machine's hooks.
  setTimeout(() => process.exit(0), 1_500);
}

const server = createServer((request: IncomingMessage, response: ServerResponse) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, cors());
    response.end();
    return;
  }
  if (request.method === "POST" && request.url === "/beat") {
    sawBeat = true;
    lastBeat = Date.now();
    response.writeHead(204, cors());
    response.end();
    return;
  }
  if (request.method === "GET" && request.url === "/events") {
    response.writeHead(200, {
      ...cors(),
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });
    response.write(`:${" ".repeat(64)}\n\n`);
    replay(response);
    clients.add(response);
    request.on("close", () => clients.delete(response));
    return;
  }
  response.writeHead(404, cors());
  response.end();
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function main() {
  const office = await fetch(`http://127.0.0.1:${OFFICE_PORT}/`, {
    signal: AbortSignal.timeout(800),
  }).catch(() => null);
  if (office?.ok) {
    console.error(
      "Esta máquina já roda o escritório. Os agentes locais dela já entram no chão. npm run local é para o outro computador.",
    );
    process.exit(1);
  }

  server.listen(LOCAL_DESK_PORT, "127.0.0.1", () => {
    console.log(`Agentes locais desta máquina em http://127.0.0.1:${LOCAL_DESK_PORT}/events`);
  });

  const watch = setInterval(() => {
    const quiet = sawBeat ? Date.now() - lastBeat > BEAT_GAP_MS : Date.now() - started > FIRST_BEAT_MS;
    if (quiet) shutdown();
  }, 1_000);
  watch.unref();

  const upstream = openLocalStream(new Request("http://127.0.0.1/local-desk", { signal: abort.signal }));
  const reader = upstream.body?.getReader();
  if (!reader) {
    console.error("A leitura local não abriu.");
    process.exit(1);
  }

  const decoder = new TextDecoder();
  while (!abort.signal.aborted) {
    const chunk = await reader.read();
    if (chunk.done) break;
    const text = decoder.decode(chunk.value, { stream: true });
    const frames = remember(text);
    for (const frame of frames) {
      for (const client of clients) client.write(frame);
    }
  }
  shutdown();
}

void main();

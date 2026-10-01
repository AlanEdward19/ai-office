import {openClaudeCloudStream} from "@/server/claude-cloud-stream";
import { openLocalStream } from "@/server/local-stream";
import { openObserverStream } from "@/server/observe-stream";
import { callCommandResponse, callStreamResponse } from "@/domain/call-http";
import { type CallDownlink } from "@/domain/call";
import { findSession, subscribeOffice } from "@/server/office-channel";
import { actCall, joinCall, postCall } from "@/server/call-channel";

export const dynamic = "force-dynamic";

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function GET(request: Request) {
  return callStreamResponse(request, findSession(request), (peer, session) => openCallStream(request, peer, session));
}

function openCallStream(request: Request, peer: string, session: NonNullable<ReturnType<typeof findSession>>) {
  const encoder = new TextEncoder();
  let leave = () => {};
  let leaveOffice = () => {};
  const observers = new AbortController();
  const readers = new Set<ReadableStreamDefaultReader<Uint8Array>>();
  let left = false;
  const drop = () => {
    if (left) return;
    left = true;
    leave();
    leaveOffice();
    observers.abort();
    for (const reader of readers) void reader.cancel().catch(() => undefined);
  };

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: CallDownlink) => {
        try {
          controller.enqueue(encoder.encode(sse(event.type, event)));
        } catch {
          drop();
        }
      };
      const forward = async (response: Response | Promise<Response>, prefix: string) => {
        const stream = (await response).body;
        if (!stream) return;
        const reader = stream.getReader();
        readers.add(reader);
        const decoder = new TextDecoder();
        try {
          while (!left) {
            const chunk = await reader.read();
            if (chunk.done) break;
            controller.enqueue(encoder.encode(decoder.decode(chunk.value, { stream: true }).replace(/^event: /gm, `event: ${prefix}`)));
          }
        } catch {
          if (!left) {
            try { controller.enqueue(encoder.encode(sse(`${prefix}notice`, { message: "O observador reconectará com a página." }))); }
            catch { drop(); }
          }
        } finally { readers.delete(reader); }
      };
      leaveOffice = subscribeOffice(session.role, scene => {
        try { controller.enqueue(encoder.encode(sse("snapshot", scene))); } catch { drop(); }
      });
      const joined = joinCall({ id: peer, name: session.name, token: session.token, host: session.role === "host" }, send);
      if (!joined.ok) {
        drop();
        try {
          controller.enqueue(encoder.encode(sse("notice", { message: "A chamada não abriu." })));
          controller.close();
        } catch {
          // The client already went away.
        }
        return;
      }
      leave = joined.leave;
      if (session.role === "host") {
        const observerRequest = new Request(request.url, { headers: request.headers, signal: observers.signal });
        void forward(openLocalStream(observerRequest), "local-");
        void forward(openObserverStream(observerRequest), "cloud-");
        void forward(openClaudeCloudStream(observerRequest), "claude-");
      }
      const abort = () => {
        drop();
        try {
          controller.close();
        } catch {
          // The client already went away.
        }
      };
      request.signal.addEventListener("abort", abort, { once: true });
      if (request.signal.aborted) abort();
    },
    cancel() {
      drop();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(request: Request) {
  return callCommandResponse(request, findSession(request), input => input.action === undefined
    ? postCall(input)
    : actCall(input));
}

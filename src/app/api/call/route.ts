import { type CallDownlink } from "@/domain/call";
import { findSession } from "@/server/office-channel";
import { joinCall, postCall } from "@/server/call-channel";

export const dynamic = "force-dynamic";

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function GET(request: Request) {
  const session = findSession(request);
  if (!session) return Response.json({ error: "signed_out" }, { status: 401 });
  const peer = new URL(request.url).searchParams.get("peer") ?? "";
  const encoder = new TextEncoder();
  let leave = () => {};
  let left = false;
  const drop = () => {
    if (left) return;
    left = true;
    leave();
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
      const joined = joinCall({ id: peer, name: session.name, token: session.token }, send);
      if (!joined.ok) {
        try {
          controller.enqueue(encoder.encode(sse("notice", { message: "A chamada não abriu." })));
          controller.close();
        } catch {
          // The client already went away.
        }
        return;
      }
      leave = joined.leave;
      const abort = () => {
        drop();
        try {
          controller.close();
        } catch {
          // The client already went away.
        }
      };
      request.signal.addEventListener("abort", abort, { once: true });
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
  const session = findSession(request);
  if (!session) return Response.json({ error: "signed_out" }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const from = typeof record.from === "string" ? record.from : "";
  const to = typeof record.to === "string" ? record.to : "";
  const result = postCall({ token: session.token, from, to, signal: record.signal });
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: result.reason === "invalid" ? 400 : 409 });
  }
  return Response.json({ ok: true });
}

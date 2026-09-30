import { findSession, publishOffice, subscribeOffice } from "@/server/office-channel";

export const dynamic = "force-dynamic";

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: Request) {
  const session = findSession(request);
  if (!session) return Response.json({ error: "signed_out" }, { status: 401 });

  const encoder = new TextEncoder();
  let leave = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (scene: unknown) => {
        try {
          controller.enqueue(encoder.encode(sse("snapshot", scene)));
        } catch {
          leave();
        }
      };
      leave = subscribeOffice(session.role, send);
      const abort = () => {
        leave();
        try {
          controller.close();
        } catch {
          // The client already went away.
        }
      };
      request.signal.addEventListener("abort", abort, { once: true });
    },
    cancel() {
      leave();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function POST(request: Request) {
  const session = findSession(request);
  if (!session || session.role !== "host") {
    return Response.json({ error: "read_only" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  const result = publishOffice(session.role, body);
  if (!result.ok) {
    const status = result.reason === "read_only" ? 403 : result.reason === "closed" ? 409 : 400;
    return Response.json({ error: result.reason }, { status });
  }
  return Response.json({ ok: true });
}

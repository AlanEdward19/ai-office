import { observeCursorCloudAgent } from "@/domain/observe-cursor";
import { createCursorClient } from "@/server/cursor-client";

export const dynamic = "force-dynamic";

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function untilAborted(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    signal.addEventListener("abort", () => resolve(), { once: true });
  });
}

export function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  const abort = new AbortController();
  const onRequestAbort = () => abort.abort();
  request.signal.addEventListener("abort", onRequestAbort);

  const stream = new ReadableStream({
    start(controller) {
      const write = (chunk: string) => {
        if (abort.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          abort.abort();
        }
      };

      const finish = () => {
        request.signal.removeEventListener("abort", onRequestAbort);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      write(`:${" ".repeat(2048)}\n\n`);
      write(sse("notice", { message: "Observador ligado. Fechar a página encerra a leitura." }));

      const apiKey = process.env.CURSOR_API_KEY?.trim();
      if (!apiKey) {
        write(
          sse("notice", {
            message:
              "Defina CURSOR_API_KEY nesta máquina para acompanhar um cloud agent. Nada fica lendo com a página fechada.",
          }),
        );
        void untilAborted(abort.signal).finally(finish);
        return;
      }

      void observeCursorCloudAgent({
        client: createCursorClient(apiKey),
        signal: abort.signal,
        emit: (event) => write(sse("agent", event)),
        notify: (notice) => write(sse("notice", notice)),
        sleep: abortableSleep,
      })
        .catch(() => {
          if (!abort.signal.aborted) {
            write(sse("notice", { message: "O observador do Cursor parou com um erro." }));
          }
        })
        .finally(finish);
    },
    cancel() {
      abort.abort();
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

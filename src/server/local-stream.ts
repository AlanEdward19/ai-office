import "server-only";
import type { ProviderId } from "@/domain/providers";
import { observeLocalMachine } from "@/domain/observe-local";
import { followClaudeSessions } from "@/server/claude-follow";
import { followCodexAppServer } from "@/server/codex-follow";
import { fileSpool, retainLocalBridge } from "@/server/local-bridge";
import { detectLocalLogins } from "@/server/local-logins";
import { abortableSleep } from "@/server/abortable-sleep";



function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function openLocalStream(request: Request) {
  const bridge = retainLocalBridge();
  const encoder = new TextEncoder();
  const abort = new AbortController();
  const onRequestAbort = () => abort.abort();
  request.signal.addEventListener("abort", onRequestAbort);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    request.signal.removeEventListener("abort", onRequestAbort);
    bridge.release();
  };

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
        release();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      write(`:${" ".repeat(2048)}\n\n`);
      bridge.beat();
      void detectLocalLogins()
        .catch((): { providers: ProviderId[]; claudeBin: string | null } => ({
          providers: [],
          claudeBin: null,
        }))
        .then((logins) => {
          if (abort.signal.aborted) return;
          const claudeLoggedIn = logins.providers.includes("anthropic");
          if (!claudeLoggedIn) bridge.releaseClaudeHooks();
          void followCodexAppServer({
            signal: abort.signal,
            loggedIn: logins.providers.includes("openai"),
            machineId: bridge.machineId,
            owner: bridge.owner,
            emit: (event) => write(sse("agent", event)),
          });
          void followClaudeSessions({
            signal: abort.signal,
            loggedIn: claudeLoggedIn,
            claudeBin: logins.claudeBin,
            machineId: bridge.machineId,
            owner: bridge.owner,
            emit: (event) => write(sse("agent", event)),
          });
          return observeLocalMachine({
            machineId: bridge.machineId,
            owner: bridge.owner,
            signal: abort.signal,
            spool: fileSpool(bridge.spoolPath),
            accept: { ...bridge.accept, anthropic: claudeLoggedIn && bridge.accept.anthropic },
            emit: (event) => write(sse("agent", event)),
            presence: (presence) => write(sse("presence", presence)),
            notify: (notice) => write(sse("notice", notice)),
            sleep: (ms, signal) => {
              bridge.beat();
              return abortableSleep(ms, signal);
            },
          });
        })
        .catch(() => {
          if (abort.signal.aborted) return;
          write(sse("notice", { message: "A ala local parou com um erro." }));
          write(
            sse("presence", {
              machineId: bridge.machineId,
              online: false,
              owner: bridge.owner,
            }),
          );
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

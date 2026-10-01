import 'server-only';
import {recordClaudeCloudHistory} from '@/server/agent-history';
import { CLAUDE_CLOUD_FAILURES, observeClaudeCloudSessions } from "@/domain/claude-cloud-status";
import { abortableSleep } from "@/server/abortable-sleep";
import { createClaudeCloudClient } from "@/server/claude-cloud-status";

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function untilAborted(signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal.aborted) resolve();
    else signal.addEventListener("abort", () => resolve(), { once: true });
  });
}

export async function openClaudeCloudStream(request:Request){
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
      const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
      if (!apiKey) {
        write(sse("status", { ok: false, error: CLAUDE_CLOUD_FAILURES.missingKey }));
        void untilAborted(abort.signal).finally(finish);
        return;
      }

      void observeClaudeCloudSessions({
        client: createClaudeCloudClient(apiKey),
        signal: abort.signal,
        emit: (report) => {if(report.ok)for(const session of report.sessions)void recordClaudeCloudHistory(session.id,null,session.status).catch(()=>{});write(sse("status", report));},
        sleep: abortableSleep,
      })
        .catch(() => {
          if (!abort.signal.aborted) {
            write(sse("status", { ok: false, error: CLAUDE_CLOUD_FAILURES.unavailable }));
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

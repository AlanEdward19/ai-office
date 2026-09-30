import { STATUS_LABELS, type AgentStatus } from "@/domain/agent-event";
import type { JobForm } from "@/domain/job-form";
import { PROVIDER_LABELS } from "@/domain/providers";

export function JobFormCard({
  form,
  status,
  statusText,
}: {
  form: JobForm;
  status?: AgentStatus;
  statusText?: string;
}) {
  const shown = statusText ?? (status ? STATUS_LABELS[status] : null);
  return (
    <article className="rounded-2xl border border-border bg-white/80 p-3">
      <p className="text-[0.65rem] tracking-[0.16em] text-muted uppercase">
        Ficha de vaga
      </p>
      <h3 className="font-display mt-1 text-lg leading-tight">{form.role}</h3>
      <p className="mt-1 text-sm">{PROVIDER_LABELS[form.provider]}</p>
      {shown ? <p className="mt-2 text-xs text-muted">{shown}</p> : null}
    </article>
  );
}

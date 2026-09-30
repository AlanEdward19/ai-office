import { STATUS_LABELS, type AgentStatus } from "@/domain/agent-event";
import type { JobForm } from "@/domain/job-form";
import { PROVIDER_LABELS } from "@/domain/providers";

export function JobFormCard({
  form,
  status,
}: {
  form: JobForm;
  status?: AgentStatus;
}) {
  return (
    <article className="rounded-2xl border border-border bg-white/80 p-3">
      <p className="text-[0.65rem] tracking-[0.16em] text-muted uppercase">
        Ficha de vaga
      </p>
      <h3 className="font-display mt-1 text-lg leading-tight">{form.role}</h3>
      <p className="mt-1 text-sm">{PROVIDER_LABELS[form.provider]}</p>
      {status ? (
        <p className="mt-2 text-xs text-muted">{STATUS_LABELS[status]}</p>
      ) : null}
    </article>
  );
}

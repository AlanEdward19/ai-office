"use client";

import { useState } from "react";

import { dispatchForIssue, dispatchSessionLink, type DispatchRecord } from "@/domain/dispatch";
import type { RoomIssue } from "@/domain/issues";
import { PROVIDER_LABELS } from "@/domain/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type BoardState =
  | { status: "loading" }
  | { status: "ready"; issues: RoomIssue[] }
  | { status: "missing_key" }
  | { status: "error"; message: string };

export function BoardPanel({
  roomName,
  projectId,
  state,
  dispatches,
  creating,
  message,
  readOnly,
  carriedId,
  onCreate,
  onRefresh,
  onClose,
  onCarry,
}: {
  roomName: string;
  projectId: string;
  state: BoardState;
  dispatches: readonly DispatchRecord[];
  creating: boolean;
  message: string | null;
  readOnly: boolean;
  carriedId: string | null;
  onCreate: (title: string) => Promise<boolean>;
  onRefresh: () => void;
  onClose: () => void;
  onCarry: (issue: RoomIssue) => void;
}) {
  const [title, setTitle] = useState("");
  const issues = state.status === "ready" ? state.issues.filter((issue) => issue.projectId === projectId) : [];

  return (
    <section className="pointer-events-auto flex max-h-[min(55dvh,34rem)] w-full sm:w-[24rem] flex-col overflow-hidden rounded-3xl bg-[#f7f1e8]/95 text-[#241c16] shadow-xl">
      <div className="flex items-start justify-between gap-4 px-5 pt-5">
        <div className="min-w-0 break-words">
          <p className="text-[0.65rem] tracking-[0.16em] text-[#8c7b6b] uppercase">Quadro</p>
          <h2 className="font-display text-2xl leading-tight">{roomName}</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Fechar
        </Button>
      </div>
      {readOnly ? (
        <p className="px-4 py-3 text-sm leading-5">Você está só olhando. Não dá para criar card nem soltar na mesa.</p>
      ) : (
        <form
          className="space-y-2 px-4 py-3"
          onSubmit={(event) => {
            event.preventDefault();
            const next = title.trim();
            if (!next || creating) return;
            void onCreate(next).then((saved) => {
              if (saved) setTitle("");
            });
          }}
        >
          <Label htmlFor="card-title">Novo card</Label>
          <div className="flex flex-wrap gap-3">
            <Input
              className="min-w-0 flex-1 basis-40"
              id="card-title"
              value={title}
              maxLength={200}
              placeholder="O que esta sala precisa"
              onChange={(event) => setTitle(event.target.value)}
            />
            <Button type="submit" disabled={creating || title.trim().length === 0}>
              {creating ? "Criando…" : "Criar"}
            </Button>
          </div>
        </form>
      )}
      <div className="min-h-0 flex-1 space-y-2 overflow-auto px-4 pb-3">
        {state.status === "loading" ? <p className="text-sm">Lendo as issues deste projeto…</p> : null}
        {state.status === "missing_key" ? (
          <p className="text-sm leading-5">
            Defina LINEAR_API_KEY nesta máquina para ver o quadro. A leitura para quando a página fecha.
          </p>
        ) : null}
        {state.status === "error" ? <p className="text-sm leading-5">{state.message}</p> : null}
        {state.status === "ready" && issues.length === 0 ? (
          <p className="text-sm leading-5">Nenhuma issue neste projeto. Um card novo nasce aqui e no Linear.</p>
        ) : null}
        {issues.map((issue) => {
          const dispatch = dispatchForIssue(dispatches, projectId, issue.id);
          const sessionLink = dispatch ? dispatchSessionLink(dispatch) : null;
          return (
            <article key={issue.id} className="rounded-2xl border border-border bg-white/85 p-3">
              <p className="text-[0.65rem] tracking-[0.14em] text-[#8c7b6b] uppercase">
                {issue.identifier}
                {issue.stateName ? ` · ${issue.stateName}` : ""}
              </p>
              <h3 className="mt-1 text-sm leading-5">{issue.title}</h3>
              {issue.url ? (
                <a
                  href={issue.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs text-[#9c4221] underline"
                  onClick={(event) => event.stopPropagation()}
                >
                  Abrir no Linear
                </a>
              ) : null}
              {dispatch ? (
                <p className="mt-2 text-xs text-[#5c5148]">
                  Na mesa · {PROVIDER_LABELS[dispatch.provider]}
                  {sessionLink ? (
                    <>
                      {" · "}
                      <a href={sessionLink.href} target="_blank" rel="noreferrer" className="underline">
                        {sessionLink.label}
                      </a>
                    </>
                  ) : null}
                </p>
              ) : readOnly ? null : (
                <Button
                  className="mt-2"
                  size="sm"
                  variant={carriedId === issue.id ? "default" : "outline"}
                  onClick={() => onCarry(issue)}
                >
                  {carriedId === issue.id ? "Na mão" : "Levar até a mesa"}
                </Button>
              )}
            </article>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2">
        {message ? <p className="text-xs leading-4 text-[#5c5148]">{message}</p> : <span />}
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          Atualizar
        </Button>
      </div>
    </section>
  );
}

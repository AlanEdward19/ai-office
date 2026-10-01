"use client";

import { useState } from "react";

import { parseJobForm, type JobForm, type JobFormError } from "@/domain/job-form";
import type { ProviderId } from "@/domain/providers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ERRORS: Record<JobFormError, string> = {
  role_required: "Diga qual é o cargo.",
  provider_required: "Escolha a empresa.",
  provider_unavailable: "Essa empresa não tem login nesta máquina.",
};

export type HiringProvider = { id: ProviderId; label: string };

export function JobFormDialog({
  open,
  onOpenChange,
  providers,
  loading,
  loadError,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providers: HiringProvider[];
  loading: boolean;
  loadError: string | null;
  onSubmit: (form: JobForm) => void;
}) {
  const [role, setRole] = useState("");
  const [provider, setProvider] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const allowed = providers.map((item) => item.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ficha de vaga</DialogTitle>
          <DialogDescription>
            O cargo e a empresa ficam na mesa. A empresa só entra se já houver
            login nesta máquina.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = parseJobForm({ role, provider }, allowed);
            if (!parsed.ok) {
              setError(ERRORS[parsed.error]);
              return;
            }
            try { onSubmit(parsed.form); onOpenChange(false); }
            catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível reservar o posto."); }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="cargo">Cargo</Label>
            <Input
              id="cargo"
              name="role"
              value={role}
              placeholder="Pesquisador, redator, revisor…"
              autoComplete="off"
              onChange={(event) => setRole(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="empresa">Empresa</Label>
            {loading ? (
              <p className="text-sm text-muted">Vendo quem está autenticado…</p>
            ) : loadError ? (
              <p className="text-sm text-[#9c4221]">{loadError}</p>
            ) : providers.length === 0 ? (
              <p className="text-sm leading-6 text-muted">
                Nenhuma empresa com login nesta máquina. Cursor, Anthropic
                (Claude) e OpenAI (Codex) aparecem quando a sessão já existe
                aqui.
              </p>
            ) : (
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger id="empresa" aria-label="Empresa">
                  <SelectValue placeholder="Escolha a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {error ? <p className="text-sm text-[#9c4221]">{error}</p> : null}
          <Button
            type="submit"
            className="w-full"
            disabled={loading || providers.length === 0}
          >
            Colocar na mesa
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

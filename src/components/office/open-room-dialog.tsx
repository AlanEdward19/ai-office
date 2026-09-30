"use client";

import { useState } from "react";

import type { LinearProject } from "@/domain/rooms";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function OpenRoomDialog({
  open,
  onOpenChange,
  projects,
  emptyMessage,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: readonly LinearProject[];
  emptyMessage: string | null;
  onSubmit: (projectId: string) => void;
}) {
  const [projectId, setProjectId] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abrir sala</DialogTitle>
          <DialogDescription>
            A sala usa o id do projeto. O nome fica só na porta. Um projeto que
            já tem sala não entra de novo.
          </DialogDescription>
        </DialogHeader>
        {emptyMessage ? (
          <p className="text-sm leading-6 text-muted">{emptyMessage}</p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!projectId) return;
              onSubmit(projectId);
              setProjectId("");
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="projeto">Projeto</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger id="projeto" aria-label="Projeto">
                  <SelectValue placeholder="Escolha um projeto sem sala" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {choiceLabel(project, projects)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={!projectId}>
              Abrir sala
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function choiceLabel(project: LinearProject, projects: readonly LinearProject[]) {
  const shared = projects.filter((item) => item.name === project.name).length > 1;
  return shared ? `${project.name} · ${project.id.slice(0, 8)}` : project.name;
}

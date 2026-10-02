import "server-only";

import { randomUUID } from "node:crypto";
import { networkInterfaces, userInfo } from "node:os";

import { parseJobForm } from "@/domain/job-form";
import { officeLanUrls } from "@/domain/office-machines";
import { bindRoom, roomsFromBindings } from "@/domain/opened-rooms";
import { layoutRooms } from "@/domain/rooms";
import {
  createOfficeHub,
  decideSignIn,
  type OfficeRole,
  type SharedScene,
} from "@/domain/office-share";
import { detectLocalLogins } from "@/server/local-logins";
import { listLinearProjects } from "@/server/linear-client";

import { meetingAreas } from "@/domain/meeting-areas";
import { setCallAreas } from "@/server/call-channel";

const COOKIE = "escritorio-sessao";
const GLOBAL_KEY = "__escritorioDeIaOffice";

type Session = {
  token: string;
  role: OfficeRole;
  name: string;
};

type OfficeState = {
  hub: ReturnType<typeof createOfficeHub>;
  sessions: Map<string, Session>;
  hostToken: string | null;
};

function state(): OfficeState {
  const globalStore = globalThis as typeof globalThis & { [GLOBAL_KEY]?: OfficeState };
  if (!globalStore[GLOBAL_KEY]) {
    const sessions = new Map<string, Session>();
    const office: OfficeState = {
      sessions,
      hostToken: null,
      hub: createOfficeHub({
        graceMs: 500,
        onEmpty: () => {
          sessions.clear();
          office.hostToken = null;
        },
      }),
    };
    globalStore[GLOBAL_KEY] = office;
  }
  return globalStore[GLOBAL_KEY];
}

export function readSessionToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function sessionCookie(token: string): string {
  return `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`;
}

export async function machineDisplayName(): Promise<string> {
  const apiKey = process.env.LINEAR_API_KEY?.trim();
  if (apiKey) {
    try {
      const listed = await listLinearProjects(apiKey, AbortSignal.timeout(2500));
      if (listed.viewerName) return listed.viewerName;
    } catch {
      // The OS user is enough when Linear is not logged in on this machine.
    }
  }
  return userInfo().username.trim() || "esta máquina";
}

export function findSession(request: Request): Session | null {
  const token = readSessionToken(request.headers.get("cookie"));
  if (!token) return null;
  return state().sessions.get(token) ?? null;
}

export async function signInOffice(input: {
  intent: OfficeRole;
  name: string;
  token: string | null;
}): Promise<
  | { ok: true; token: string; role: OfficeRole; name: string }
  | { ok: false; reason: "same_person" | "host_taken" | "name_required" }
> {
  const office = state();
  if (input.token) {
    const existing = office.sessions.get(input.token);
    if (
      existing &&
      input.intent === existing.role &&
      (existing.role === "host" || existing.name.toLowerCase() === input.name.trim().toLowerCase())
    ) {
      return { ok: true, token: existing.token, role: existing.role, name: existing.name };
    }
  }
  const machineName = await machineDisplayName();
  const host = office.hostToken ? office.sessions.get(office.hostToken) : undefined;
  const decision = decideSignIn({
    intent: input.intent,
    name: input.name,
    machineName,
    hostName: host?.name ?? null,
    hostTaken: Boolean(host),
  });
  if (!decision.ok) return decision;
  const token = randomUUID();
  office.sessions.set(token, { token, role: decision.role, name: decision.name });
  if (decision.role === "host") office.hostToken = token;
  return { ok: true, token, role: decision.role, name: decision.name };
}

export function subscribeOffice(role: OfficeRole, listener: (scene: SharedScene | null) => void) {
  return state().hub.join(role, listener);
}

export function publishOffice(role: OfficeRole, scene: unknown) {
  const result = state().hub.publish(role, scene);
  const snapshot = state().hub.snapshot();
  if (result.ok && snapshot) setCallAreas(meetingAreas(snapshot.rooms));
  return result;
}

export function reportLocalOffice(body: unknown) {
  return state().hub.reportLocal(body);
}

export async function hireSharedDesk(role: OfficeRole, form: unknown) {
  const logged = await detectLocalLogins();
  const record = form && typeof form === "object" ? (form as { role?: unknown; provider?: unknown }) : {};
  const parsed = parseJobForm(record, logged.providers);
  if (!parsed.ok) return { ok: false as const, reason: parsed.error };
  return state().hub.hire(role, {
    id: randomUUID(),
    form: parsed.form,
    owner: await machineDisplayName(),
    observedAt: new Date().toISOString(),
  });
}

export async function openSharedRoom(role: OfficeRole, projectId: string) {
  const apiKey = process.env.LINEAR_API_KEY?.trim();
  if (!apiKey) return { ok: false as const, reason: "missing_key" as const };
  const listed = await listLinearProjects(apiKey);
  const opened = state().hub.snapshot()?.rooms.map((room) => room.id) ?? [];
  const bound = bindRoom(opened, listed.projects, projectId);
  if (!bound.ok) return { ok: false as const, reason: bound.error };
  return state().hub.openRoom(role, layoutRooms(roomsFromBindings(listed.projects, bound.projectIds)));
}

export function officeLanAddresses(port = 3847): string[] {
  const entries = Object.values(networkInterfaces()).flatMap((list) => list ?? []);
  return officeLanUrls(entries, port);
}

export function officeViewerCount() {
  return state().hub.viewerCount();
}

export function officeSceneSnapshot(){return state().hub.snapshot();}

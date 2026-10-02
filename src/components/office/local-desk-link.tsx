"use client";

import { useEffect } from "react";

import { isAgentEvent, type AgentEvent } from "@/domain/agent-event";
import { isMachinePresence, presentLocalEvent, type MachinePresence } from "@/domain/local-hooks";
import { LOCAL_DESK_PORT } from "@/domain/office-machines";

const DESK = `http://127.0.0.1:${LOCAL_DESK_PORT}`;

/** Forwards this computer's real local status into the shared office. Nothing is sent if this machine is not running `npm run local`. */
export function LocalDeskLink() {
  useEffect(() => {
    let source: EventSource | null = null;
    let opened = false;
    let retry: number | null = null;
    let beat: number | null = null;
    let presence: MachinePresence | null = null;
    const agents = new Map<string, AgentEvent>();
    let closed = false;

    const send = (online: boolean) => {
      const machineId = presence?.machineId ?? [...agents.values()][0]?.machineId;
      const owner = presence?.owner ?? [...agents.values()][0]?.owner;
      if (!machineId || !owner) return;
      const body = JSON.stringify({
        machineId,
        owner,
        online: online && (presence?.online ?? true),
        agents: [...agents.values()],
      });
      if (online) {
        void fetch("/api/office/local", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        }).catch(() => undefined);
        return;
      }
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/office/local", new Blob([body], { type: "application/json" }));
        return;
      }
      void fetch("/api/office/local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => undefined);
    };

    const stop = () => {
      if (closed) return;
      closed = true;
      if (retry !== null) window.clearTimeout(retry);
      if (beat !== null) window.clearInterval(beat);
      source?.close();
      window.removeEventListener("pagehide", stop);
      send(false);
    };

    const connect = () => {
      if (closed) return;
      source?.close();
      opened = false;
      const next = new EventSource(`${DESK}/events`);
      source = next;
      next.onopen = () => {
        opened = true;
      };
      next.onerror = () => {
        if (opened || closed) return;
        next.close();
        if (source === next) source = null;
        retry = window.setTimeout(connect, 3_000);
      };
      next.addEventListener("agent", (event) => {
        try {
          const parsed = JSON.parse((event as MessageEvent).data) as unknown;
          if (!isAgentEvent(parsed) || parsed.origin !== "local") return;
          agents.set(parsed.provider, parsed);
          send(true);
        } catch {
          /* Ignore a line this machine did not format as status. */
        }
      });
      next.addEventListener("presence", (event) => {
        try {
          const parsed = JSON.parse((event as MessageEvent).data) as unknown;
          if (!isMachinePresence(parsed)) return;
          presence = parsed;
          if (!parsed.online) {
            for (const [provider, agent] of agents) agents.set(provider, presentLocalEvent(agent, false));
          }
          send(parsed.online);
        } catch {
          /* Ignore a presence line that is not from this machine. */
        }
      });
    };

    beat = window.setInterval(() => {
      if (!opened) return;
      void fetch(`${DESK}/beat`, { method: "POST" }).catch(() => undefined);
      send(true);
    }, 4_000);
    window.addEventListener("pagehide", stop);
    connect();
    return stop;
  }, []);

  return null;
}

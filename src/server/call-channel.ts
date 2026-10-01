import "server-only";

import { createCallHub, type CallDownlink } from "@/domain/call";

const GLOBAL_KEY = "__escritorioDeIaCallV2";

function hub() {
  const globalStore = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: ReturnType<typeof createCallHub>;
  };
  if (!globalStore[GLOBAL_KEY]) {
    const channel = createCallHub();
    globalStore[GLOBAL_KEY] = channel;
    const timer = setInterval(() => channel.tick(), 1000);
    timer.unref();
  }
  return globalStore[GLOBAL_KEY];
}

export function joinCall(
  input: { id: string; name: string; token: string; host?: boolean },
  listener: (event: CallDownlink) => void,
) {
  return hub().join(input, listener);
}

export function postCall(input: { token: string; from: string; to: string; signal: unknown }) {
  return hub().post(input);
}

export function actCall(input: { token: string; from: string; action: unknown }) {
  return hub().action(input);
}
export function setCallAreas(areas: import('@/domain/meeting-areas').MeetingArea[]) {
  hub().setAreas(areas);
}

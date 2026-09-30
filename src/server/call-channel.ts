import "server-only";

import { createCallHub, type CallDownlink } from "@/domain/call";

const GLOBAL_KEY = "__escritorioDeIaCall";

function hub() {
  const globalStore = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: ReturnType<typeof createCallHub>;
  };
  if (!globalStore[GLOBAL_KEY]) globalStore[GLOBAL_KEY] = createCallHub();
  return globalStore[GLOBAL_KEY];
}

export function joinCall(
  input: { id: string; name: string; token: string },
  listener: (event: CallDownlink) => void,
) {
  return hub().join(input, listener);
}

export function postCall(input: { token: string; from: string; to: string; signal: unknown }) {
  return hub().post(input);
}

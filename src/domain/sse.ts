export type SseMessage = {
  event: string;
  data: string;
  id?: string;
};

export function parseSseBlock(block: string): SseMessage | null {
  const lines = block.split(/\r?\n/).filter((line) => line.length > 0 && !line.startsWith(":"));
  if (lines.length === 0) return null;
  let event = "message";
  const data: string[] = [];
  let id: string | undefined;
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    else if (line.startsWith("id:")) id = line.slice(3).trim();
  }
  if (data.length === 0) return null;
  return { event, data: data.join("\n"), id };
}

export function takeSseBlocks(buffer: string): { messages: SseMessage[]; rest: string } {
  const parts = buffer.split(/\r?\n\r?\n/);
  const rest = parts.pop() ?? "";
  const messages = parts
    .map(parseSseBlock)
    .filter((message): message is SseMessage => message !== null);
  return { messages, rest };
}

export function readStreamStatus(data: string): string | null {
  try {
    const parsed = JSON.parse(data) as { status?: unknown };
    return typeof parsed.status === "string" ? parsed.status : null;
  } catch {
    return null;
  }
}

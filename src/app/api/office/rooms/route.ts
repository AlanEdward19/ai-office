import { canPerform } from "@/domain/office-share";
import { findSession, openSharedRoom } from "@/server/office-channel";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = findSession(request);
  if (!session || !canPerform(session.role, "open_room")) {
    return Response.json({ error: "read_only" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "project_required" }, { status: 400 });
  }
  const projectId =
    body && typeof body === "object" && typeof (body as { projectId?: unknown }).projectId === "string"
      ? (body as { projectId: string }).projectId
      : "";
  const result = await openSharedRoom(session.role, projectId);
  if (!result.ok) {
    const status = result.reason === "read_only" ? 403 : result.reason === "missing_key" ? 400 : 409;
    return Response.json({ error: result.reason }, { status });
  }
  return Response.json({ ok: true });
}

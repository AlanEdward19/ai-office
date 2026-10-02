import { canPerform } from "@/domain/office-share";
import { findSession, hireSharedDesk } from "@/server/office-channel";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = findSession(request);
  if (!session || !canPerform(session.role, "hire")) {
    return Response.json({ error: "read_only" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "role_required" }, { status: 400 });
  }
  const result = await hireSharedDesk(session.role, body);
  if (!result.ok) {
    const status =
      result.reason === "read_only" ? 403 : result.reason === "capacity" || result.reason === "exists" ? 409 : 400;
    return Response.json({ error: result.reason }, { status });
  }
  return Response.json({ ok: true });
}

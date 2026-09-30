import { isProviderId } from "@/domain/providers";
import { canPerform } from "@/domain/office-share";
import { dispatchAttachment, dispatchComment } from "@/domain/dispatch";
import { findSession } from "@/server/office-channel";
import { createCursorCloudAgent } from "@/server/cursor-client";
import { ObserveHttpError } from "@/domain/observe-cursor";
import { LinearRequestError, linkDispatchOnIssue, readIssueForDispatch } from "@/server/linear-client";
import { detectAuthenticatedProviders } from "@/server/local-logins";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = findSession(request);
  if (!session || !canPerform(session.role, "dispatch")) {
    return Response.json({ dispatch: null, error: "read_only" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ dispatch: null, error: "invalid" }, { status: 400 });
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const projectId = typeof record.projectId === "string" ? record.projectId.trim() : "";
  const issueId = typeof record.issueId === "string" ? record.issueId.trim() : "";
  if (!projectId || !issueId || !isProviderId(record.provider)) {
    return Response.json({ dispatch: null, error: "invalid" }, { status: 400 });
  }

  const loggedIn = await detectAuthenticatedProviders();
  if (!loggedIn.includes(record.provider)) {
    return Response.json({ dispatch: null, error: "provider_not_logged_in" }, { status: 403 });
  }
  if (record.provider !== "cursor") {
    return Response.json({ dispatch: null, error: "dispatch_not_available" }, { status: 409 });
  }

  const linearKey = process.env.LINEAR_API_KEY?.trim();
  if (!linearKey) {
    return Response.json({ dispatch: null, error: "missing_key" }, { status: 400 });
  }
  const cursorKey = process.env.CURSOR_API_KEY?.trim();
  if (!cursorKey) {
    return Response.json({ dispatch: null, error: "cursor_key_missing" }, { status: 400 });
  }

  try {
    const issue = await readIssueForDispatch(linearKey, issueId, projectId, request.signal);
    const agent = await createCursorCloudAgent(cursorKey, issue, request.signal);
    const agentUrl = agent.url;
    const linked = await linkDispatchOnIssue(
      linearKey,
      issue.id,
      dispatchAttachment(agentUrl),
      dispatchComment(agentUrl),
      request.signal,
    );
    return Response.json({
      error: null,
      dispatch: {
        issueId: issue.id,
        projectId: issue.projectId,
        provider: "cursor",
        cursorAgentId: agent.id,
        cursorAgentUrl: agentUrl,
        linked,
      },
    });
  } catch (error) {
    if (error instanceof LinearRequestError) {
      const status = error.code === "unauthorized" ? 401 : error.code === "wrong_project" ? 409 : 502;
      return Response.json({ dispatch: null, error: error.code }, { status });
    }
    if (error instanceof ObserveHttpError) {
      const code = error.status === 401 ? "cursor_rejected" : "cursor_unavailable";
      return Response.json({ dispatch: null, error: code }, { status: error.status === 401 ? 401 : 502 });
    }
    return Response.json({ dispatch: null, error: "unavailable" }, { status: 502 });
  }
}

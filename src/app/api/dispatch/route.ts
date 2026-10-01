import { isProviderId } from "@/domain/providers";
import { canPerform } from "@/domain/office-share";
import { dispatchExecution, cursorDispatchPrompt, dispatchAttachment, dispatchComment } from "@/domain/dispatch";
import { claudeCloudAttachment, claudeCloudComment, claudeCloudPrompt } from "@/domain/claude-cloud";
import { findSession } from "@/server/office-channel";
import { createCursorCloudAgent } from "@/server/cursor-client";
import { isAbortError, ObserveHttpError } from "@/domain/observe-cursor";
import { LinearRequestError, linkDispatchOnIssue, readIssueForDispatch } from "@/server/linear-client";
import { ConversationError, startAgentConversation } from "@/server/agent-conversation";
import { detectLocalLogins } from "@/server/local-logins";
import { ClaudeCloudError, startClaudeCloudSession } from "@/server/claude-cloud";

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
  const deskId = typeof record.deskId === "string" ? record.deskId.trim() : "";
  const issueId = typeof record.issueId === "string" ? record.issueId.trim() : "";
  if (!projectId || !issueId || !isProviderId(record.provider)) {
    return Response.json({ dispatch: null, error: "invalid" }, { status: 400 });
  }

  const execution = dispatchExecution(record.provider, record.execution);
  if (!execution) return Response.json({dispatch:null,error:"invalid_execution"},{status:400});
  const loggedIn = await detectLocalLogins();
  if (!loggedIn.providers.includes(record.provider)) {
    return Response.json({ dispatch: null, error: "provider_not_logged_in" }, { status: 403 });
  }
  if (record.provider !== "cursor" && !deskId) return Response.json({dispatch:null,error:"invalid"},{status:400});

  const linearKey = process.env.LINEAR_API_KEY?.trim();
  if (!linearKey) {
    return Response.json({ dispatch: null, error: "missing_key" }, { status: 400 });
  }

  if (record.provider === "cursor") {
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
          claudeSessionId: null,
          claudeSessionUrl: null,
          linked,
        },
      });
    } catch (error) {
      return dispatchFailure(error);
    }
  }

  try {
    const issue = await readIssueForDispatch(linearKey, issueId, projectId, request.signal);
    if(record.provider!=="anthropic"||execution==="managed"){
      await startAgentConversation({hostToken:session.token,deskId,provider:record.provider,message:cursorDispatchPrompt(issue),cursorAgentId:null});
      return Response.json({error:null,dispatch:{issueId:issue.id,projectId:issue.projectId,provider:record.provider,cursorAgentId:null,cursorAgentUrl:null,claudeSessionId:null,claudeSessionUrl:null,linked:null}});
    }
    const cloudSession = await startClaudeCloudSession({
      bin: loggedIn.claudeBin,
      prompt: claudeCloudPrompt(issue),
      cwd: process.cwd(),
      signal: request.signal,
    });
    const {recordClaudeCloudHistory}=await import("@/server/agent-history");
    await recordClaudeCloudHistory(cloudSession.id,deskId).catch(()=>{});
    const linked = await linkDispatchOnIssue(
      linearKey,
      issue.id,
      claudeCloudAttachment(cloudSession.url),
      claudeCloudComment(cloudSession.url),
      request.signal,
    );
    return Response.json({
      error: null,
      dispatch: {
        issueId: issue.id,
        projectId: issue.projectId,
        provider: "anthropic",
        cursorAgentId: null,
        cursorAgentUrl: null,
        claudeSessionId: cloudSession.id,
        claudeSessionUrl: cloudSession.url,
        linked,
      },
    });
  } catch (error) {
    return dispatchFailure(error);
  }
}

function dispatchFailure(error: unknown): Response {
  if(error instanceof ConversationError)return Response.json({dispatch:null,error:error.message},{status:error.status});
  if (isAbortError(error)) {
    return Response.json({ dispatch: null, error: "unavailable" }, { status: 502 });
  }
  if (error instanceof LinearRequestError) {
    const status = error.code === "unauthorized" ? 401 : error.code === "wrong_project" ? 409 : 502;
    return Response.json({ dispatch: null, error: error.code }, { status });
  }
  if (error instanceof ObserveHttpError) {
    const code = error.status === 401 ? "cursor_rejected" : "cursor_unavailable";
    return Response.json({ dispatch: null, error: code }, { status: error.status === 401 ? 401 : 502 });
  }
  if (error instanceof ClaudeCloudError) {
    const code =
      error.code === "cli_missing"
        ? "claude_cli_missing"
        : error.code === "auth"
          ? "claude_cloud_auth"
          : error.code === "unreadable"
            ? "claude_cloud_unreadable"
            : "claude_cloud_rejected";
    const status = error.code === "cli_missing" || error.code === "auth" ? 409 : 502;
    return Response.json({ dispatch: null, error: code }, { status });
  }
  return Response.json({ dispatch: null, error: "unavailable" }, { status: 502 });
}

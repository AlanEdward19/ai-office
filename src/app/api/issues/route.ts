import { issuesForProject, parseCardTitle } from "@/domain/issues";
import { canPerform } from "@/domain/office-share";
import { findSession } from "@/server/office-channel";
import {
  createProjectIssue,
  LinearRequestError,
  listProjectIssues,
} from "@/server/linear-client";

export const dynamic = "force-dynamic";

function linearError(error: unknown) {
  const code = error instanceof LinearRequestError ? error.code : "unavailable";
  const status =
    code === "unauthorized" ? 401 : code === "not_found" || code === "wrong_project" ? 404 : 502;
  return Response.json({ issues: [], issue: null, error: code }, { status });
}

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId")?.trim() ?? "";
  if (!projectId) {
    return Response.json({ issues: [], error: "missing_project" }, { status: 400 });
  }
  const apiKey = process.env.LINEAR_API_KEY?.trim();
  if (!apiKey) {
    return Response.json({ projectId, issues: [], error: "missing_key" });
  }
  try {
    const issues = issuesForProject(await listProjectIssues(apiKey, projectId, request.signal), projectId);
    return Response.json({ projectId, issues, error: null });
  } catch (error) {
    return linearError(error);
  }
}

export async function POST(request: Request) {
  const session = findSession(request);
  if (!session || !canPerform(session.role, "create_card")) {
    return Response.json({ issue: null, error: "read_only" }, { status: 403 });
  }
  const apiKey = process.env.LINEAR_API_KEY?.trim();
  if (!apiKey) {
    return Response.json({ issue: null, error: "missing_key" }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ issue: null, error: "title_required" }, { status: 400 });
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const projectId = typeof record.projectId === "string" ? record.projectId.trim() : "";
  const title = parseCardTitle(record.title);
  if (!projectId) {
    return Response.json({ issue: null, error: "missing_project" }, { status: 400 });
  }
  if (!title) {
    return Response.json({ issue: null, error: "title_required" }, { status: 400 });
  }
  try {
    const issue = await createProjectIssue(apiKey, projectId, title, request.signal);
    if (issue.projectId !== projectId) {
      return Response.json({ issue: null, error: "wrong_project" }, { status: 409 });
    }
    return Response.json({ issue, error: null });
  } catch (error) {
    return linearError(error);
  }
}

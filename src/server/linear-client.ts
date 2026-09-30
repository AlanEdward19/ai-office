import "server-only";

import { readLinkSuccess } from "@/domain/dispatch";
import {
  issueCreateVariables,
  mergeRoomIssues,
  readCreatedIssue,
  readIssueDetail,
  readProjectIssues,
  readProjectTeam,
  type IssueDetail,
  type RoomIssue,
} from "@/domain/issues";
import { readLinearPage, type LinearProject } from "@/domain/rooms";

const ENDPOINT = "https://api.linear.app/graphql";

const QUERY = `
  query OfficeProjects($after: String) {
    viewer { name email }
    projects(first: 50, after: $after) {
      nodes { id name }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export class LinearRequestError extends Error {
  constructor(
    readonly code: "unauthorized" | "unavailable" | "not_found" | "without_team" | "wrong_project",
  ) {
    super(code);
    this.name = "LinearRequestError";
  }
}

const ISSUE_FIELDS = `
  id
  identifier
  title
  url
  createdAt
  state { name }
  project { id }
`;

async function linearGraphql(
  apiKey: string,
  query: string,
  variables: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    signal,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (response.status === 401 || response.status === 403) {
    throw new LinearRequestError("unauthorized");
  }
  if (!response.ok) throw new LinearRequestError("unavailable");
  const payload: unknown = await response.json();
  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as { errors?: unknown }).errors) &&
    !(payload as { data?: unknown }).data
  ) {
    throw new LinearRequestError("unavailable");
  }
  return payload;
}

export async function listLinearProjects(
  apiKey: string,
  signal?: AbortSignal,
): Promise<{ viewerName: string | null; projects: LinearProject[] }> {
  const projects: LinearProject[] = [];
  let viewerName: string | null = null;
  let after: string | null = null;

  for (let page = 0; page < 20; page += 1) {
    const payload = await linearGraphql(apiKey, QUERY, { after }, signal);
    const parsed = readLinearPage(payload);
    if (!viewerName && parsed.viewerName) viewerName = parsed.viewerName;
    projects.push(...parsed.projects);
    if (!parsed.hasNextPage || !parsed.endCursor) break;
    after = parsed.endCursor;
  }

  return { viewerName, projects };
}

const PROJECT_ISSUES = `
  query RoomIssues($projectId: String!, $after: String) {
    project(id: $projectId) {
      id
      teams(first: 5) { nodes { id } }
      issues(first: 50, after: $after) {
        nodes { ${ISSUE_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

const PROJECT_TEAM = `
  query RoomTeam($projectId: String!) {
    project(id: $projectId) {
      id
      teams(first: 5) { nodes { id } }
    }
  }
`;

const ISSUE_CREATE = `
  mutation RoomIssueCreate($input: IssueCreateInput!) {
    issueCreate(input: $input) {
      success
      issue { ${ISSUE_FIELDS} }
    }
  }
`;

const ISSUE_DETAIL = `
  query RoomIssue($id: String!) {
    issue(id: $id) {
      ${ISSUE_FIELDS}
      description
    }
  }
`;

const ATTACHMENT_CREATE = `
  mutation RoomAttachment($input: AttachmentCreateInput!) {
    attachmentCreate(input: $input) { success }
  }
`;

const COMMENT_CREATE = `
  mutation RoomComment($input: CommentCreateInput!) {
    commentCreate(input: $input) { success }
  }
`;

export async function listProjectIssues(
  apiKey: string,
  projectId: string,
  signal?: AbortSignal,
): Promise<RoomIssue[]> {
  const collected: RoomIssue[] = [];
  let after: string | null = null;
  for (let page = 0; page < 8; page += 1) {
    const payload = await linearGraphql(apiKey, PROJECT_ISSUES, { projectId, after }, signal);
    const parsed = readProjectIssues(payload, projectId);
    if (!parsed.projectFound) throw new LinearRequestError("not_found");
    collected.push(...parsed.issues);
    if (!parsed.hasNextPage || !parsed.endCursor) break;
    after = parsed.endCursor;
  }
  return mergeRoomIssues(collected).filter((issue) => issue.projectId === projectId);
}

export async function createProjectIssue(
  apiKey: string,
  projectId: string,
  title: string,
  signal?: AbortSignal,
): Promise<RoomIssue> {
  const teamPayload = await linearGraphql(apiKey, PROJECT_TEAM, { projectId }, signal);
  const team = readProjectTeam(teamPayload, projectId);
  if (!team.projectFound) throw new LinearRequestError("not_found");
  if (!team.teamId) throw new LinearRequestError("without_team");
  const created = await linearGraphql(
    apiKey,
    ISSUE_CREATE,
    issueCreateVariables(projectId, team.teamId, title),
    signal,
  );
  const issue = readCreatedIssue(created, projectId);
  if (!issue) throw new LinearRequestError("wrong_project");
  return issue;
}

export async function readIssueForDispatch(
  apiKey: string,
  issueId: string,
  projectId: string,
  signal?: AbortSignal,
): Promise<IssueDetail> {
  const payload = await linearGraphql(apiKey, ISSUE_DETAIL, { id: issueId }, signal);
  const issue = readIssueDetail(payload);
  if (!issue || issue.projectId !== projectId) throw new LinearRequestError("wrong_project");
  return issue;
}

export async function linkDispatchOnIssue(
  apiKey: string,
  issueId: string,
  attachment: { title: string; url: string },
  comment: string,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const attached = await linearGraphql(
      apiKey,
      ATTACHMENT_CREATE,
      { input: { issueId, title: attachment.title, url: attachment.url } },
      signal,
    );
    if (readLinkSuccess(attached, "attachmentCreate")) return true;
  } catch (error) {
    if (error instanceof LinearRequestError && error.code === "unauthorized") throw error;
  }
  try {
    const commented = await linearGraphql(
      apiKey,
      COMMENT_CREATE,
      { input: { issueId, body: comment } },
      signal,
    );
    return readLinkSuccess(commented, "commentCreate");
  } catch (error) {
    if (error instanceof LinearRequestError && error.code === "unauthorized") throw error;
    return false;
  }
}

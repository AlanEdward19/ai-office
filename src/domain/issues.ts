export type RoomIssue = {
  id: string;
  identifier: string;
  title: string;
  url: string;
  createdAt: string;
  stateName: string;
  projectId: string;
};

export type IssueDetail = RoomIssue & {
  description: string | null;
};

export function parseCardTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const title = value.trim().replace(/\s+/g, " ");
  if (!title) return null;
  return title.slice(0, 200);
}

export function issuesForProject(
  issues: readonly RoomIssue[],
  projectId: string,
): RoomIssue[] {
  return issues.filter((issue) => issue.projectId === projectId);
}

export function mergeRoomIssues(issues: readonly RoomIssue[]): RoomIssue[] {
  const byId = new Map<string, RoomIssue>();
  for (const issue of issues) {
    if (!issue.id || !issue.projectId) continue;
    byId.set(issue.id, issue);
  }
  return [...byId.values()].sort((a, b) => {
    const byTime = b.createdAt.localeCompare(a.createdAt);
    return byTime === 0 ? a.id.localeCompare(b.id) : byTime;
  });
}

export function issueCreateVariables(projectId: string, teamId: string, title: string) {
  return {
    input: {
      title,
      teamId,
      projectId,
    },
  };
}

type PageRead = {
  projectFound: boolean;
  teamId: string | null;
  issues: RoomIssue[];
  hasNextPage: boolean;
  endCursor: string | null;
};

export function readProjectTeam(
  payload: unknown,
  projectId: string,
): { projectFound: boolean; teamId: string | null } {
  const project = dataRecord(payload)?.project;
  if (!project || typeof project !== "object") return { projectFound: false, teamId: null };
  const record = project as Record<string, unknown>;
  if (record.id !== projectId) return { projectFound: false, teamId: null };
  return { projectFound: true, teamId: stringField(connectionNodes(record.teams)[0], "id") };
}

export function readProjectIssues(payload: unknown, projectId: string): PageRead {
  const empty: PageRead = {
    projectFound: false,
    teamId: null,
    issues: [],
    hasNextPage: false,
    endCursor: null,
  };
  const project = dataRecord(payload)?.project;
  if (!project || typeof project !== "object") return empty;
  const record = project as Record<string, unknown>;
  if (record.id !== projectId) return empty;
  const teams = connectionNodes(record.teams);
  const teamId = stringField(teams[0], "id");
  const issuesConnection =
    record.issues && typeof record.issues === "object"
      ? (record.issues as Record<string, unknown>)
      : {};
  const pageInfo =
    issuesConnection.pageInfo && typeof issuesConnection.pageInfo === "object"
      ? (issuesConnection.pageInfo as Record<string, unknown>)
      : {};
  return {
    projectFound: true,
    teamId,
    issues: connectionNodes(record.issues).flatMap((node) => {
      const issue = readIssueNode(node, projectId, true);
      return issue ? [issue] : [];
    }),
    hasNextPage: pageInfo.hasNextPage === true,
    endCursor: typeof pageInfo.endCursor === "string" ? pageInfo.endCursor : null,
  };
}

export function readCreatedIssue(payload: unknown, projectId: string): RoomIssue | null {
  const created = dataRecord(payload)?.issueCreate;
  if (!created || typeof created !== "object") return null;
  const record = created as Record<string, unknown>;
  if (record.success !== true) return null;
  return readIssueNode(record.issue, projectId, false);
}

export function readIssueDetail(payload: unknown): IssueDetail | null {
  const issue = dataRecord(payload)?.issue;
  if (!issue || typeof issue !== "object") return null;
  const record = issue as Record<string, unknown>;
  const projectId = nestedId(record.project);
  if (!projectId) return null;
  const base = readIssueNode(issue, projectId, false);
  if (!base) return null;
  const description = record.description;
  return {
    ...base,
    description: typeof description === "string" && description.trim() ? description.trim() : null,
  };
}

function readIssueNode(node: unknown, projectId: string, trustScope: boolean): RoomIssue | null {
  if (!node || typeof node !== "object") return null;
  const record = node as Record<string, unknown>;
  const id = stringField(record, "id");
  const title = typeof record.title === "string" ? record.title.trim() : "";
  if (!id || !title) return null;
  const owner = nestedId(record.project);
  if (owner && owner !== projectId) return null;
  if (!owner && !trustScope) return null;
  const identifier = stringField(record, "identifier") ?? id;
  const url = stringField(record, "url") ?? "";
  const createdAt = stringField(record, "createdAt") ?? "";
  const state =
    record.state && typeof record.state === "object"
      ? (record.state as Record<string, unknown>)
      : null;
  const stateName =
    state && typeof state.name === "string" && state.name.trim() ? state.name.trim() : "Sem estado";
  return { id, identifier, title, url, createdAt, stateName, projectId };
}

function dataRecord(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== "object") return null;
  return data as Record<string, unknown>;
}

function connectionNodes(value: unknown): unknown[] {
  if (!value || typeof value !== "object") return [];
  const nodes = (value as { nodes?: unknown }).nodes;
  return Array.isArray(nodes) ? nodes : [];
}

function nestedId(value: unknown): string | null {
  return stringField(value, "id");
}

function stringField(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object") return null;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" && field.trim() ? field.trim() : null;
}

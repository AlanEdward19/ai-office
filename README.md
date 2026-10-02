# Escritório de IA

A local office you walk through at person height. The floor exists only while you have the page open. There is no deployed service and no process that keeps watching Cursor after the tab closes.

## Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

`npm run dev` listens on port 3847. On this machine, open [http://127.0.0.1:3847](http://127.0.0.1:3847). Another computer on the same Wi-Fi opens its own localhost the same way. While both pages are open, the two processes find each other on the local network. There is no address to hand over, no deployed service, and no cloud room. When the last page on a machine closes, that machine stops announcing; its snapshot, sessions, and call signal are dropped.

WASD walks. The arrow keys turn. In first person the mouse looks around; drag once to capture it, and Esc releases it. In third person, drag to look. Click the floor to walk there. Stand next to a desk, a room board, the elevator, or the HR desk and press E. The camera stays at eye level behind you. It is not an overhead diorama.

Put real keys in `.env.local` only. That file is gitignored. Do not commit keys.

## Environment

| Variable | Required for | Notes |
| --- | --- | --- |
| `LINEAR_API_KEY` | Choosing a project for a new room, and that room's board | Personal API key. The app sends it in the `Authorization` header with no `Bearer` prefix. |
| `CURSOR_API_KEY` | Cloud agent status, and starting one when a card is dropped on a Cursor desk | User API key from the Cursor dashboard. Used to list cloud agents, read a run stream, and `POST /v1/agents` while the page is open. |
| `ANTHROPIC_API_KEY` | Live status of a Claude cloud session this app started | Read on the server from `.env.local`. Sent only as `x-api-key` on `GET https://api.anthropic.com/v1/sessions` while the host page is open. Not sent to the page. |

A hired Claude desk still starts a cloud session with `claude --cloud` and the CLI's existing claude.ai login. That start does not use `ANTHROPIC_API_KEY`. The same variable is what the server uses to read live status.

The lobby, reception, and CEO corner render without either key. They stay on the ground floor. A room appears when you bind it to a Linear project that does not already have one. The room identity is the project id. The name is only the label on the door. Reloading the project list updates that label. It does not open a room by itself.

## Companies on the job form

The ficha de vaga asks for a role and a company. The company list is whoever already has a login on this machine. A provider that is not authenticated is omitted. Grok is not offered.

- **Cursor** — `CURSOR_API_KEY`, a Cursor CLI login at `~/.config/cursor/auth.json`, or a Cursor IDE session.
- **Anthropic (Claude)** — `claude auth status` (`claude` on `PATH`, or the native binary at `~/.local/bin/claude`), `~/.claude/.credentials.json` (or `CLAUDE_CONFIG_DIR`), or `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN`.
- **OpenAI (Codex)** — `codex login status`, `~/.codex/auth.json` (or `CODEX_HOME`), or `OPENAI_API_KEY`.

Those checks stay on the server. The page receives company names, not session secrets. Saving the form seats an agent at a desk, and that desk keeps the same form.

## Floors

The ground floor is the lobby: reception, the CEO corner, desks, and the rooms you have opened. The elevator switches the visible floor to HR. It does not reload the page and it does not start a fetch. Closing the page still stops every request.

HR is where hiring happens. It opens the same ficha de vaga. The company list is still only the providers logged in on this machine. Sending the form puts the agent at a desk on the ground floor, with that company on the desk.

## Board and desk

Open a room to read that Linear project's issues. The request runs while the page is open and stops when you leave. The board never lists another project's issues.

Writing a card creates a Linear issue in that room's project. The same issue opens in Linear.

Drop the card on a desk that already has a ficha de vaga. The company on that form has to be logged in on this machine. A desk without a form does not take a card.

Cursor and a hired Claude desk can start work. A drop on a Cursor desk calls the Cursor cloud agents API, and the existing observer moves that desk's avatar to working, then to done when the run finishes. A drop on a Claude desk runs `claude --cloud` with the issue text. The CLI uses the claude.ai login it already has and opens a session at claude.ai/code. The board keeps that session link. While the host page is open, that desk shows `running`, `idle`, or `terminated` from the Managed Agents list for the session this desk started. A missing key, a refused key, a failed call, or a session that is not in the list shows the failure or `unknown`. The desk does not fall back to idle. OpenAI stays on the form, but the drop is refused. Nothing is sent to the OpenAI API. The Anthropic key stays on the server.

The Linear issue keeps the link to the Cursor agent or the Claude cloud session. Closing the page stops the observer and aborts a Claude start that has not finished. No process keeps running.

## Cloud agent status

While the tab is open, the app follows one Cursor cloud agent: `ACTIVE` or `RUNNING` shows as working, and `FINISHED` shows as done. The scene only reads that internal event. Closing the tab aborts the stream. Nothing is left polling. Cloud events keep `machineId` null.

A Claude cloud session started from a desk is not part of that Cursor stream. While the host tab is open, the server lists Managed Agent sessions with `GET https://api.anthropic.com/v1/sessions`. The request sends `x-api-key` from `ANTHROPIC_API_KEY`, `anthropic-version: 2023-06-01`, and `anthropic-beta: managed-agents-2026-04-01`. The hired Claude cloud desk shows `running`, `idle`, or `terminated` when that list contains the session id stored at drop time. `rescheduling` is left off the desk. If `ANTHROPIC_API_KEY` is missing, the desk shows `falha: ANTHROPIC_API_KEY ausente`. A refused key, a failed call, or an unreadable list shows that failure. No matching row shows `unknown`. None of those cases is shown as idle. Closing the tab stops the poll. A colleague sees the published label and does not call the API.

## Local wing

A local Cursor, Claude Code, or Codex agent uses that same event, with `origin` `local` and a `machineId` this app creates in `~/.escritorio-de-ia/machine-id`. The owner is the person who started the session: the OS user, or the name or email the hook includes. The avatar sits in a separate wing, with a local badge, and is not the cloud desk.

The bridge is the open page. While the page is open it installs user-level hooks and removes only those hooks after the last page closes:

- Cursor reads `sessionStart`, `postToolUse`, `stop`, and `sessionEnd` from `~/.cursor/hooks.json`.
- Claude Code reads `SessionStart`, `PreToolUse`, `PermissionRequest`, `Stop`, and `SessionEnd` from `~/.claude/settings.json`. `PermissionRequest` is blocked. While the page is open and Claude Code is already logged in, the same seat also follows `claude agents --json`: `busy` or `shell` is working, `waiting` or a background `blocked` state is blocked, and `idle` or no live session is idle. Paths, session names, and prompts from that list are not kept. If Claude Code is not logged in, those hooks are removed and the seat is not shown working.

Each hook appends a status line and exits. It does not record tool arguments or secrets. Other hooks in those files stay. If a file is not valid JSON, it is left untouched and that provider stays idle.

Closing the page, or losing the spool, stops the working animation. The bridge starts at the end of the spool, so older lines are not shown as work in progress. There is no always-on process and no cloud fleet API.

## Codex and Grok

Codex is read from the local app-server, `codex app-server`, only while this page is open and only if OpenAI is already logged in on this machine. The client sends `initialize`, then `thread/list`, `thread/loaded/list`, and `thread/read`. It does not start a thread or a turn, and it does not call a cloud fleet API. A thread that is `idle` shows as idle, `active` shows as working, and `active` with `waitingOnApproval` shows as blocked. The OpenAI desk in the local wing follows that status. Closing the page stops the process. If the CLI is missing, or the login is not there, that desk does not show working.

Grok is not on the job form. There is no presence API, so no desk is drawn as working from the product UI.

## Colleagues

Each person opens localhost on their own computer and enters on that machine. Offices on the same Wi-Fi find each other while those pages are open. A second person on this same computer can still choose **Entrar para interagir** or **Entrar só para olhar**. Interact can hire, open a room, create a card, and drop a card through this machine's Linear login, Cursor cloud key, and Claude CLI. Observer can walk and see status, and cannot hire, open a room, create or drop a card, publish the office, or start work.

Each machine reads its own Cursor, Claude Code, and Codex sessions while its page is open and sends that status to the other office. A local agent is drawn on both floors with the machine that reported it, and it is shown working only when that report says working. A session no machine reported is not drawn. A cloud agent is labeled as cloud, with the account or desk that started it, and it does not get a machine id.

A card dropped on a machine starts Cursor cloud or Claude cloud there. It does not start a local session on the other computer. The local seat on that computer stays a status report.

The shared channel is memory in each dev server, tied to the open pages. It sends status only: provider, origin, owner, machine id, project id, status, when it was observed, and, for a hired Claude cloud desk, a closed label (`running`, `idle`, `terminated`, `unknown`, or one failure string). Transcripts, tool arguments, file paths, and secrets are not included. When the last page on a machine closes, that machine's snapshot, reports, and sessions are dropped and it stops announcing. Voice and video stay a direct call between pages and are not part of agent status.

## Voice and video

Two open pages hear and see each other over a direct WebRTC connection. On localhost the microphone and camera can be turned on as soon as the page is in the office; both start muted. The capture asks the browser for echo cancellation, noise suppression, and a single channel, and the voice codec stays mono. The dev server only forwards the offer, the answer, and ICE candidates between machines on the local network, and only while those pages are open. It does not open a cloud room, and it does not mix the call into agent status. When the last page closes, the signal is dropped and the call ends. Nothing stays running.

## Checks

```bash
npm test
```

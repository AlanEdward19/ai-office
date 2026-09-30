# Escritório de IA

A local isometric office. The floor exists only while you have the page open. There is no deployed service and no process that keeps watching Cursor after the tab closes.

## Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://127.0.0.1:3847](http://127.0.0.1:3847).

Put real keys in `.env.local` only. That file is gitignored. Do not commit keys.

## Environment

| Variable | Required for | Notes |
| --- | --- | --- |
| `LINEAR_API_KEY` | One room per Linear project | Personal API key. The app sends it in the `Authorization` header with no `Bearer` prefix. |
| `CURSOR_API_KEY` | Cloud agent status, and starting one when a card is dropped on a Cursor desk | User API key from the Cursor dashboard. Used to list cloud agents, read a run stream, and `POST /v1/agents` while the page is open. |

The lobby, reception, and CEO corner render without either key. Rooms appear after `LINEAR_API_KEY` is set and you reload. A new Linear project shows up as another room on refresh. The room identity is the project id. The name is only the label on the door.

## Companies on the job form

The ficha de vaga asks for a role and a company. The company list is whoever already has a login on this machine. A provider that is not authenticated is omitted. Grok is not offered.

- **Cursor** — `CURSOR_API_KEY`, a Cursor CLI login at `~/.config/cursor/auth.json`, or a Cursor IDE session.
- **Anthropic (Claude)** — `claude auth status`, `~/.claude/.credentials.json` (or `CLAUDE_CONFIG_DIR`), or `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN`.
- **OpenAI (Codex)** — `codex login status`, `~/.codex/auth.json` (or `CODEX_HOME`), or `OPENAI_API_KEY`.

Those checks stay on the server. The page receives company names, not session secrets. Saving the form seats an agent at a desk, and that desk keeps the same form.

## Board and desk

Open a room to read that Linear project's issues. The request runs while the page is open and stops when you leave. The board never lists another project's issues.

Writing a card creates a Linear issue in that room's project. The same issue opens in Linear.

Drop the card on a desk that already has a ficha de vaga. The company on that form has to be logged in on this machine. A desk without a form does not take a card.

Cursor is the only company that can start work: the drop calls the Cursor cloud agents API and the existing observer moves that desk's avatar to working, then to done when the run finishes. Anthropic and OpenAI stay on the form, but the drop is refused until a dispatch for that company exists. Nothing is sent to those APIs.

The Linear issue keeps the link to that cloud agent. Closing the page stops the observer. No process keeps running.

## Cloud agent status

While the tab is open, the app follows one Cursor cloud agent: `ACTIVE` or `RUNNING` shows as working, and `FINISHED` shows as done. The scene only reads that internal event. Closing the tab aborts the stream. Nothing is left polling.

## Checks

```bash
npm test
```

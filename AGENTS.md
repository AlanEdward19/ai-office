<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md

> Índice/roteador para agentes. Regras em `rules/` (sob demanda). `docs/` é para humanos — referencie, não copie. Ative skills **pelo nome**.

## BOUNDARIES (prioridade máxima)

**SEMPRE FAÇA**
- Progressive loading: carregue só o que o pedido exige (Quick reference).
- Docs/rules/spec: ideal 30–70 linhas, teto 100; acima disso → quebre em arquivos + índice.
- Comandos repetíveis → `scripts/` (ex.: `scripts/verify.sh`), não monte na mão.
- Antes de "pronto", rode `scripts/verify.sh` (0 = OK).
- Leia a `rules/*.md` da tarefa antes de codar.

**PERGUNTE QUANDO**
- Commit (padrão: não commitar sem aprovação).
- Apagar spec/design/doc; mudar contrato público ou hooks em `~/.cursor` / `~/.claude`.
- Dependência nova ou decisão de arquitetura → ADR em `docs/adr/`.

**NUNCA FAÇA**
- Ler repo/docs/rules inteiros "por garantia".
- Commitar segredos (`.env.local`, chaves) ou editar código gerado do Next.
- Vazar tool args/transcripts nos eventos compartilhados (ver `docs/architecture.md`).

## Projeto
- **Escritório de IA**: escritório 3D local; existe só com a aba aberta (`127.0.0.1:3847`). Sem deploy persistente.
- **Stack**: TypeScript · Next.js 16 · React 19 · R3F · npm.
- **Camadas**: `src/domain` (regras + testes) · `src/server` (`server-only`, I/O) · `src/app/api` · `src/components`.

## PM tool / board
- Tool: **Linear** (API key em `.env.local`). Tags/org: confirmar com o time via `pm-handoff` se necessário.

## Comandos → scripts
| Preciso… | Rode |
|---|---|
| Testar | `scripts/test.sh` |
| Lint | `scripts/lint.sh` |
| Build | `scripts/build.sh` |
| Gate final | `scripts/verify.sh` |

## Quick reference
| Tarefa | Carregue | Skill |
|---|---|---|
| Nova feature / fluxo | `rules/implementation.md` | `agentic-delivery` → `tlc-discover` / `tlc-spec-lean` / `tlc-spec-driven` (Princípio 9) |
| Testes | `rules/tests.md` | `harness-engineering` |
| Persistência futura | `rules/database-entities.md` | — |
| Autônomo até gates | — | `loop-engineering` (se necessário) |
| Roteamento | — | `agentic-delivery` |
| Cards no Linear | seção PM acima | `pm-handoff` |
| API de lib | **context7 MCP** | — |

Pré-flight TLC: se faltar skill, `npx @tech-leads-club/agent-skills install --skill <nome>`. Doc humana: `docs/README.md`.

## Harness
- `HARNESS.md` · gates 0/1 = `scripts/verify.sh` · continuidade = `STATE.md`.
- Aprofundar sensores/guias: skill `harness-engineering`.

## Commit e limpeza
- Commit só com aprovação explícita.
- Efêmeros (`tasks.md`, logs) saem após **PR aprovado por humano**. Preserve `AGENTS.md`, `rules/`, `docs/`, `STATE.md`, `HARNESS.md`, `spec.md`, `design.md`.

## Mapa
| Caminho | Papel |
|---|---|
| `rules/*.md` | Regras testáveis (IA) |
| `scripts/*` | Comandos executáveis (IA) |
| `docs/**` | Contexto (humano) |
| `spec.md` / `design.md` | Spec de feature |

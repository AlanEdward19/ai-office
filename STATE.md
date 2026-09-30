# STATE.md

Fonte única de handoff entre skills (`agentic-delivery`, harness, spec, loop).

## Decisões (AD)
| ID | Resumo |
|---|---|
| AD-001 | Bootstrap agente: `AGENTS.md`, `rules/`, `scripts/`, `docs/`, `HARNESS.md` (2026-09-30) |
| AD-002 | Spec routing: `tlc-discover` / `tlc-spec-lean` / `tlc-spec-driven` via Princípio 9 em `agentic-delivery` |

## Handoff
- **Última fase concluída**: project-bootstrap (via agentic-delivery)
- **Artefatos**: `AGENTS.md`, `rules/*`, `scripts/*`, `docs/**`, `HARNESS.md`, `docs/adr/ADR-0001-domain-session-model.md`
- **Eval gates disponíveis**: `scripts/verify.sh`
- **Próximo passo sugerido**: skill `harness-engineering` se quiser sensores/guias além do verify; features novas → `agentic-delivery` → spec (Lean/Driven)

## PM tool
Linear (API key local). Org/tags: confirmar com `pm-handoff` quando for criar cards.

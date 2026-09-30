# HARNESS.md

Harness leve gerado no bootstrap. Sensores = scripts; guias = `AGENTS.md` + `rules/`. Para inventário completo e steering, rode a skill **`harness-engineering`**.

## Eval gates (0/1)
| Gate | Comando | O que valida |
|---|---|---|
| verify | `scripts/verify.sh` | build + eslint + testes de domínio |

## Setup rápido
```bash
npm install
cp .env.example .env.local   # chaves opcionais para Linear/Cursor
```

## Memória
- `STATE.md` — handoff entre fases (`agentic-delivery`, spec, loop).
- `ROADMAP.md` — criar quando houver roadmap explícito.

## Steering log
| Data | Gate falhou | Ação |
|---|---|---|
| — | — | (preencher após falhas recorrentes) |

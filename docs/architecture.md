# Arquitetura (resumo)

## Camadas
```txt
src/domain     Regras de negócio + testes (sem Next)
src/server     I/O: Linear, Cursor, hooks, spool local, canais in-memory
src/app/api    Route Handlers; SSE/abort ligados ao ciclo de vida da aba
src/components Office 3D (R3F), stores de UI, formulários
```

## Estado e sessão
- **Não há DB app**: rooms/desks/canal colega ficam na memória do processo `next dev`.
- Fechar a última aba derruba observers, bridge de hooks (marca própria) e snapshot compartilhado.

## Privacidade (invariantes)
- Eventos compartilhados: provider, origin, owner, machineId, projectId, status, timestamp — **sem** transcript, argumentos de tool, paths ou segredos.
- Hooks append-only de status; não gravar conteúdo de ferramentas.
- API keys só server-side (`process.env`); cliente recebe subset de providers autenticados.

## Testes
Comportamento especificado em testes de domínio (`src/domain/*.test.ts`). Gate: `scripts/verify.sh`.

## ADRs
Decisões duráveis em `docs/adr/`. Comece por `ADR-0001-domain-session-model.md`.

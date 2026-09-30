# rules/implementation.md — nova feature / fluxo / refactor

## Regras
- Unidades pequenas; sem one-shot hero. Estilo = ESLint (`scripts/lint.sh`), não invente convenção.
- **Domínio primeiro**: comportamento verificável em `src/domain/*.ts`; testes colados (`*.test.ts` ou `phaseN.test.ts`).
- **Bordas**: rotas em `src/app/api/**` validam entrada, chamam `src/server/**` ou domain; não duplique regras de negócio na UI.
- **`server-only`** em módulos que tocam filesystem, hooks locais, Linear/Cursor/Codex.
- Segredos só em env server-side; respostas ao cliente trazem nomes/status, nunca tokens ou paths sensíveis.
- Sem TODO/dead code na entrega; `scripts/verify.sh` = 0.
- Dependência nova ou decisão estrutural → ADR em `docs/adr/`.

## Camadas (este repo)
```txt
domain  → regras puras, tipos, mapeamentos (testáveis sem Next)
server  → clientes HTTP, bridge de hooks, canais in-memory da sessão dev
app/api → HTTP fino; abort quando a aba fecha (streams/SSE)
components → R3F + UI; stores locais de cena, não regra de dispatch/Linear
```

## Next.js
Leia `node_modules/next/dist/docs/` antes de mudar App Router, Route Handlers ou convenções — esta versão diverge do Next clássico.

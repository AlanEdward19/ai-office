# rules/tests.md — escrever/ajustar testes

O agente **não se autoavalia**; gate = `scripts/verify.sh`.

## Regras
- Comportamento novo/alterado → teste em `src/domain` antes de concluir.
- Runner: Node `node:test` via `tsx` (`npm test` / `scripts/test.sh`).
- Preferir testes de domínio (sem rede real); mock/fake para Linear/Cursor quando necessário.
- Nomeie por comportamento (frase no `test('...')` ou arquivo `phaseN.test.ts` alinhado ao README).
- Bugfix → regressão que falha sem o fix.
- Não monte `tsx --test ...` na mão; use `scripts/test.sh`.

## Onde testar
| Área | Onde |
|---|---|
| Dispatch, board, walker, share, call | `src/domain/*.test.ts` |
| Integração Next/UI pesada | só se pedido; default = domain |

## Exemplo
```txt
test('a drop uses the ficha and only Cursor can be dispatched'):
  arrange desk + card → act drop → assert refused for non-Cursor
```

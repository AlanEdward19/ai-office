# scripts/

Comandos repetíveis para agentes. Preferir estes em vez de remontar `npm` na mão.

| Script | Equivalente |
|---|---|
| `build.sh` | `npm run build` |
| `lint.sh` | `npm run lint` |
| `test.sh` | `npm test` |
| `verify.sh` | build + lint + test |

Gate final antes de concluir tarefa: `./scripts/verify.sh`.

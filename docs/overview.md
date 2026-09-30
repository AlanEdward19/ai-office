# Escritório de IA — visão geral

Escritório 3D em primeira pessoa, rodando **localmente** enquanto a página está aberta. Não há serviço deployado nem observação contínua após fechar a aba.

## Rodar
`npm install` · copiar `.env.example` → `.env.local` · `npm run dev` · [http://127.0.0.1:3847](http://127.0.0.1:3847).

## Integrações
| Integração | Env / login local | Uso |
|---|---|---|
| Linear | `LINEAR_API_KEY` | Projetos, board, criar issue |
| Cursor cloud | `CURSOR_API_KEY` | Status e dispatch de agent |
| Claude / Codex | CLI/credenciais na máquina | Ficha de vaga, wing local |
| Claude cloud status | `ANTHROPIC_API_KEY` só no servidor | `running`, `idle` ou `terminated` enquanto a página do host está aberta |

Lobby e CEO funcionam sem chaves. HR (elevador) usa a mesma ficha de vaga.

## Comportamento-chave
- Sala = projeto Linear (id estável; nome só na porta).
- Drop no desk: Cursor dispara cloud agent; Claude abre sessão na nuvem com `claude --cloud`. Enquanto a página do host está aberta, a mesa mostra `running`, `idle` ou `terminated` de `GET /v1/sessions`. Sem `ANTHROPIC_API_KEY`, a mesa mostra a falha, não um ocioso inventado. OpenAI segue recusado.
- Colega "só olhar": vê status, não publica nem contrata.
- WebRTC entre abas; sinal só com peers conectados.

Detalhe operacional completo: `README.md` na raiz.

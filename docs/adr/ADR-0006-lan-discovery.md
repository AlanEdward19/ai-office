# ADR-0006: Escritórios na mesma rede se encontram

- **Status**: aceito
- **Data**: 2026-10-02
- **Decisores**: time Escritório de IA
- **Complementa**: ADR-0005

## Contexto
Quem abre o escritório no próprio computador não quer receber um endereço `http://<ip>:3847`. Os dois lados já rodam o projeto. A página no `http://` da rede local também não consegue ligar microfone nem câmera.

## Decisão
Enquanto uma página está aberta, o processo anuncia um beacon UDP em `239.255.84.47:47847` com TTL 1. Só um IPv4 privado entra. O outro processo, na mesma rede, troca pessoas, sinal da ligação e o relatório local que ele mesmo observou. Não há sala na nuvem e não há processo novo: o anúncio para quando a última página daquela máquina fecha.

A ligação direta usa o canal `office` entre páginas presentes. A reunião por área e a conversa privada continuam iguais. O áudio pede cancelamento de eco, um canal, e Opus mono. Cada máquina observa Cursor, Claude Code e Codex no próprio processo e só desenha o que esse relatório trouxe.

## Alternativas consideradas
- **Entregar o IP na entrada** — rejeitado: é o endereço que a pessoa não quer passar, e o navegador bloqueia o microfone fora de localhost.
- **Um backend ou uma sala hospedada** — rejeitado: o escritório morre com a última página.

## Consequências
- **Positivas**: cada pessoa abre localhost; o chão, a caminhada e a ligação se encontram na rede local.
- **Negativas**: soltar um card continua na máquina que recebeu a ação. Não inicia a sessão local do outro computador.
- **Follow-ups**: nenhum serviço fora da rede.

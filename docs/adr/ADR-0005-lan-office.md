# ADR-0005: Escritório compartilhado na rede local

- **Status**: aceito
- **Data**: 2026-10-02
- **Decisores**: time Escritório de IA

## Contexto
Duas pessoas na mesma rede precisam ver o mesmo escritório, cada uma no próprio computador. O processo continua sendo um `next dev` que morre com a última aba. Os agentes locais de cada máquina só existem se essa máquina os observar.

## Decisão
O servidor escuta em `0.0.0.0:3847`. O estado segue in-memory (ADR-0001). Quem entra escolhe `interact` ou `observer`. O host continua sendo a máquina que publica as próprias sessões e o status de nuvem que ela consegue ler.

Cada máquina envia um relatório local (provider, origem, dono, machine id, status). O chão junta esses relatórios por `machineId` e não apaga o de outra máquina quando o host republica. Um agente local só fica trabalhando se o relatório dessa máquina disser isso. Nuvem continua com `machineId` nulo.

No outro computador, `npm run local` observa Cursor, Claude Code e Codex com os mesmos leitores e entrega o status à página. O processo encerra quando a página para de bater. Ele não sobe na máquina que já roda o escritório.

## Alternativas consideradas
- **Inventar presença da segunda máquina no processo do host** — rejeitado: esse processo não vê o Cursor dela.
- **Backend deployado ou sala na nuvem** — rejeitado: contradiz o ciclo de vida da aba.

## Consequências
- **Positivas**: o mesmo Wi-Fi basta para entrar; cada máquina aparece com o status que ela mesma enviou.
- **Negativas**: sem `npm run local`, a segunda máquina não tem agentes locais. Soltar um card não inicia a sessão local do outro computador; inicia nuvem nesta máquina.
- **Follow-ups**: nenhum serviço novo. Um comando para a sessão local do outro PC exigiria um executor lá, que este ADR não adiciona.

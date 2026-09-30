# ADR-0001: Modelo de domínio + sessão in-memory

- **Status**: aceito
- **Data**: 2026-09-30
- **Decisores**: time Escritório de IA

## Contexto
O produto é um escritório local que só existe com a aba aberta. Precisamos de regras testáveis (Linear, dispatch, presença local/cloud) sem operar um backend deployado.

## Decisão
Centralizar regras em `src/domain` com testes Node; I/O fica em `src/server` (`server-only`). Estado volátil (salas abertas, canal colega, observers) permanece **in-memory** no dev server, amarrado ao ciclo de vida das conexões HTTP/SSE.

## Alternativas consideradas
- **Persistir salas/desks em DB** — rejeitado: contradiz "sem serviço persistente" e complica privacidade.
- **Regras na UI R3F** — rejeitado: difícil testar e duplica lógica de board/dispatch.

## Consequências
- **Positivas**: testes rápidos, README alinhado ao runtime real, fronteira clara para integrações.
- **Negativas**: reload do server zera estado; múltiplas instâncias dev não compartilham memória.
- **Follow-ups**: se houver deploy futuro, novo ADR para storage e auth.

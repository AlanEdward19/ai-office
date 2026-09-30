# Escritório social checks
Profile: light
## Checks
**C1** - Prévia e cena usam Avatar (AC 1).
Proof: inspeção Avatar em preview e player; scripts/verify.sh --webpack.
**C2** - 6 penteados, 4 roupas e 4 acessórios têm controle e render (AC 2).
Proof: inspeção das enumerações e ramos de Avatar; scripts/verify.sh --webpack.
**C3** - Vista elevada e próxima existem e câmera interpola (AC 3).
Proof: inspeção dock e useFrame; scripts/verify.sh --webpack.
**C4** - Gesto acaba aos 3 segundos (AC 4).
Proof: scripts/test.sh, teste "social gestures expire after three seconds".
**C5** - Amplitude da caminhada se aproxima suavemente do alvo (AC 5).
Proof: scripts/test.sh, teste "animation blend is bounded and frame-rate independent".
**C6** - Colisão e input bloqueado preservados (AC 6).
Proof: scripts/test.sh; inspeção scene e walking.
## Coverage
| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| câmera (2) | elevada C3 · próxima C3 | - |
| gesto (2) | acenar C4 · dançar C4 | - |
## Swept
- validation: C4, C5
- failure modes: existing - colisão walker com substeps
- idempotency: n/a - estado local
- authorization: existing - session para interações
- concurrency: n/a - estado de UI local
- data lifecycle: n/a - duração da aba
- dependency failure: n/a - sem serviço novo
- state transitions: C4, C5
- observability: existing - pose em data-testid
## Handoff
Aproximadamente 20k tokens, abaixo de 150k. Autor principal avatar/UX; especialista visual cena conforme agentic-delivery. Sem commits conforme AGENTS. Profile light; UI por inspeção e browser, sem suite de browser.

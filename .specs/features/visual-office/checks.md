# Personagem e movimento - checks
Profile: light
Plan: `.specs/features/visual-office/plan.md`

## Checks
**C1** - A seleção de roupa, pele e cabelo atualiza o personagem (AC 1).
Proof: inspeção de CharacterCreator → appearance → OfficePlayer; `scripts/verify.sh` confirma tipos e build.
**C2** - O corpo mantém 0.24 unidades do sólido mesmo com dt=1 (AC 2).
Proof: `scripts/test.sh`, teste "solid obstacles stop walking without tunneling".
**C3** - O corpo desliza no eixo livre (AC 3).
Proof: `scripts/test.sh`, teste "walking slides along a solid edge".
**C4** - Destino bloqueado é cancelado (AC 4).
Proof: `scripts/test.sh`, teste "blocked click target is cancelled".
**C5** - Deslocamento real anima os membros e repouso respira (AC 5).
Proof: `scripts/test.sh`, teste "gait stops limbs at rest and alternates them while moving"; inspeção do consumo em OfficePlayer.
**C6** - Criador aberto bloqueia movimento e E (AC 6).
Proof: inspeção de walking e interact em OfficeApp; `scripts/verify.sh` confirma tipos e build.

## Coverage
| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| aparência (3) | roupa C1 · pele C1 · cabelo C1 | - |
| movimento (3) | bloqueio C2 · deslizamento C3 · clique C4 | - |

## Swept
- validation: C2
- failure modes: C4
- idempotency: n/a - atribuição de estado local
- authorization: existing - interações exigem session em OfficeApp
- concurrency: n/a - atualização local síncrona
- data lifecycle: n/a - estado termina com a aba
- dependency failure: n/a - sem dependência externa nova
- state transitions: C5, C6
- observability: existing - pose em data-testid no OfficeApp

## Handoff
Uma fatia, aproximadamente 40 KB / 4 = 10k tokens, abaixo de 150k; um builder.
Sem commit: AGENTS.md exige aprovação específica. Verifier inspeciona diff local.
Limitação: C1 e C6 são inspeção de UI, sem teste automatizado de browser.

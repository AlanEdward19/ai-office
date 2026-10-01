# Correções de interação checks

Profile: ui
Plan: `.specs/features/office-interactions/plan.md`

6 checks · 0 new one-way doors · visual proofs open

## Checks

**C1** - Área conserva cena visível: shader sem identificadores GLSL reservados, quad sem clipping/depth (AC1).
Proof: `scripts/test.sh` — named test `office interactions focus shader` in `src/domain/office-interactions.test.ts`; GPU-free material/quad contract, rendered proof unproven.

**C2** - Cadeiras orientam ocupante à mesa (AC2).
Proof: `scripts/test.sh` — named test `office interactions chair orientation` in `src/domain/office-interactions.test.ts`, actual Three direction transform.

**C3** - Usuário clica cadeira próxima para sentar; movimento/Espaço/andar/correção levantam, trancas e objetos externos conservam bloqueio (AC3).
Proof: `scripts/test.sh` — named tests `office interactions user seating` and `office interactions agent inspection` in `src/domain/office-interactions.test.ts`; domain admission/roster plus production cancellation source wiring.

**C4** - Agentes trabalham sentados, digitam, tomam café sentados e gesticulam conversando, sem dividir assento (AC4).
Proof: `scripts/test.sh` — named tests `office interactions agent poses` and `office interactions coffee seat reservations` in `src/domain/office-interactions.test.ts`; actual presentation functions/Three joints and engine reservation. Additional proof: `scripts/test.sh` — named test `office interactions coffee reaches every real chair approach` in `src/domain/elevator-layout.test.ts`, all four seats reached against production meshes. Existing actual mesh hiring/travel regression retained.

Additional proof C4: `scripts/test.sh` — named tests `office interactions human seating reserves all coffee seats and releases them`, `office interactions own desk waits for human then resumes real activity`, and `office interactions colleague seating is sanitized to ground humans and immediate local pose` in `src/domain/office-interactions.test.ts`. Human occupation overrides old agent reservations and remote presentation; provider status is unchanged.

**C5** - Clique agente abre perfil/histórico local sem obrigar conversa (AC5).
Proof: `scripts/test.sh` — named test `office interactions agent inspection` in `src/domain/office-interactions.test.ts`, source wiring proof; rendered interaction unproven.

**C6** - Dados históricos reais/origem/autorização continuam preservados e gates antigos passam (AC6).
Proof: `scripts/verify.sh --webpack` — existing history and HTTP authorization assertions, all old assertions retained except reserved shader identifier renamed without changing expression semantics.

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| seat admission (4) | close C3 · far C3 · occupied C3 · blocked C3 | - |
| actor activities (4) | typing C4 · sleep C4 · coffee C4 · talking C4 | - |
| coffee seats (4) | 0 C4 · 1 C4 · 2 C4 · 3 C4 | - |
| inspection (2) | click C5 · nearby local C5 | - |
| focus (2) | reserved identifier C1 · fullscreen quad C1 | - |

Rendered appearance/occupancy/interaction remain unproven; table members above describe computational contracts only.

## Test policy
Tests use production functions, Three objects, real engine, native existing filesystem proof and source wiring when browser unavailable. No screenshot/GPU proof is claimed. All existing mesh/history/auth assertions remain in the full gate.

## Swept
- validation: C1, C3
- failure modes: C1, C3
- idempotency: C4 reservations
- authorization: C3, C6
- concurrency: C4 four reservations, no shared seat
- data lifecycle: C3 standing/seated/standing; C6 unchanged private history
- dependency failure: C1 shader identifier correction; C6 history I/O failures retained
- state transitions: C3, C4
- observability: C5 history/profile access; rendered visual remains pending
- relations: chair/player C3 · agent/desk C4 · agent/history C5
- UI: C1–C5 rendered proof pending due browser policy block

## Handoff
User explicitly authorized fixes. Source diagnosis: GLSL reserved uniform active prevented valid focus shader, leaving canvas clear background. World routes approach behind existing desk chair; sitting shifts pose only next to chair. No commits/dependencies.

Final computational gate: `scripts/verify.sh --webpack` exit0, build/TS/lint/119 tests. Structural validator0errors/6selectorwarnings; no test script arguments supported, named assertions given explicitly. User sitting is a local pose adjustment <=0.7m beside an accessible chair; no wall/desk crossing permitted. Rendered/GPU acceptance remains pending.

Occupancy correction gate: scripts/verify.sh --webpack exit0, build/TS/lint/122 tests. Rendered/visual proof remains pending.

# Office interactions verification

**Verdict**: FAIL
**Profile**: ui
**Diff range**: 48c8f5571d458bb0b8b18a7794477a2a42ad4e5e..working tree (feature uncommitted; reviewed interaction files, previous features retained)
**Round**: 1 - full (final occupancy freeze; earlier preflight found human/agent overlap, fixed before this gate)
**Verifier**: independent sub-agent (author != verifier)

Fingerprint SHA256 of focus/seating/routines/character/interaction-test concatenation: `73fa199bbeb07d0a36cd51b0f480250636e8ad79c50944871c5b0c152d1691f9`.

## Binding sources

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| User message 2026-10-01 + plan AC1–AC6 | yes, full text supplied and plan read | - | Rendered scene visibility, chairs/occupants facing tables, actual seat click/cancellation, coffee/typing/conversation appearance, local profile click/proximity |
| Screen sharing request | yes, supplied text | - | None within implementation scope: separate proposed plan only, no implementation claimed |

No visual mock/composition was supplied. User requires existing 3D office to remain visible, interactive seats and local history; tests cannot replace those actual outcomes.

## Checks

Each named proof appeared individually passed in `/tmp/office-interactions-independent-gate.log:125`–`:133`; physical four-chair proof at `:86`; existing history proofs at `:91`–`:101`, `:120`.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | Area scene remains visible | focus shader; full gate exit 0 | `src/domain/office-interactions.test.ts:12` — `assert.doesNotMatch(...,/uniform...active/)`, `assert.equal(...depthTest,false)`, `assert.equal(...frustumCulled,false)`; GLSL source/material contract passes; actual GPU compile/frame unproven | FAIL |
| C2 | Chair/occupant face table | chair orientation; full gate exit 0 | `src/domain/office-interactions.test.ts:15` — `assert.ok(front.distanceTo(expected)<1e-8)` all four rotations; production uses chairRotation at `src/components/office/office-scene.tsx:511`; actual placement/appearance unproven | FAIL |
| C3 | User sits, stands and preserves barriers/presence | user seating + inspection; full gate exit 0 | `src/domain/office-interactions.test.ts:20`–`:25` — seated true, far/occupied/wall null, invalid seated rejected; `:41` regex covers correction/movement/Space wiring only; actual click/floor/correction transitions are not executed | FAIL |
| C4 | Agent activities and exclusive seats | poses/reservations/human occupancy/real-chair approach; full gate exit 0 | `src/domain/office-interactions.test.ts:30` — typing arm changes, seated leg 1.35, talking arm z>.1; `:48` no human-occupied coffee allocation; `:50` reservation changes; `:54`–`:55` own desk waits/resumes without changing real provider status; `src/domain/elevator-layout.test.ts:136` all four real mesh approaches. Actual animation appearance unproven | FAIL |
| C5 | Click/proximity opens local history | agent inspection; full gate exit 0 | `src/domain/office-interactions.test.ts:39` — `assert.match(source,/onAgent=...setSelectedTab...history/)` and local history selection; explicit approach preserved at `:40`. This is source wiring, no rendered click/history request proof | FAIL |
| C6 | Real history/origin/auth and earlier assertions retained | full gate exit 0 | `src/domain/living-office.test.ts:25` unknown provider fields retained; `:35` HTTP401/403 and secret removal; `:141` native filesystem proof; `:164` original focus DPR assertion retained with reserved identifier rename only | PASS |

## Coverage

Recomputed from user criteria and production sources, not copied from checks table.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| Seat admission (4) | `src/domain/seating.ts:14` | close/far/occupied/blocked -> C3 :20–:22 | - |
| Stand triggers (4) | `src/components/office/player.tsx:102`, floor effect, useFrame | movement/Space/correction -> source regex C3; floor source read | Executed input/event/floor/correction transitions |
| Activity (4) | `src/domain/character.ts:28`, `src/domain/seating.ts:26` | typing/talking joints C4; sleep seated C4; coffee pose + cup source C4/C5 | Coffee arm/cup animation and sleep appearance not executed/rendered |
| Coffee seats (4) | `src/domain/seating.ts:8`, routines reservations | 0/1/2/3 -> C4 mesh test :136; human exclusivity :48–:50 | - |
| Human occupancy (3) | `src/domain/seating.ts:24` | peer ground/local immediate/other floor excluded -> `office-interactions.test.ts:59` | - |
| Inspection (2) | `src/components/office/office-app.tsx:675`, local interaction branch | click/nearby local -> C5 source regex | Executed rendered profile/history navigation |
| Focus contract (2) | `src/components/office/area-focus.tsx:26`–`:27` | reserved identifier/fullscreen quad -> C1 | GPU compilation, visible inside/outside frame |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Production functions/Three/engine/native existing FS | seating/character/routines/focus/history | actual production objects/functions and retained native FS | yes, computational contracts |
| Source wiring when browser unavailable, no GPU claim | player/app/avatar/scene | regex/source read plus explicit limitation | yes as declared source proof; does not prove C1–C5 actual user flow |
| Existing mesh/history/auth assertions retained | elevator-layout/living-office suites | complete current gate | yes, all named previous proofs ran; no weakened assertion observed |

## Faults injected

Disposable copies of src/scripts/config with node_modules symlink, no secrets/git copied; `scripts/test.sh` per copy (runner has no filter). Real porcelain and source SHA256 verified unchanged. Earlier sandbox EPERM attempts are invalid and excluded.

| Mutation | Location | Killed |
| --- | --- | --- |
| maskEnabled uniform -> reserved active | area-focus.tsx:8 | yes — focus shader assertion, `/tmp/office-fault-final-0.log:80` |
| chairRotation removes half-turn | seating.ts:12 | yes — chair orientation assertion, `/tmp/office-fault-final-1.log:81` |
| Remove occupied admission guard | seating.ts:14 | yes — user seating assertion, `/tmp/office-fault-final-2.log:82` |
| Allocate coffee despite human occupying chair | agent-routines.ts:78 | yes — human seating reservation assertion, `/tmp/office-fault-final-3.log:86` |
| Remove typing arm branch | character.ts:33 | yes — agent poses assertion, `/tmp/office-fault-final-4.log:83` |

## Gate

`scripts/verify.sh --webpack` independently exit 0: 122 passed, 0 failed; build, TypeScript, lint OK. Log `/tmp/office-interactions-independent-gate.log`.
Browser inspection remains explicitly policy blocked: no CUA, alternate browser, headless or raw CDP used. This is not a visual PASS. No concrete computational defect remains after occupancy fix; overall FAIL records missing executed/UI/GPU evidence rather than alleging the visual bug persists.

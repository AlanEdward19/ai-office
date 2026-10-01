# Escritório vivo checks

Profile: ui
Plan: `.specs/features/living-office/plan.md`

23 checks in 4 slices · 2 one-way doors · 0 open

## Checks

### S1

**C1** - All furnished areas and corridor exclusions share canonical bounds (AC 1).
Proof: `scripts/test.sh` — named test `living office C1` in `src/domain/living-office.test.ts`.

**C2** - Crossing every free area selects its meeting (AC 2).
Proof: `scripts/test.sh` — named test `living office C2` in `src/domain/living-office.test.ts`.

**C3** - Area focus keeps interior clear and blurs/dims outside (AC 3).
Proof: `scripts/test.sh` — named test `living office C3` in `src/domain/living-office.test.ts`.
Additional proof: `scripts/test.sh` — named test `living office C3 render target preserves physical DPR pixels and CSS blur radius` in `src/domain/living-office.test.ts`, exercising the production resolution updater with actual Three target/depth texture at DPR1/1.5/2 and resize. Rendered visual proof remains pending.

**C4** - Focus changes with area and disappears in corridors (AC 4).
Proof: `scripts/test.sh` — named test `living office C4` in `src/domain/living-office.test.ts`.

**C5** - Entrance links all destinations through 1.2m corridors (AC 5).
Proof: `scripts/test.sh` — named test `living office C5` in `src/domain/living-office.test.ts`.
Additional proof: `scripts/test.sh` — `living office C5 actual 1.2 m routes and all eighteen posts` in `src/domain/elevator-layout.test.ts`.

**C6** - Capacity rejects overlapping rooms and desks (AC 6).
Proof: `scripts/test.sh` — named test `living office C6` in `src/domain/living-office.test.ts`.

**C7** - All three cameras share collision and access (AC 7).
Proof: `scripts/test.sh` — named test `living office C7` in `src/domain/elevator-layout.test.ts`.

### S2

**C8** - Real provider executions import and deduplicate with unknown fields (AC 8).
Proof: `scripts/test.sh` — named test `living office C8` in `src/domain/living-office.test.ts`.

**C9** - History is descending, paginated and reports loading/empty/error/unavailable (AC 9).
Proof: `scripts/test.sh` — named test `living office C9` in `src/domain/living-office.test.ts`.

**C10** - Missing provider history is explicitly unavailable (AC 10).
Proof: `scripts/test.sh` — named test `living office C10` in `src/domain/living-office.test.ts`.

**C11** - Host-only history and sanitized shared data (AC 11).
Proof: `scripts/test.sh` — named test `living office C11` in `src/domain/living-office.test.ts`.

**C12** - Restart preserves history; corrupt file is recoverable (AC 12).
Proof: `scripts/test.sh` — named test `living office C12` in `src/domain/living-office.test.ts`.

**C13** - History caps 500/30days/12000 chars with atomic writes (AC 13).
Proof: `scripts/test.sh` — named test `living office C13` in `src/domain/living-office.test.ts`.
Additional proof: `scripts/test.sh` — named test `living office C13 native atomic history filesystem preserves failed writes and corruption` in `src/domain/living-office.test.ts`.

### S3

**C14** - Idle agents alternate coffee/sleep without fake work (AC 14).
Proof: `scripts/test.sh` — named test `living office C14` in `src/domain/living-office.test.ts`.

**C15** - Default five-minute idle packs at desk then exits (AC 15).
Proof: `scripts/test.sh` — named test `living office C15` in `src/domain/living-office.test.ts`.

**C16** - Real work interrupts departure and returns to desk (AC 16).
Proof: `scripts/test.sh` — named test `living office C16` in `src/domain/living-office.test.ts`.

**C17** - HR assembles a desk before new agent enters (AC 17).
Proof: `scripts/test.sh` — named test `living office C17` in `src/domain/living-office.test.ts`.
Additional proof: `scripts/test.sh` — `living office actual meshes hiring travel coffee departure and moving interlocutor` in `src/domain/elevator-layout.test.ts`.

**C18** - Duplicate/failed/full hires preserve capacity (AC 18).
Proof: `scripts/test.sh` — named test `living office C18` in `src/domain/living-office.test.ts`.
Additional proof: `scripts/test.sh` — named test `living office C18 production hire admission preserves failed full and duplicate transactions` in `src/domain/living-office.test.ts`.

**C19** - Finite collision-aware motion honors reduced motion (AC 19).
Proof: `scripts/test.sh` — named test `living office C19` in `src/domain/living-office.test.ts`.
Additional proof: `scripts/test.sh` — named test `living office C19 actual reduced presentation has no gait bob or interpolated assembly` in `src/domain/living-office.test.ts`.
Additional proof: `scripts/test.sh` — `living office actual meshes hiring travel coffee departure and moving interlocutor` in `src/domain/elevator-layout.test.ts`.

### S4

**C20** - Approach opens private chat only within 1.5m (AC 20).
Proof: `scripts/test.sh` — named test `living office C20` in `src/domain/living-office.test.ts`.
Additional proof: `scripts/test.sh` — `living office actual meshes hiring travel coffee departure and moving interlocutor` in `src/domain/elevator-layout.test.ts`; regressions `living office C20 routes through a doorway before arrival across a nearby wall` and `living office C22 closed wall gives blocked feedback instead of conversation or endless approach` in `src/domain/living-office.test.ts`.

**C21** - Explicit agent meetings approach before visual conversation (AC 21).
Proof: `scripts/test.sh` — named test `living office C21` in `src/domain/living-office.test.ts`.

**C22** - Moving/cancelled/missing/blocked targets recalculate or cancel (AC 22).
Proof: `scripts/test.sh` — named test `living office C22` in `src/domain/living-office.test.ts`.
Additional proof: `scripts/test.sh` — named test `living office C22 explicit cancellation and disappearing recipient prevent arrival` in `src/domain/living-office.test.ts`.

**C23** - Approaches honor locked areas and host privacy (AC 23).
Proof: `scripts/test.sh` — named test `living office C23` in `src/domain/living-office.test.ts`.

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| GET /api/agents/history statuses (5) | `200` C9 · `400` C9 · `401` C11 · `403` C11 · `503` C12 | - |
| GET/POST /api/office/routines statuses (5) | `200` C15 · `400` C15 · `401` C23 · `403` C23 · `409` C22 | - |
| GET /api/call statuses (3) | `200` C2 · `400` C2 · `401` C2 | - |
| doors (2) | `history v1` C12 · `canonical layout` C1 | - |
| cameras (3) | `first` C7 · `third` C7 · `isometric` C7 | - |
| providers (3) | `cursor` C8 · `anthropic` C8 · `openai` C8 | - |
| relations (7) | `office` C1 · `floor` C1 · `area` C2 · `agent` C14 · `execution` C8 · `routine` C15 · `hire` C17 | - |

UI proofs additionally require browser visual review of focus, access, history, routines, hiring and arrival chat in all camera modes; tests cannot substitute screenshots.

## Test policy
Decision tables are tested at domain layer with one asserted case per transition; HTTP guards/status mapping additionally exercise boundary handlers. Visual acceptance requires screenshots and interactive observation. Existing analogue: area-meetings.test.ts and elevator-layout.test.ts test authorization and real mesh collisions.

## Swept
- validation: C6, C9, C15
- failure modes: C12, C18, C22
- idempotency: C8, C18
- authorization: C11, C23
- concurrency: C8, C18
- data lifecycle: C12, C13
- dependency failure: C10, C12
- state transitions: C14–C22
- observability: C9, C22

## Handoff
S1 30k + S2 25k + S3 25k + S4 15k = 95k, under 150k: one builder. No commits requested for this feature.

- **Boundary:** first environment/navigation implementation green at working diff (no commit), 82 tests; C1/C2/C5/C6/C7 have named domain proofs, UI and route-boundary proofs still open.
- **Settled mid-build:** user approved entire plan and defaults.
- **Abandoned:** redundant lobby walls blocked lateral room access; removed in favor of one office envelope and room partitions.

- **Boundary:** history implementation C8–13 at working diff, gate0/90 tests; actual anonymous history route401; UI visual proofs and independent filesystem review still open.
- **Settled mid-build:** unassigned historical sessions are a provider archive explicitly labelled with unknown desk association; selected Cursor cloud ID filters run records.
- **Abandoned:** importing only short log files omitted common large provider sessions; bounded head/tail reads preserve identity and honest partial summaries instead.

- **Boundary:** routine C14–23 domain/control/UI implementation at working diff, gate0/100 tests. Actual-mesh movement/coreography proof remains required before closing feature; fixtures currently prove state/control tables only.
- **Settled mid-build:** NPC approach opens messages on arrival and never auto-sends; provider work wins over visual idle. Door crossing uses outside waypoint z7.0 past facade z6.3.
- **Abandoned:** static NPC figures inside collidable desk group prevented navigation and could not leave; moving noCollision actors now consume extracted furniture/wall obstacles instead.

- **Boundary:** final implementation working diff, gate0/103 tests. Actual R3F geometry proves six camera/floor layouts, 8 rooms, 18 posts, 1.2m corridors and physical HR/agent journeys. UI/visual profiles remain unverified because browser recovery is policy blocked.
- **Settled mid-build:** finite local capacity9 reserves observed provider slots; Café/Laboratório consume canonical coordinates north of local posts. Moving local NPC carries PC timezone; cloud unknown zones remain unknown.
- **Abandoned:** sampled segment collision missed small corners depending on frame alignment; exact expanded AABB slabs plus grid connectors retain stable physical routes.

- C3/C4 named GPU-free tests now verify the production shader source contract and canonical bounds/null pass activation. They do not replace the pending rendered UI/visual profile proof.

# Living office verification

**Verdict**: FAIL
**Profile**: ui
**Diff range**: 48c8f5571d458bb0b8b18a7794477a2a42ad4e5e..working-tree (tracked and untracked)
**Round**: 3 - scoped
**Verifier**: independent sub-agent (author != verifier)

Round 1 fully audited all 23 checks including area-meetings; Round 2 re-read its fix diff/non-PASS rows. Round 3 inspects only the C3 DPR fix diff and all remaining non-PASS UI rows, with every proof independently re-run. This is the third/final automatic verification round; remaining rendered acceptance requires external browser recovery or user review. All 23 named tests exist in the feature diff and independently ran successfully. A green named test does not establish every part of its claim. Carried Round 2: failed-storage publication fixed and C13/C18/C19/C22 computational gaps resolved. Round 3: active AreaFocus now samples physical drawing-buffer size each frame and updates render target/depth only on change, preserving physical interior pixels and CSS blur radius. Production wiring and exact Three target proof independently inspected; remaining findings are rendered UI evidence gaps. No browser attempt was made: prior IAB/CDP freeze and policy-blocked reload prevent the authorized visual proof; no alternate surface or workaround was used.

Round 1 source/scripts fingerprint: `f5b201bdc17ed55443c75194de926f658473811b787f15474137c31bfe3e0935`; Round 2 fingerprint: `a10a7ba900ff9347ba4516cced649eed876d59b928a1e9c18dfab438e55e7fd0`; Round 3 frozen fingerprint: `b829ee936c57ec36706c9785d768173c1706fa12ba14cfc470b3237489179e90`. They hash sorted per-file SHA256 maps at `/tmp/living-office-independent-faults/baseline.json`, `/tmp/living-office-independent-round2-faults/baseline.json` and `/tmp/living-office-independent-round3-faults/baseline.json`. These identify uncommitted states honestly. Unchanged binding/coverage/swept findings carry from Round 1/2 fingerprints; C3 and remaining non-PASS rows re-verified at Round 3. Every proof run below is fresh Round 3; located unchanged assertion evidence carries explicitly from Round 2.

## Binding sources

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| Approved living-office plan, captured user criteria, Surface/Relations/Landing | yes - `.specs/features/living-office/plan.md` | none | none |
| Approved inherited area-meetings plan (isolation, locks, consent, elevator) | yes - `.specs/features/area-meetings/plan.md` | none | none |

No external mock/artifact is designated binding. Source structure was inspected: scene plus DOM overlays, meeting panel, agent tabs in activity/conversation/history/cards order, history header/availability/error/loading/empty/list/pagination regions, idle configuration and cancel controls, hire form, arrival-triggered conversation with composer/progress/error. These are covered by the corresponding broad criteria but lack rendered interaction evidence; no screenshot or visual approval is inferred. Colour, blur strength, legibility, spacing, gait and choreography remain specifically unobserved.

## Checks

Every `C<n>` proof below means `scripts/verify.sh --webpack` → `scripts/test.sh`, named `living office C<n>`, independent exit 0; log `/tmp/living-office-independent-round3-gate.log`. Located expressions below were inspected, not inferred from names. Results address the whole approved claim.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | Canonical areas and corridor exclusions | C1 passed | `src/domain/living-office.test.ts:11` `assert.equal(areas.length,FURNISHED_AREAS.length+PROJECT_CAPACITY)`; :14 `assert.equal(areaAt(areas,'ground',0,-5.8),null)` | PASS |
| C2 | Free-area meeting selection | C2 passed; inherited admission and HTTP boundary passed | `src/domain/living-office.test.ts:16` each area `assert.equal(areaAt(...)?.id,area.id)`; `src/domain/area-meetings.test.ts:25` `assert.equal(s.roster().peers[0].meetingId,'area:cafe')` | PASS |
| C3 | Clear interior, blurred/dim outside | C3 shader contract; actual target DPR/resize passed | `src/domain/living-office.test.ts:96–97` mix/shader dim; :164 `assert.equal(target.width,800*dpr)`, target/depth heights/widths and CSS pixel offsets for DPR1/1.5/2; :165 unchanged size no realloc; :167 resize dimensions and count4. Actual AreaFocus consumes helper after getDrawingBufferSize. GPU output/legibility absent | FAIL |
| C4 | Focus changes/disables and preserves isolation | C4 passed; inherited lock/consent passed | `src/domain/living-office.test.ts:103` `assert.deepEqual(areaFocusBounds(area),[area.minX,area.maxX,area.minZ,area.maxZ])`; :105 `assert.equal(areaFocusBounds(areaAt(...)),null)`; rendered transitions absent | FAIL |
| C5 | Entrance and 1.2m paths to all destinations | C5 and actual 1.2m/all eighteen posts passed | `src/domain/elevator-layout.test.ts:99` `assert.ok(reachable,...)`; :102 `assert.ok(officeRoute(start,{x:agent.x,z:agent.z+1.25},...,expanded),...)`; .36 expansion plus .24 radius = .60 per side | PASS |
| C6 | Room/desk capacity with free routes | C6; local capacity and actual geometry passed | `src/domain/living-office.test.ts:22` `assert.deepEqual(bindRoom(...),{ok:false,error:'capacity'})`; :71 `assert.throws(()=>localWingSlot(9),/Capacidade/)`; :72 unique coordinates `assert.equal(...size,18)` | PASS |
| C7 | Equal access all cameras, isometric walls/no roof | C7 and six actual layouts passed | `src/domain/elevator-layout.test.ts:82` `assert.ok(destination,...)`; :83 every route `assert.ok(segmentClear(...))`; isometric roof omission source exists but no asserted rendered proof | FAIL |
| C8 | Real provider import, dedupe, unknown fields | C8; provider adapters and concurrent append passed | `src/domain/living-office.test.ts:27` all three providers `assert.equal(row.title,null)`, `assert.equal(row.endedAt,null)`, `assert.equal(mergeHistory([row],[row],now).length,1)`; :46–49 real-shaped adapter records assert identities/status/prose | PASS |
| C9 | Descending/paged history and UI states | C9 passed | `src/domain/living-office.test.ts:30` `assert.equal(sorted[0].sourceId,'24')`, `assert.equal(page.nextCursor,'20')`; :31 statuses 200/400; panel loading/empty/error/unavailable source :18–23 exists, no UI assertions/run | FAIL |
| C10 | Honest unavailable history | C10 passed | `src/domain/living-office.test.ts:33` `assert.deepEqual(page.executions,[])`, `assert.equal(page.availability.state,'unavailable')` | PASS |
| C11 | Host-only and sanitization | C11 and inherited shared event passed | `src/domain/living-office.test.ts:35` HTTP 401/403 and `assert.ok(!text.includes(secret))` for five secret/path types; `src/domain/phase5.test.ts:144` exact whitelisted event keys | PASS |
| C12 | Restart-safe store and corrupt preservation | C12 passed; actual filesystem assembly inspected | `src/domain/living-office.test.ts:38` fresh repository `assert.equal((await historyRepository(io).read())[0].id,row.id)`, corrupt append rejection, `assert.equal(disk,'corrupt')`, 503; `src/server/history-file.ts:9` native read; native proof :154 corrupt read/append rejects and exact file remains corrupt; `agent-history.ts:52` precheck | PASS |
| C13 | 500/30days/12000 and atomic writes | C13; concurrent append; native atomic filesystem passed | `src/domain/living-office.test.ts:41` retention/truncation; :151 file600/directory700; :152 `assert.equal(await readFile(file,'utf8'),'new')`, only history.json remains; :153 `assert.rejects(io.writeAtomic('failed'))` preserves previous bytes; :154 corruption preserved. Server repository uses tested historyFileIO `agent-history.ts:12` | PASS |
| C14 | Idle coffee/sleep without fake work | C14 passed | `src/domain/living-office.test.ts:57` `assert.ok(states.has('coffee'))`, `assert.ok(states.has('sleeping'))`, `assert.equal(f.agent.event.status,'idle')`; actual-mesh coffee :129 | PASS |
| C15 | Five-minute default, pack/exit, config | C15 and actual mesh departure passed | `src/domain/living-office.test.ts:58` `assert.equal(DEFAULT_IDLE_MS,300000)`, `assert.ok(packed)`, `assert.ok(absent)`, configuration200/400; `src/domain/elevator-layout.test.ts:128` absent asserts external doorway | PASS |
| C16 | Real work interrupts and returns | C16 passed | `src/domain/living-office.test.ts:59` `assert.equal(...state,'absent')`, `assert.ok(returned)`, `assert.equal(...visible,true)` after actual status working | PASS |
| C17 | HR assembly before newcomer entry | C17 and all eighteen actual-mesh journeys passed | `src/domain/living-office.test.ts:60` before ready `assert.equal(a.visible,false)` and assembling/ready/arrived; `src/domain/elevator-layout.test.ts:121` `assert.ok(recruited,...)`; rendered running/assembly timing unobserved | FAIL |
| C18 | Duplicate/failed/full hiring | C18; production admission/store failure/full/repeat passed | `src/domain/living-office.test.ts:115` write failure `assert.equal(deskStore.getSnapshot(),'')`, no notifications; :117 duplicate rejects without mutation; :119 full rejects with identical stored/snapshot bytes; :120 nine unique IDs. Production saveDesk consumes admitHire before confirmation/animation (`office-app.tsx:449`) | PASS |
| C19 | Finite physical gait and reduced motion | C19; actual meshes; production reduced presentation/Three joints passed | `src/domain/living-office.test.ts:62` finite/max step; :128 `assert.equal(reduced.moving,false)`, bob0/buildScale1/discrete lean; :132 actual Three root/limb rotations reset. AgentActors and Avatar use these helpers. Rendered gait/transitions unobserved | FAIL |
| C20 | Arrival within1.5m opens private chat | C20; actual moving-user and doorway regression passed | `src/domain/living-office.test.ts:63` arrival distance `<=1.5`; :81 no initial arrival across wall and `assert.ok(segmentClear(...))`; `office-app.tsx:178` arrival→messages source exists but panel/composer interactive proof absent | FAIL |
| C21 | Explicit agent approach before visual conversation | C21 passed | `src/domain/living-office.test.ts:64` `assert.ok(arrived)` for agent target, `assert.equal(f.agent.event.status,'idle')`; routines renderer/control have no provider send path | PASS |
| C22 | Move/floor/disappear/cancel/blocked handling | C22; moving-user, closed-wall; explicit cancel/disappeared recipient passed | `src/domain/living-office.test.ts:65` floor cancels/API409; :87 blocked feedback; :137 for both new cases `assert.ok(...status==='cancelled'&&r.message.length>0)`, no arrived, state not talking, 50 later ticks no arrival; `elevator-layout.test.ts:124–125` moved user reached | PASS |
| C23 | Locked boundaries and private host access | C23 and inherited isolation/consent passed | `src/domain/living-office.test.ts:66` lock `assert.ok(...status==='blocked')`, routines401/403; history401/403 C11; inherited `signals require same authorized meeting` and `invite authentication busy and locked boundaries` passed | PASS |

## Coverage

Recomputed from authoritative approved sets and direct production assembly; no cardinality inferred solely from checks.md. The claimed call-status join names C2 incorrectly: the actual boundary proof is `HTTP call boundary statuses`, which did run.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| History HTTP statuses (5) | plan Surface + historyResponse | 200/400 C9 :31;401/403 C11 :35;503 C12 :38; route directly delegates `api/agents/history/route.ts:5` | - |
| Routines HTTP statuses (5) | plan Surface + routinesResponse | 200/400 C15 :58;401/403 C23 :66;409 C22 :65; GET/POST delegate `api/office/routines/route.ts:5–6` | - |
| Call GET statuses (3) | plan Surface + callStreamResponse | 401/400/200 `area-meetings.test.ts:115–119`; `api/call/route.ts:16` direct delegation | - |
| Inherited Call POST statuses (5) | inherited Surface + callCommandResponse | 401/400/200/403/409 `area-meetings.test.ts:124–128`; route :109 delegates | - |
| Doors (2) | plan Landing + repository and scene assembly | canonical layout C1/C5/C7; historyv1 repository serialize/parse C12 and native filesystem C13 :151–154 | - |
| Cameras × floors (6) | approved first/third/isometric × ground/hr | actual `elevator-layout.test.ts:45` loops all six; :82/:99 all areas | visual camera acceptance and asserted roof omission absent |
| Providers (3) | approved Cursor/Anthropic/OpenAI | C8 :27 all three; importer :46–49 Cursor run, Claude session, Codex session/thread | - |
| Relations (7) | approved office/floor/area/agent/execution/routine/hire | C1 office/floor;C2 area;C14 agent;C8 execution;C15 routine;C17 hire | - |
| Areas/rooms/posts (12+8+18) | office-map and approved canonical layout | 7ground+5HR furnished, 8project; C1/C2; actual layouts with 8rooms/9cloud/9local C5/C7 | - |
| History fields/statuses/availability (13/5/3) | HistoryExecution, labels and HistoryAvailability | identity/provider/origin/title/start/end/status/summary adapter :46–49;unknown C8;unknown/available/unavailable C8/C9/C10; source renders metadata/truncation | rendered row metadata and partial/loading/empty/error controls unproven |
| Routine states (13) and work transitions | ROUTINE_STATES + tick | working C16; coffee/sleeping C14; packing/absent C15; waiting hidden until ready C17 :60; returning/arriving/leaving exercised through asserted finite physical hire/return/exit C17/C16/C15; approach/talk C20;blocked C23; reduced presentation :128/:132 | rendered transition/gait acceptance absent |
| Meeting target outcomes (5 cases) | AC22 moving/floor/disappeared/cancelled/no route | moving physical :124–125;floor C22;no route closed-wall :87;cancel/disappear :135–137 individually iterated with exact cancelled/no-arrival/no-talking assertions | - |
| Hiring outcomes (3 cases) | AC18 repeated/failed/full | production admitHire+deskStore tests :115 failed storage, :117 duplicate, :119–120 full; actual choreography C17 remains unchanged | - |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Domain decision/transition tables | history, import, routines, hire admission, navigation, layout, presentation | asserted cases per observable transition | yes - missing hire failure/full, reduced presentation and cancel/disappear cases now covered; intermediate routine state names are checked via their asserted finite journeys rather than each label separately |
| HTTP guards/status mapping | three added/changed route assemblies and delegated response handlers | real Request/Response boundary statuses | yes - exact handlers asserted and direct production delegation inspected |
| Visual acceptance | AreaFocus, actors, scene, AgentPanel/history, OfficeApp/hiring | screenshots and interactive observation in all three cameras | no - carried/re-read Round 2 UI gaps at Round 3; policy-blocked browser, no visual evidence or attempts |

## Faults injected

Carried from Round 1: five isolated faults killed (retention, host guard, shader dim, idle, wall-arrival), `/tmp/living-office-fault-*.log`. Carried from Round 2: five scoped faults below killed only in `/tmp/living-office-independent-round2-faults`, copied current sources/config with symlinked node_modules. `node --import tsx --test --test-name-pattern=<named proof> src/domain/living-office.test.ts` ran once per fault. All exit1 with assertion failure; no real source/git metadata mutated. Baseline SHA256 maps and porcelain matched afterwards exactly before updating this report. Scratch originals restored after each experiment; Round 2 five cap reached. Round 3 copies current sources/config to `/tmp/living-office-independent-round3-faults`, injects one new DPR assertion fault with the same narrow command, kills it with exit1, restores scratch and verifies real source SHA256/porcelain unchanged before report update.

| Mutation | Location | Killed |
| --- | --- | --- |
| private file600→644 | `src/server/history-file.ts:10`; native C13 | yes -420 !==384, `/tmp/living-office-round2-fault-native-permissions.log` |
| snapshot before failing storage write | `src/components/office/desk-store.ts:24`; production C18 | yes -snapshot populated instead of empty, `/tmp/living-office-round2-fault-failed-storage.log` |
| allow moving in reduced presentation | `src/domain/agent-routines.ts:91`; production C19 | yes -true !==false, `/tmp/living-office-round2-fault-reduced-presentation.log` |
| retain .3 leg rotation in reduced reset | `src/domain/character.ts:25`; production C19 | yes -.3 !==0 on distinct Three-joint assertion, `/tmp/living-office-round2-fault-reduced-joints.log` |
| ignore explicit cancel command | `src/domain/agent-routines.ts:45`; new C22 | yes -cancelled result absent, `/tmp/living-office-round2-fault-explicit-cancel.log` |
| Round 3 physical target width→logical width | `src/components/office/area-focus.tsx:19`; DPR C3 | yes -800 !==1200 at DPR1.5, `/tmp/living-office-round3-fault-resolution.log` |

## Swept existing and gate

Carried from Round 1 frozen fingerprint above; touched persistence/store/presentation/cancel surfaces re-read Round 2, C3 resolution wiring re-read Round 3. Validation caps, malformed HTTP inputs, auth guards, deduplication, append serialization, retention, corrupt preservation, provider-read unavailability, finite routes, work-state precedence, locks, cancellation notices and legacy stream exports were re-read in production. No n/a row was silently promoted to evidence. Shared scene rebuilds exact event and routine visual whitelists; raw tool payloads stay outside history. Local import caps depth4/visited2000/files500 and reads at most1MB or bounded head/tail; Cursor import limit100/concurrency3/20s and minute refresh dedupe. Existing observer streams retain explicit abort/cancel and host-only aggregation; inherited area locks/consent and elevator regression tests ran. No dependencies, network probes, commits, stash or real source edits occurred.

`scripts/verify.sh --webpack` independently exit0: production webpack build and TypeScript passed, lint passed, 112 tests passed/0failed/0skipped. Log `/tmp/living-office-independent-round3-gate.log` names every proof individually. Completion remains FAIL because rendered ui acceptance above is absent; C13 atomic writes and C18/C19/C22 computational gaps are resolved; C3 DPR preservation is now computationally proven; green build/tests do not erase rendered gaps. Third-round bound reached: escalate outstanding visual acceptance to the user, without browser workarounds or further automatic repair rounds. Parent runs the deterministic completion validator on this report. Reusable lessons: contract/mesh tests do not replace GPU/UI acceptance; failed persistence must not publish state before storage succeeds (fixed and mutation-tested). Lesson artifact updates are outside this verifier's report-only write authority.

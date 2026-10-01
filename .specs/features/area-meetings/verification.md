# Area meetings verification

**Verdict**: FAIL
**Profile**: light
**Diff range**: 48c8f5571d458bb0b8b18a7794477a2a42ad4e5e..working tree (including new untracked source/tests)
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

## Checks

Round 2 refreshes the HTTP boundary, C5 remote host unlock, C12/C17 distance/floor proof and C7 minimap bounds. Other source judgments carry from round 1 at HEAD 48c8f5571d458bb0b8b18a7794477a2a42ad4e5e plus its uncommitted working tree. All named proofs rerun in full at the current working tree; no implementation commits exist.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | automatic admission | area admission and map coverage | src/domain/area-meetings.test.ts:22 `assert.equal(s.roster().peers[0].meetingId,'area:cafe')`; :23 corridor null | PASS |
| C2 | authorized signals | signals require same authorized meeting | src/domain/area-meetings.test.ts:31 forbidden; :32 allowed; :33 different area refused, loop offer/answer/ice/media | PASS |
| C3 | scope teardown | source review | src/components/office/office-call.tsx:25 `link.pc.close()` plus :28 `setTiles([])`; :105 physical-change reset before POST; :154 playback cleanup `node.pause();node.srcObject=null` | PASS |
| C4 | lock entry and free exit | locked entrance rejects newcomers and permits exit; physical locks block entry and permit boundary exit | src/domain/area-meetings.test.ts:40 locked; :41 exit and empty unlock; :134 `assert.ok(stopped.x<1)`; :137 `assert.ok(freed.x>4)` | PASS |
| C5 | unlock authorization/cleanup | unlock authorization and empty cleanup; locked entrance rejects newcomers and permits exit | src/domain/area-meetings.test.ts:45 nonowner denied; :47 nonowner remote unlock denied; :48 host outside area allowed; :41 empty locks length zero; office-call.tsx:140 host remote unlock control | PASS |
| C6 | transfer control | lock ownership transfers on exit | src/domain/area-meetings.test.ts:53 `assert.equal(s.roster().locks[0].owner,'person-b')` and successful unlock | PASS |
| C7 | visible authenticated presence without media | source review only; required browser review unavailable | src/components/office/office-call.tsx:89 unconditional authenticated SSE; :147 name/floor/area; src/components/office/office-hud.tsx:36 position dots. No independent rendered browser proof of visible roster/map or absence of permission prompts | FAIL |
| C8 | disconnect/reconnect | disconnect and reconnect identity | src/domain/area-meetings.test.ts:57 hijack refused; :60 stale leave keeps count 3; :61 disconnect count 2; :62 reconnect count 3; :63 cafe restored | PASS |
| C9 | explicit media activation | source review; repository getUserMedia search | src/components/office/office-call.tsx:15 initial audio/video false; :124 sole capture path in toggle; :149 button onClick invokes toggle; :125 stale capture stopped | PASS |
| C10 | actionable panel states | source review (checks permit source) | src/components/office/office-call.tsx:13 locked advice; :129 permission retry advice; :135 solo/reconnect/corridor text; :139 unlock; :149 activation buttons | PASS |
| C11 | areas/map coverage | area admission and map coverage | src/domain/area-meetings.test.ts:25 every generated area's center resolves to its ID; :26 project/studio/study existence; src/domain/meeting-areas.ts:10 production enumeration includes cafe/research/CEO/lounge/RH | PASS |
| C12 | initiator confirmation | source review (checks permit source) | src/components/office/office-call.tsx:111 same-floor distance <=2.5 opens confirmation; area-meetings.test.ts:96 direct >2.5 m invite rejected; :98 different floor rejected; :142 invite sends confirm.id, cancellation only clears confirmation; src/components/office/office-scene.tsx:141 avatar click calls onPerson(peer.id) | PASS |
| C13 | recipient consent | source review; private pair is isolated | src/components/office/office-call.tsx:143 requester name plus accept/decline; src/domain/area-meetings.test.ts:67 invitation leaves area meeting unchanged | PASS |
| C14 | isolated private pair | private pair is isolated | src/domain/area-meetings.test.ts:69 private prefix, pair signal succeeds and third person signal fails | PASS |
| C15 | five invitation endings | invite cancellation expiration and distance | src/domain/area-meetings.test.ts:72 decline/cancel/time/distance/floor loop; :78 zero invites, late accept false, requester notice | PASS |
| C16 | five private endings | private ends on exit distance floor and disconnect | src/domain/area-meetings.test.ts:82 leave/distance/floor/area/disconnect loop; :90 all peers lack private meeting | PASS |
| C17 | session consent/busy/locked | invite authentication busy and locked boundaries | src/domain/area-meetings.test.ts:96 direct >2.5 m refused; :98 different floor refused; :100 locked invite refused; :102 wrong token refused; :103 third-person accept refused; :104 busy recipient refused | PASS |
| C18 | real elevator geometry | elevator actual geometry clearance | src/domain/elevator-layout.test.ts:47 avatar-radius arrival clear; :48 corridor clear, actual R3F scene obstacles in both floors/all 3 cameras with 9 desks | PASS |
| C19 | reserved corridor/orientation | elevator reserved corridor; elevator door faces the arrival and interaction corridor; source review | src/domain/elevator-layout.test.ts:55 all area barriers including avatar radius avoid corridor; :57 width >=1; src/components/office/office-scene.tsx:260 actual elevator rotation; src/domain/walker.ts:49 arrival/heading and :58 interaction west of door | PASS |
| C20 | repeated walk/return | elevator repeated arrival walking and return | src/domain/elevator-layout.test.ts:60 six layouts; :65 walks >=1.99 m; :67 return error <.01, 3 cycles each | PASS |

## Boundary proof findings

The real extracted GET Response boundary is now wired directly by src/app/api/call/route.ts:16 and exercised in src/domain/area-meetings.test.ts:112 (`denied.status === 401`, signed_out JSON, zero streams), :114 (`malformed.status === 400`, invalid JSON, zero streams), and :116 (`accepted.status === 200`, event-stream header/body and one opened callback). POST uses the real extracted Response handler, :121–125 asserts 401/400/200/403/409. Both route adapters supply `findSession(request)` and domain commands in production. These prove response-factory behavior rather than live cookie/session integration, appropriate to the approved light profile. The prior GET level gap is resolved.
C12's C17 floor/distance attribution is now accurate: :96 and :98 directly reject new invalid invitations. C5 includes an outside-area host unlocking the specified area. The minimap viewBox now includes cafe/research even when no project rooms exist (office-hud.tsx:31); browser visibility is still unproven.

## Transport, privacy and swept constraints

Only one EventSource occurs in components (office-call.tsx:89). Call GET authenticates, subscribes role-filtered snapshots and opens local/cloud observers only inside its host branch (src/app/api/call/route.ts:77). `drop` releases both memberships, aborts observers and cancels readers (:25–32); client cleanup closes SSE and stops media. Observer routines receive the abort signal and finally release local bridge. A process-global unref'ed tick timer remains after all peers leave, but performs no external observation.
Roster publishes an explicit publicPeer whitelist; meeting/signals remain separate from agent events. Existing shared-scene sanitization is still used; the independently run test `the shared event keeps status and drops transcripts, paths, and secrets` passed. No new transcript/tool-argument field was introduced into shared snapshots. All Swept items resolve to new checks; there are no Swept-existing rows requiring inherited constraints.

## Gate and limitations

`scripts/verify.sh --webpack` exit 0: webpack build, TypeScript, lint and 77/77 tests passed, zero skipped. Initial sandbox run built/linted but tsx IPC was denied; rerun with approved escalation passed in full. All new named proofs were run at this working tree; existing orientation/privacy regressions also ran.
Light profile: no fault injection, formal Coverage recompute, Test policy rows or binding design artifact required. No browser PASS claimed; rendered UI, real permissions, audio/video delivery and manual human flow remain unverified.

## Ranked gaps

1. C7 browser proof outstanding: implementation is source-supported but visible authenticated roster/map and no prompt are not observed.

Completion validator intentionally returns 1 while this report is FAIL. No implementation, plan, checks or commits changed by verifier.

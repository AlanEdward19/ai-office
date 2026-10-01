# Area meetings checks

Profile: light
Plan: `.specs/features/area-meetings/plan.md`

20 checks in 3 slices · 3 one-way doors · 0 open, 0 blocking

## Checks

### S1
**C1** - area admission and map coverage (AC 1)
Proof: `scripts/test.sh` test name="area admission and map coverage".
**C2** - signals require same authorized meeting (AC 2)
Proof: `scripts/test.sh` test name="signals require same authorized meeting".
**C3** - client scope teardown (AC 3)
Proof: independent source review of OfficeCall scope effect: old RTCPeerConnections close and remote playback is removed before the next meeting connects.
**C4** - locked entrance rejects newcomers and permits exit (AC 4)
Proof: `scripts/test.sh` test name="locked entrance rejects newcomers and permits exit"; test name="physical locks block entry and permit boundary exit".
**C5** - unlock authorization and empty cleanup (AC 5)
Proof: `scripts/test.sh` test name="unlock authorization and empty cleanup".
**C6** - lock ownership transfers on exit (AC 6)
Proof: `scripts/test.sh` test name="lock ownership transfers on exit".
**C7** - presence without media and authenticated roster (AC 7)
Proof: browser review: authenticated roster, names, floors, zones and map are visible without permission prompts; hook starts SSE independently of getUserMedia.
**C8** - disconnect and reconnect identity (AC 8)
Proof: `scripts/test.sh` test name="disconnect and reconnect identity".
**C9** - media requires explicit activation (AC 9)
Proof: independent OfficeCall source review: every getUserMedia path starts in explicit mic/camera activation; initial tracks are absent and UI toggles off.
**C10** - meeting panel states (AC 10)
Proof: browser/source review: solo, reconnecting, denied permission and locked states each render actionable text in the meeting panel.
**C11** - area admission and map coverage (AC 11)
Proof: `scripts/test.sh` test name="area admission and map coverage".

### S2
**C12** - proximity requires initiator confirmation (AC 12)
Proof: browser/source review: clicking nearby avatar opens confirmation, cancel sends no invite, confirm sends the selected peer ID; distance/floor guard is tested by C17.
**C13** - invite requires recipient consent (AC 13)
Proof: browser/source review: recipient invitation identifies requester and offers accept/decline; domain test name="private pair is isolated" proves invitation alone does not enter private meeting.
**C14** - private pair is isolated (AC 14)
Proof: `scripts/test.sh` test name="private pair is isolated".
**C15** - invite cancellation expiration and distance (AC 15)
Proof: `scripts/test.sh` test name="invite cancellation expiration and distance".
**C16** - private ends on exit distance floor and disconnect (AC 16)
Proof: `scripts/test.sh` test name="private ends on exit distance floor and disconnect".

Proof: `scripts/test.sh` test name="HTTP call boundary statuses".
**C17** - invite authentication busy and locked boundaries (AC 17)
Proof: `scripts/test.sh` test name="invite authentication busy and locked boundaries".

### S3
**C18** - elevator actual geometry clearance (AC 18)
Proof: `scripts/test.sh` test name="elevator actual geometry clearance".
**C19** - elevator reserved corridor (AC 19)
Proof: `scripts/test.sh` test name="elevator reserved corridor".
**C20** - elevator repeated arrival walking and return (AC 20)
Proof: `scripts/test.sh` test name="elevator repeated arrival walking and return".

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| GET /api/call statuses (3) | 200 C16 · 400 C16 · 401 C16 | - |
| POST /api/call statuses (5) | 200 C16 · 400 C16 · 401 C16 · 403 C16 · 409 C16 | - |
| signals (4) | offer C2 · answer C2 · ice C2 · media C2 | - |
| areas (8) | estudo C11 · estúdio C11 · café C11 · pesquisa C11 · CEO C11 · convivência C11 · RH C11 · projetos C11 | - |
| invite endings (5) | decline C15 · cancel C15 · expiry C15 · distance C15 · floor C15 | - |
| floors (2) | ground C18 · hr C18 | - |
| protocol doors (3) | meeting authorization C2 · media independent presence C7 · single authenticated SSE C7 | - |

## Swept

- validation: C8, C17
- failure modes: C10, C15
- idempotency: C8
- authorization: C2, C5, C17
- concurrency: C8, C17
- data lifecycle: C5, C6, C8, C16
- dependency failure: C9, C10
- state transitions: C1, C14, C16
- observability: C7, C10

## Handoff

Estimated domain/server 20k + client/scene 35k + proof/review 15k = 70k, below 150k; one builder. No commits requested for this feature. All checks pending until independent verification.

- **Boundary:** domain/server C1/C2/C5/C6/C8/C14/C15/C16/C17 proofs pass in working diff; UI, physical locks and elevator checks remain open.
- **Settled mid-build:** no commits for this feature.
- **Abandoned:** none.

- **Boundary:** UI and elevator implemented; final 77-test build/lint gate passed. Independent browser/source verification remains with orchestrator.

# Affectation des Stages (service-rotation)

A single-page web app for splitting a cohort of medical externs across hospital
services, rotation after rotation, using an outcome that minimises real
dissatisfaction while remaining hard to game. Deployed on GitHub Pages with a
Firebase (Firestore + Auth) backend — no server, no Cloud Functions.

## Why this isn't Gale-Shapley

Only externs express preferences — services don't rank or veto anyone.
Deferred acceptance needs preferences on both sides, so this is one-sided
assignment, not Gale-Shapley, despite the algorithmic lineage. See
[Mechanism](#mechanism) for what it actually is.

## Features

- **Organizer**: create a group and share its link immediately — externs can
  join from that moment, even while services and rotations (added/removed
  one at a time, either named freely or given a calendar date range, never
  both at once) are still being configured. Two standing controls cover
  membership while still a draft: lock/unlock the roster against new joins,
  and ban an individual member (banning stays available at any time, and a
  banned member can't simply rejoin — the organizer can undo a ban, but only
  while the roster isn't locked). A group with fewer services than rotations
  can't open unless the organizer explicitly allows a student to repeat a
  service across rotations (off by default — the UI flags the shortfall and
  blocks opening until either more services are added, a rotation is
  removed, or the setting is turned on). Enabling voting (freezing
  services/rotations) is the only other control,
  and locks the roster for good in the same step — for fairness, nobody can
  join after other members have already started grading. From then on
  there's no privileged access to anyone's grades, including the
  organizer's own.
- **Externs**: sign in with Google, open the link, join with a display name
  (no pre-registration, no need to wait for voting to be enabled), grade
  every service on a 4-level scale once voting is enabled, save the draft as
  many times as you like, then lock your vote once — no edits afterward. You
  can leave the group yourself at any time before locking your vote.
- **On-demand computation**: anyone whose own vote is locked can compute the
  result at any time, locally, from whichever other members' votes are
  currently readable. There is no stored "final" document — every computation
  is a pure function of the current votes, so it's provisional until every
  member has voted and the invite is closed, and stable (byte-identical on
  every future recompute) after.
- **Transparency**: locking your own vote is what unlocks reading anyone
  else's — mutual, symmetric, no exceptions for the organizer. Fairness is
  verified by recomputing, never taken on trust.
- **Continuation groups**: a new group can be created pre-filled from one
  the creator already has access to (created or joined) — services,
  rotation count, and `allowRepeatedServices` carry over, so a cohort that
  turns over can start its next rotation cycle without rebuilding from
  scratch. Rotation slot dates/names don't carry over — those belong to the
  new period.
- **Past-shift history**: the organizer can turn on per-service "shifts
  already done" counts for the group — one number per member per service,
  covering exposure from before this cycle. This is organizer-entered, not
  self-reported: unlike a grade, a shift count is neither bounded nor
  self-punishing, so letting each member fill in their own would hand them
  a free lever alongside the honest one. It's public to every member from
  the moment it's entered (the group document already is), and frozen once
  voting opens, same as services and rotations. On a continuation group,
  the organizer can import these counts from the predecessor in one click:
  it recomputes the predecessor's own live result (the same computation
  anyone there could run) under the organizer's own predecessor membership,
  counts each continuing member's assignments per service name, and
  falls back to a zero row for anyone it can't match (new members, or
  anyone whose predecessor vote isn't readable). Re-running it simply
  overwrites the previous import with a fresh one. Any member who spots a
  wrong number (whether it was imported or typed in by hand) can propose a
  correction to their own row; the organizer accepts or rejects it, and
  both the proposal and its resolution stay visible to the whole group —
  the same transparency the numbers themselves get, applied to disputes
  about them too.

## Mechanism

1. **Input**: each extern grades every service once — Excellent, Bien,
   Indifférent, or Passable. Every grade is assignable; there is no veto and
   no cap. One sheet drives every rotation; a student never repeats a service
   — unless the organizer opts into `allowRepeatedServices` (off by default).
   Off, a group with fewer services than rotations simply can't open (see
   `checkStructuralFeasibility`). On, a student may be assigned the same
   service more than once, with no cap on the repeat beyond `rotations`
   itself, whenever that's what minimises their cost — not only when there
   aren't enough distinct services to avoid it: a student may prefer
   repeating one great service over a worse distinct one even when there are
   enough services to give them a fully distinct set. When `pastShiftsEnabled`
   is on, the cost the engine actually optimises against isn't the raw grade:
   `computeWeightedCost` (`src/domain/matching/weightedCost.ts`) adds one
   point per shift already done at that service, capped at `rotations`, so a
   heavily-repeated Excellent can end up costing more than a fresh Passable.
   Every grade is still graded — history steers which of an extern's own
   grades gets prioritised, it never substitutes for one.
2. **Phase 1 — min-cost flow** picks each student's set of `k` (=rotations)
   services — distinct unless `allowRepeatedServices` is on and a repeat is
   actually cheaper — minimising the worst *effective* cost anyone receives
   first (binary search), then the total among solutions tied on that
   worst cost. "Effective" is grade cost alone unless `pastShiftsEnabled` is
   on, in which case it's the weighted cost above; the displayed worst-grade
   and total-cost stats are always recomputed back to plain grade terms
   afterward (see `ComputeResultUseCase`), so what a member reads never
   silently switches units.
3. **Phase 2 — bipartite edge colouring** schedules that fixed service set
   into `k` rotations respecting per-rotation capacity. Always succeeds once
   phase 1 does — see `src/domain/matching/edgeColouring.ts`.
4. **Determinism**: the tie-break lottery is derived from the votes
   themselves — a hash of each vote's content (who, and what they graded),
   never of when they voted or which group happened to contain them (see
   `src/domain/lottery.ts`). Two different groups with the same members
   casting the same grades produce the identical seed and order — and, with
   `pastShiftsEnabled` off (the default), the identical assignment too. With
   it on, the assignment can legitimately differ between two otherwise
   identical groups whose members carry different shift histories, since
   history is now part of what's being optimised; the seed and order stay
   reproducible regardless. Nobody can act on the resulting order: by the
   time anyone can compute anything, their own vote must already be locked
   and unchangeable.

### What is and isn't guaranteed

Zhou (1990): no mechanism is simultaneously efficient, fair, and
strategy-proof. This one chooses efficiency + fairness (minimax, then total)
and buys back most — not all — of the honesty:

- Grades feed the objective, so exaggerating a gap trades priority in one
  rotation for imprecision in the others. How costly that trade is depends on
  `rotations / serviceCount` and on capacity slack — it is **not** a general
  "multi-rotation makes lying self-punishing" guarantee.
- There is no veto any more, and so no submit-time feasibility preflight to
  speak of: every grade is a cost, never a hard exclusion, so a computable
  assignment always exists once there's enough raw capacity for however many
  members have currently voted.
- Rules cannot verify the matching itself (too complex for the rules
  language). The defence is that computation is deterministic and
  independently recomputable by any member — not that any single document is
  provably correct. There is, in fact, no document to be correct: results are
  never stored (see "Data model & security model" below).

## Architecture

Hexagonal (ports & adapters), React 19 + TypeScript + Vite + Chakra UI v3 +
Firebase:

```
src/domain/            Entities, value objects, repository interfaces (ports)
src/domain/matching/   The algorithm — pure, no Firebase/React imports
src/application/       Use cases (one class per operation, execute() method)
src/infrastructure/    Firebase adapters implementing the domain ports
src/presentation/      React pages, components, DI wiring
```

`src/domain/matching/` is deliberately framework-free and independently
tested (`assign.test.ts`, `edgeColouring.test.ts`, `minCostFlow.test.ts`) —
determinism, capacity/distinctness invariants under randomised instances, a
brute-force oracle check for minimax optimality, and a hand-verified golden
case.

## Data model & security model

See `firebase/firestore.rules` (heavily commented) for the authoritative
version. Summary:

- **Lifecycle**: `groups/{groupId}` moves `draft → open → done`. `open` means
  *voting enabled* — services and rotations freeze at that point, forever,
  and `inviteOpen` flips to `false` in the same write (see `Group.open`) and
  can never flip back: `reopenInvite` only works in `draft`. `done` is set by
  the creator once every current member's vote is locked (`FinishGroupUseCase`)
  and is purely a display state — reading votes, computing a result, and
  banning a member all behave exactly as in `open`; there is still no stored
  result (see below). Since there's no Cloud Function, this transition only
  happens once the creator's own client next has the group open — see
  `OpenView`'s effect. Outside of that,
  membership is independent of status while still a draft: joining and
  leaving are self-service, gated only by `inviteOpen` (freely toggleable by
  the creator up to that point) and, for leaving, the member's own vote not
  being locked yet. The creator keeps one privilege regardless of phase —
  forcibly removing (banning) any member — but reopening joins is
  deliberately a one-way door once voting starts, for fairness between
  members. A ban is remembered (`bannedMembers`/`bannedUids`, not just a
  removal): `Group.join` and the matching security rule clause both reject a
  banned uid's self-rejoin attempt. The creator can undo a ban
  (`Group.unban`) only while the roster itself isn't locked — the same
  window a self-join needs anyway.
- **Identity is uid-only, never email.** Membership, votes, and the invite
  mechanism never reference anyone's email address. The group's own id
  (`crypto.randomUUID()`, unguessable, and groups are never listable by
  non-members) *is* the invite: opening the link and joining requires no
  organizer approval and no pre-registration.
- **Votes are split into two documents**: `votes/{uid}` (the actual grades —
  freely editable while unlocked, one-way `locked` transition, readable by
  another member only if *that member's own vote is also locked*, with no
  exception for the creator) and `voteStatus/{uid}` (`locked: boolean` only,
  always public within the group — lets anyone see voting progress without
  learning anyone's actual grades).
- **No stored result.** `ComputeResultUseCase` reads whichever votes are
  currently readable and runs the algorithm locally, live, every time it's
  called — there is no `result/final` document, no create-once race, and no
  organizer-forced early close. Two people calling it at different moments
  may legitimately see different assignments if membership or votes changed
  in between; the result is stable only once the invite is closed and every
  remaining member has voted.
- **Concurrency**: joining and leaving are Firestore *transactions*, not
  plain writes — two members acting within milliseconds of each other both
  append to the same `memberUids` array, and a plain overwrite would let the
  second writer's stale read silently clobber the first.

### Known, accepted trust gaps

- A member can leave the group at any time before locking their vote,
  regardless of the roster lock — this is fully self-service and by design,
  not a gap.
- The creator can ban any member at any time, including one whose vote is
  already locked. This is a deliberate moderation override, not something
  the removed member could trigger themselves: a banned member's vote (if
  any) is simply orphaned, never read again, since every computation and
  progress count filters by the group's *current* member list. A banned uid
  cannot rejoin through the invite link; the creator can undo the ban, but
  only while the roster isn't locked.
- A group with a permanent non-voter (joined, never locks) can only ever
  produce a provisional result excluding them — there is no deadline or
  override. Anyone can still compute a "result so far" at any time; nothing
  forces the group toward a stable final state except the creator closing
  the invite and everyone remaining actually voting.
- Two services sharing the same name within one group collide in the lottery
  seed's hash (see `src/domain/lottery.ts`) — harmless to the lottery's
  validity, just not perfectly reproducible in that specific edge case.
- Past-shift history is organizer-entered and trusted, not independently
  verified — the app relies on it being publicly visible to the whole group
  before voting opens (any error is visible to the people it's about, same
  as a wrong service capacity would be), not on any technical check.
- `done` is creator-asserted, not rules-verified: Firestore rules cannot loop
  over an arbitrary member count to confirm every vote is actually locked, so
  that check lives only in `FinishGroupUseCase`. A creator could in principle
  hand-craft a write that flips `status` to `done` early. The consequence is
  narrow — it permanently blocks any member who hadn't yet created a vote
  document from ever creating one (`votes`/`voteStatus` `create` both require
  `status == 'open'`) — not a way to see or alter anyone's grades.
- The past-shift penalty is a fixed per-edge weight computed once from
  cross-cycle history; it does not additionally escalate for a *second*
  repeat of the same service inside the current cycle when
  `allowRepeatedServices` is also on — that within-cycle spread is governed
  separately, by `allowRepeatedServices`/`perStudentServiceCap`. Modelling
  both together would need a convex-cost-flow rewrite of `buildNetwork`
  (splitting each student→service edge into `rotations` unit-capacity edges
  with increasing cost), which was judged not worth the risk given the
  edge-multiplicity bugs this module has already had (see the testing
  section above).

## Development

Docker-based, per `docs/ADR-001-Docker-Package-Management.md`:

```
make dev              # http://localhost:3000, against the dev Firebase project
make test             # vitest
make lint             # format + lint + type-check
```

## Two Firebase projects, no emulators

Dev and prod are separate real Firebase projects (aliased in
`firebase/.firebaserc` as `dev`/`prod`), not a local emulator — `.env`
(gitignored, from `.env.example`) holds the **dev** project's config and is
what `make dev` and the frontend container use; the **prod** project's
config only ever lives in the `ENV_FILE` GitHub Actions secret, used by
`.github/workflows/deploy.yml` at build time.

## Setup checklist (do this yourself — not automated)

Repeat steps 1–2 for both the dev and prod Firebase projects.

1. Create a Firebase project. Enable **Google** sign-in under Authentication
   for both projects. On the **dev** project only, also enable **Anonymous**
   sign-in — it powers the "continue as guest" option (visible only when
   `import.meta.env.DEV` is true) that lets developers spin up multiple fake
   accounts locally without real Google accounts. Never enable it on prod.
2. Create a Firestore database (production mode).
3. Set the dev and prod project IDs in `firebase/.firebaserc`, then deploy
   rules/indexes to each: `make firebase.deploy.dev` and
   `make firebase.deploy.prod` (or `firebase deploy --only
   firestore:rules,firestore:indexes -P <dev|prod>` from `firebase/`).
4. Copy `.env.example` to `.env` and fill in the six `VITE_FIREBASE_*` values
   from the **dev** project's console.
5. Enable GitHub Pages via Actions (Settings → Pages → Source: GitHub
   Actions).
6. Add a repo secret `ENV_FILE` containing the same six variables, but from
   the **prod** project's console (used by `.github/workflows/deploy.yml`).
7. Add `localhost` to the dev project's authorised domains (Firebase ships
   this by default, but confirm it's there — `127.0.0.1` is not on the list
   and `signInWithPopup` will misbehave against it), and your GitHub Pages
   domain to the prod project's.
8. If the repo is ever renamed again, update `base` in `vite.config.ts` to
   match.

## License

MIT

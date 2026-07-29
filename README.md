# Affectation des Stages (service-rotation)

A single-page web app for splitting a cohort of medical interns across hospital
services, rotation after rotation, using an outcome that minimises real
dissatisfaction while remaining hard to game. Deployed on GitHub Pages with a
Firebase (Firestore + Auth) backend — no server, no Cloud Functions.

## Why this isn't Gale-Shapley

Only interns express preferences — services don't rank or veto anyone.
Deferred acceptance needs preferences on both sides, so this is one-sided
assignment, not Gale-Shapley, despite the algorithmic lineage. See
[Mechanism](#mechanism) for what it actually is.

## Features

- **Organizer**: create a group and share its link immediately — interns can
  join from that moment, even while services and rotations (added/removed
  one at a time, either named freely or given a calendar date range, never
  both at once) are still being configured. Two standing controls cover
  membership while still a draft: lock/unlock the roster against new joins,
  and ban an individual member (banning stays available at any time, and a
  banned member can't simply rejoin — the organizer can undo a ban, but only
  while the roster isn't locked). Enabling voting (freezing services/rotations)
  is the only other control,
  and locks the roster for good in the same step — for fairness, nobody can
  join after other members have already started grading. From then on
  there's no privileged access to anyone's grades, including the
  organizer's own.
- **Interns**: sign in with Google, open the link, join with a display name
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

## Mechanism

1. **Input**: each intern grades every service once — Excellent, Bien,
   Indifférent, or Passable. Every grade is assignable; there is no veto and
   no cap. One sheet drives every rotation; a student never repeats a service.
2. **Phase 1 — min-cost flow** picks each student's set of `k` (=rotations)
   distinct services, minimising the worst grade anyone receives first
   (binary search over the 4 levels), then the total among solutions tied on
   that worst grade.
3. **Phase 2 — bipartite edge colouring** schedules that fixed service set
   into `k` rotations respecting per-rotation capacity. Always succeeds once
   phase 1 does — see `src/domain/matching/edgeColouring.ts`.
4. **Determinism**: the tie-break lottery is derived from the votes
   themselves — a hash of each vote's content (who, and what they graded),
   never of when they voted or which group happened to contain them (see
   `src/domain/lottery.ts`). Two different groups with the same members
   casting the same grades produce the identical seed, order, and assignment.
   Nobody can act on the resulting order: by the time anyone can compute
   anything, their own vote must already be locked and unchangeable.

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

- **Lifecycle**: `groups/{groupId}` moves `draft → open`, where `open` means
  *voting enabled* — services and rotations freeze at that point, forever,
  and `inviteOpen` flips to `false` in the same write (see `Group.open`) and
  can never flip back: `reopenInvite` only works in `draft`. Outside of that,
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

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

- **Organizer**: create a group, define services (name, capacity per
  rotation) and rotation count, add interns by email, open submissions, share
  one link. Each rotation can optionally get a start/end date, picked from a
  calendar, purely for display — the matching engine never sees them.
- **Interns**: sign in with Google, grade every service on a 6-level scale,
  submit once — no edits afterward.
- **Automatic computation**: the moment every intern has submitted, whichever
  browser observes it computes and publishes the result. No admin action
  required (though the organizer can force an early close for stragglers).
- **Transparency**: once complete, everyone's grades become visible to the
  whole group — the fairness of the result is verifiable, not asserted.

## Mechanism

1. **Input**: each intern grades every service once — Excellent, Très bien,
   Bien, Passable, Insuffisant, or À rejeter (hard veto, capped per group).
   One sheet drives every rotation; a student never repeats a service.
2. **Phase 1 — min-cost flow** picks each student's set of `k` (=rotations)
   distinct services, minimising the worst grade anyone receives first
   (binary search over the 5 acceptable levels), then the total among
   solutions tied on that worst grade.
3. **Phase 2 — bipartite edge colouring** schedules that fixed service set
   into `k` rotations respecting per-rotation capacity. Always succeeds once
   phase 1 does — see `src/domain/matching/edgeColouring.ts`.
4. **Determinism**: a random tie-break lottery is committed to the group
   *before* submissions open and frozen forever after. The whole computation
   is a pure function of (frozen roster, frozen lottery, submitted grades),
   so any participant can recompute it and check the published result matches.

### What is and isn't guaranteed

Zhou (1990): no mechanism is simultaneously efficient, fair, and
strategy-proof. This one chooses efficiency + fairness (minimax, then total)
and buys back most — not all — of the honesty:

- Grades feed the objective, so exaggerating a gap trades priority in one
  rotation for imprecision in the others. How costly that trade is depends on
  `rotations / serviceCount` and on capacity slack — it is **not** a general
  "multi-rotation makes lying self-punishing" guarantee.
- Rejections are the exception: capped and privacy-preserving. Every
  submission runs a feasibility preflight using real rejection sets from
  everyone who has already submitted (public — see below) plus the
  candidate's own, so a combination that would strand the group is refused at
  submit time, not discovered after the roster is frozen.
- Rules cannot verify the matching itself (too complex for the rules
  language). The defence is that computation is deterministic and
  independently recomputable by any roster member — not that any single
  document is provably correct.

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

- **Lifecycle**: `groups/{groupId}` moves `draft → open → computed`. Opening
  freezes services, roster, and the lottery. Each transition, and the
  append-only `submittedEmails` growth during `open`, is its own rule clause.
- **Submissions split into two documents**: `submissions/{uid}` (email,
  timestamp, **rejected service IDs** — always listable by the roster) and
  `submissions/{uid}/grades/data` (the actual 0–4 grades, gated on being the
  submitter, the organizer, or the whole roster having submitted). Rejections
  reveal a veto, never a preference among accepted services, so they're safe
  to keep public — that's what makes the feasibility preflight both accurate
  and privacy-preserving.
- **Concurrency**: submitting is a Firestore *transaction*, not a batch —
  two interns submitting within milliseconds both append to the same
  `submittedEmails` array, and a batch would let the second writer's stale
  read get silently rejected. `result/final` is create-once; a losing
  concurrent compute reads back the winner's document instead of erroring.

### Known, accepted trust gaps

- A participant can append their own email to `submittedEmails` without a
  real submission underneath. This is self-harming only (they get treated as
  indifferent) — it cannot affect anyone else's outcome.
- The organizer can read all grades at any time (needed to run an early
  close with stragglers). Everyone else waits until the roster completes.
- A single shared link lets anyone claim any roster name on first sign-in in
  principle, though Google auth ties every submission to a real account.

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

1. Create a Firebase project. Enable **Google** sign-in only under
   Authentication.
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

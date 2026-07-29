# CLAUDE.md

Guidance for Claude Code when working in this repository. See `README.md`
first for the algorithm, data model, and security model — this file is about
conventions, not the app's behavior.

## Project overview

A single-page web app that splits medical interns across hospital services over several
rotations, using a one-sided min-cost-flow assignment (minimax fairness, then
minimise total) rather than Gale-Shapley — see README's "Why this isn't
Gale-Shapley". React 19 + TypeScript + Vite + Chakra UI v3 + Firebase
(Firestore + Auth, Google sign-in — plus dev-only Anonymous sign-in for local
multi-account testing), deployed to GitHub Pages. Identity throughout the app
is Firebase uid only; no email is ever used for membership, votes, or the
invite mechanism — see README's security model.

## Development commands

- `make dev` — Docker dev server, http://localhost:3000, against the dev
  Firebase project (no emulators — see below)
- `make test` — vitest (the matching engine's test suite is the one that
  actually matters; everything else is thin)
- `make lint` — format + lint + type-check, run before every commit
- `make firebase.deploy.dev` / `make firebase.deploy.prod` — push
  firestore rules/indexes to the dev or prod Firebase project (aliases in
  `firebase/.firebaserc`)
- `docker-compose run --rm frontend yarn add <package>` — all package
  management goes through Docker, per `docs/ADR-001-Docker-Package-Management.md`

Dev and prod are two separate real Firebase projects, not a local emulator —
`.env` (gitignored) holds the dev project's config; the prod project's config
only lives in the `ENV_FILE` GitHub Actions secret. See README's "Two
Firebase projects, no emulators".

## Architecture

Hexagonal (ports & adapters):

- `src/domain/` — entities, value objects, repository interfaces (ports),
  domain errors. No Firebase or React imports anywhere in this tree.
  - `src/domain/matching/` — the algorithm. Pure, framework-free, plain
    string/number types (not domain entities) so it stays trivially testable.
    Translating `GroupEntity`/`VoteEntity` to and from its input/output
    types is `src/application/matchingInputs.ts`'s job, not this module's.
- `src/application/` — one class per use case, `execute(command)` returning
  a wrapped `{ result }` object. Constructor-injects repository ports plus
  `SignInUseCase`. Mutating use cases open with
  `const user = await this.signInUseCase.requireCurrentUser()`.
- `src/infrastructure/` — Firebase adapters implementing the domain ports.
  `firebase.ts` is a singleton (`Firebase.getInstance()`). Each
  `Firebase<Noun>Datastore` declares an unexported `type Firebase<Noun>Document`
  wire format and maps by hand in `save()`/a private `mapToEntity()` — no
  generic serialization layer.
- `src/presentation/` — React. DI via `DependencyContext` (interface) +
  `Dependencies` (the actual `createContext`) + `DependencyProvider` (the
  composition root) + `useDependencies()` hook. `GroupPage.tsx` branches on
  `group.status` into `GroupPageParts/{DraftAdminView,OpenView}` — only two
  states now, `draft` and `open`, there is no third "computed" status — rather
  than using separate routes. `OpenView` itself handles join/vote/leave and
  embeds `LiveResultView` for an on-demand, never-stored computation. The app
  is one shareable link per group, and what you see depends on your role and
  the group's phase, not the URL.

### Path aliases

`@domain`, `@application` are barrel-only (exact match, no wildcard in
`tsconfig.json`/`vite.config.ts` — deliberately, so nothing deep-imports past
the barrel). `@domain/matching`, `@infrastructure/*`, `@presentation/*` are
wildcard and always deep-imported (e.g. `@infrastructure/datastores/FirebaseGroupDatastore`,
`@domain/matching`). `@/*` points at `src/*`.

## Code style

Prettier-enforced (`make lint` catches drift): 4-space indent, no semicolons,
single quotes, 100-col width, no trailing commas, `arrowParens: avoid`. Root
config files (`vite.config.ts`, `eslint.config.js`) are the exception — they
stay 2-space with semicolons, outside Prettier's glob.

- Entities: `interface X` + `class XEntity implements X`, `public readonly`
  positional constructor params, static `create()` factory, mutators return a
  new instance (never mutate). See `src/domain/entities/Group.ts`.
- Value objects: `EntityId` abstract base with `static generate()`/`static from()`
  subclasses (`GroupId`, `ServiceId`, `UserId`); richer ones (`Grade`, `Email`)
  validate in a private-constructor `static from()`.
- Repositories: plain interfaces, domain types in and out, never Firestore
  types. `subscribe(id, callback): () => void` for realtime reads.

## Testing

`src/domain/matching/*.test.ts` is the real test suite — determinism, every
student gets `k` distinct services, capacity never exceeded, a brute-force
oracle confirming true minimax optimality on small random instances, one
hand-verified golden case, and a genuinely infeasible instance that naive
arithmetic checks would miss (see the comments in `assign.test.ts` for why
that specific instance, not an arbitrary one, is used). Property tests use a
seeded `mulberry32` PRNG, never `Math.random()`, so failures reproduce.

Grades are a 4-level scale (`GradeLevel`: Excellent/Bien/Indifferent/
Passable, costs 0..3) with no hard exclusion — every grade is assignable, so
there is no rejection concept, no `maxRejections`, and no submit-time
feasibility preflight any more. `checkStructuralFeasibility` only checks
`services.length >= rotations`; real capacity infeasibility is discovered by
`computeAssignment` itself, at compute time, over whichever votes are
currently readable.

If you touch `src/domain/matching/`, re-run the full suite plus consider a
throwaway stress script (see git history / session notes) hammering hundreds
of random instances before trusting a change — this code has already had two
subtle bugs (a Set-based padding step that silently dropped multi-edges, and
an unbounded tie-break scale) that only a large random sweep caught, not the
committed unit tests alone.

## Firestore rules

`firebase/firestore.rules` is heavily commented and is the authoritative spec
for the lifecycle/security model — read it, don't infer the rules from the
datastore code. If you change a Firestore document shape in
`src/infrastructure/datastores/`, the matching rule clause almost certainly
needs to change too; they are not independently verified anywhere.

## Updating this file

Update `CLAUDE.md` and `README.md` when you add, change, or remove a
user-facing feature or a load-bearing architectural decision.

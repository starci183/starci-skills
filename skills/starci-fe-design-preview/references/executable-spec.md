# Executable Preview specification

An approved Preview is code plus identity, not a screenshot. It must be possible for Apply to map
the candidate to production without making another design decision.

## Candidate requirements

| Lock | Required value | Why |
|---|---|---|
| Runtime | Framework, package versions and build command | Prevent a different rendering model in Apply |
| Source | Candidate files and exact production target paths | Make implementation a materialization step |
| Owners | Page/layout/block/overlay and component tree | Preserve product ownership |
| Contracts | Keys, slots, repeats and `why` | Preserve admitted anatomy |
| Inputs | Exact props, actions and fixture files | Prevent data/state substitution |
| Tokens | Contract classes and intentional component variants | Prevent freehand CSS translation |
| State identity | Route, viewport, locale, theme and auth persona | Make comparisons same-state |
| Evidence | Screenshot per rendered state | Give parity a visible baseline |
| Runtime proof | Build command, its exit code and a hashed build log | Make "it executes" an artifact rather than an assertion |
| Canon proof | Lint command, its exit code and a hashed lint log | Make "it is StarCi" an artifact too — a build only proves it runs |
| Integrity | SHA-256 for source, fixtures, screenshots, build log, lint log and semantic record | Detect post-approval drift |

## The candidate is governed source, not scratch

Every file under the candidate root declares a production target path, so it is the exact code Apply
materializes into `src/`. It is therefore held to the SAME rules as `src/`, and the target's own
ESLint configuration must be scoped to reach it — typically by adding the candidate path beside
`src/**` in the canon rule block. A repository whose rules stop at `src/**` leaves this phase
ungoverned precisely where it matters most.

A build is not that proof. TypeScript compiles a hand-written `flex flex-col gap-6`, a page that
threads one loading flag through every region, and a branch that takes `children`; canon refuses all
three and the plugin already says so at `error`. Run the lint before asking for approval, not after,
and record the command, the exit code and the hashed log next to the build's.

The review harness is the one exception, and it is drawn at portability: files that declare no target
path and are never ported — the scenario switcher, the theme toggle — are scaffolding. Holding
scaffolding to production rules only teaches the next author to move real work into the harness.

The candidate may import a locked target component read-only. If a proposed component or API does
not exist, its exact candidate source must live in the artifact and name its future target path.
Review chrome may display the candidate but cannot duplicate its markup or styling.

Every sealed candidate source file lives under the declared candidate root. A path outside that
root is evidence reuse, not candidate implementation, and the verifier rejects it. Every state in
the sealed `states` collection is an actually rendered state; `covered-by` and `not-applicable`
classifications stay in `stateCoverage`, not in the parity baseline collection.

The shared review lab declares `phase: "preview"` and loads each rendered state's executable URL
through `candidateUrl`. `state.html` and case-level CSS belong only to Plan's visibly directional
comparison phase and are forbidden as Preview implementation sources.

## Forbidden substitutes

- Standalone HTML/CSS that imitates a React candidate.
- A screenshot whose source is not the candidate under review.
- Placeholder data when the approved state names a fixture or seed.
- A different auth persona, locale, theme, viewport or loading state.
- An anatomy that current or explicitly proposed contracts cannot express.
- Approval before candidate build/typecheck and record validation pass.

When the candidate cannot express the selected direction, return to Plan for the missing ownership
decision. Do not approve an impossible picture.

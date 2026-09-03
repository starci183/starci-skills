# Tests — workflow dry runs and their assessment

`tests/runs/` holds one record per real session of a workflow: the request, every branch's status and
stop code, the validator output verbatim, the artifacts written, and the defects the run exposed. A
run is executed by a processor agent (Claude Opus in this round) that also plays each operator's agent;
every branch must pass `validate-request`, `validate-response` and the operator's own `validate.mjs`; a
valid `blocked` counts as green, a fabricated green is a failure. Source-writing steps ran with
`mode: dry`; nothing was written to a checkout or a businesses root; sessions live under
`.worktrees/sessions/` (gitignored) and are kept for inspection.

## Round 1 — 2026-09-03, tree at 1.0.2

| Workflow | Target | Reached | Stopped by | Judged | Report |
| --- | --- | --- | --- | --- | --- |
| `frontend-refine` | `/[lang]/subscriptions` (`ProSubscriptionBlock`) | bind → direction done | `frontend.presentation.resolve` `RULE_MISSING` (route block inset; accent marker on an unraised row) | correct stop; knowledge added (`PADDING-9`), resolve law added (forbidden class is removed) | [record](runs/20260903-frontend-refine-subscriptions.md) |
| `frontend-reconstruct` | learner dashboard | bind → direction → resolve (0 `RULE_MISSING`, 27 classes removed, 1 gap) → apply dry (5 paths, 0 `WRITE_REJECTED`) | `frontend.surface.audit` `RUNTIME_UNAVAILABLE` (no preview served) | correct stop; workflows now bind the fe checkout with `runtimeNeed: consume` | [record](runs/20260903-frontend-reconstruct-dashboard.md) |
| `frontend-new-surface` | `/games/billiards` (no promise exists) | bind done | `business.decide` `EVIDENCE_MISSING`; standalone direction `BUSINESS_REQUIRED` | correct refusal to draw an undecided page; design gap fixed: a greenfield promise now enters as the person's `promise` (intent claim) | [record](runs/20260903-frontend-new-surface-billiards.md) |
| `backend-feature` | `pro-subscription` | bind `CHECKOUT_DIRTY` → resume done → business (22 claims, 15 dimensions) → architecture done with `COMPATIBILITY_UNVERIFIED` fallback and the `critique` exchange (8 attacks hold) | stopped before `backend.source.apply` (no dry mode yet) | correct; the nested exchange and the fallback path work end to end | [record](runs/20260903-backend-feature-pro-subscription.md) |
| `content-unit` (Sonnet) | `system-design/lesson-01` | — | `content.generate` `BRIEF_UNBOUND` (MinIO unreachable offline) | correct stop; a Sonnet-class agent satisfied the contracts without retries | [record](runs/20260903-content-unit.md) |

Profiles bound versus models run: every branch ran on Claude Opus except `content-unit` (Claude Sonnet
standing in for `luna`); the tree now records profile equivalents in `resources/orchestrator.json` so a
stand-in is declared, not silent.

## What the round changed in the tree

Fixed from the records (see `tests/evidence/`): the `validate-response` CLI branch
detection; `route.schema.json` write roots; `PADDING-9`; the resolve law for a forbidden class;
`business.decide` `promise` and the claims schema for intent statements; Next-table edges and the
workflow adjacency and bound-role checks; `runtimeNeed: consume` presets; `response.json.reason`;
Grammar claims that disagreed with their CSS (`@starci/grammar@0.4.1`); the `session-only` worktree
policy for the fe route.

## Still open after round 1

- `backend.source.apply` has no `mode: dry`; the backend chain cannot be dry-run past architecture.
- A preview of the fe checkout must be served for `frontend.surface.audit` to produce a matrix; the
  runtime registry claimed `ready` while no port answered (`platform.operate` territory).
- Knowledge candidates with a single occurrence (not authored): canvas or media aspect ratio; a page-level
  idiom for the dashboard; `Rail` filling and scrolling at once.
- Orchestrator: who owns `declaredWriteRoots` for a bind (the workflow target should derive them); a
  `.claude` edit mid-session is invisible to `SOURCE_DRIFT` because the head does not move.

## Round 2 — 2026-09-03, tree at 1.0.3 → 1.1.0

Five dry sessions plus one real one that never became a session at all (the last row: a Codex
processor working beside the runtime on a live product). The five were each run by a processor agent
(Claude Opus standing in for every bound profile), every branch
through the four validators, source-writing steps in `mode: dry`, nothing written to a checkout or the
businesses worktree. The shared runtime was down on the machine (registry generation 6 says `ready`, ports
3000/3001 refuse), which every chain that bound `runtimeNeed: consume` met at step 1.

| Workflow | Target | Reached | Stopped by | Judged | Report |
| --- | --- | --- | --- | --- | --- |
| `frontend-refine` | `/[lang]/subscriptions` | bind `RUNTIME_NOT_READY` → resume (`runtimeNeed: none`) → direction done → resolve: `PADDING-9` selected, accent marker removed by the new law, 0 `RULE_MISSING` | resolve failed its own contract: `## Removed` cannot say "refused by a case"; a claim on a Grammar `className` has no attribute to land on; `unquote` ate a leading backtick | the knowledge fix worked; three gate defects exposed on new ground | [record](runs/20260903-r2-frontend-refine-subscriptions.md) |
| `backend-feature` | `pro-subscription` | bind `CHECKOUT_DIRTY` → resume → business → architecture + critique → `backend.source.apply` dry | `BUSINESS_AUTHORITY_MISSING`: the plan must cite `BA-<n>` and nothing in the tree publishes one | correct refusal; the dry path itself untested for a second round | [record](runs/20260903-r2-backend-feature-dry-apply.md) |
| `full-feature` | `pro-subscription` | step 1 parallel (be done, fe `RUNTIME_NOT_READY`) → resume → business → architecture waiting → done → step 5 parallel | `5/1` `CONTRACT_UNFROZEN` (the architecture decision carries no operations the backend plan can consume); `5/2` `CHANGE_LEVEL_AMBIGUOUS` (preset `new` on an existing route) | the parallel step and the nested exchange lay out and validate as designed; the architecture → backend handoff does not typecheck | [record](runs/20260903-r2-full-feature-parallel.md) |
| `frontend-with-uat` | `/[lang]/subscriptions` | step 1: be `CHECKOUT_DIRTY`, fe `RUNTIME_NOT_READY`; `uat.verify` probed out of chain | `INVALID_INPUT` at the request gate (no `requestedBy`, no flow, no admissions); `ADMISSION_MISSING` unreachable | correct stop; the uat validator could not accept its own lawful refusal | [record](runs/20260903-r2-frontend-with-uat-admission.md) |
| resume | `frontend-reconstruct`, learner dashboard | bind `RUNTIME_NOT_READY` → resume as step 2 with linkage → direction → resolve done | — (probe branches: an unregistered code fails both checks; `UNKNOWN_STOP` itself was unemittable) | resume layout holds; routing sent `runtime` to `external` while the operator's Next said `platform.operate`; `state.json` had no schema | [record](runs/20260903-r2-resume-blocked-branch.md) |
| none (a Codex processor, not a workflow) | one overview surface, `frontend-reconstruct` in intent | nothing: the session folder holds a `checkout/` that is not even a worktree — no `state.json`, no branch, no request, no response | nothing stopped it; it designed and coded by hand and committed | the run was entirely nonconformant and every validator was silent, because all four take a branch directory that never existed; three blocking canon violations reached the product's `main`. The gate that failed was the processor, not the validators | [record](runs/20260903-r2-codex-overview-nonconformance.md) |

## What the round changed in the tree

See `tests/evidence/` for the evidence notes. Gates: `unquote` only unquotes a fully quoted cell; `UNKNOWN_STOP`
needs no Stops-table row; `response.next` must be offered by the operator's Next table; `boundProfile` /
`ranProfile` recorded as a pair; `state.json` has `templates/step/state.schema.json` and `validate-request`
checks it and the resume linkage; `validate-workflows` requires every no-Default field to be preset or
declared under `asks`. Routing: `workspace.bind` sends `runtime` to `platform.operate`. Orchestrator: the
block lifecycle for `operator | user | external` answers, who converts to `UNKNOWN_STOP`, dry mode exempt from
the read-only policy and granted no write tools, `stoppedAt` for a done-but-invalid response. Workflows:
`runtimeNeed: consume` only in `frontend-with-uat`; `asks` generated from the Requirements tables. Kinds and
operators: `BA-<n>` retired for coverage-matrix dimensions; the architecture decision publishes the
operations the backend plan consumes; `## Removed` can cite a refusing case; uat.verify's validator accepts a
lawful refusal and reads the fe route; workspace.bind states the blocked-branch record, the
`mutationReadiness` derivation and refuses a route with no `gitPolicy`; a dry predecessor is
`PREDECESSOR_STALE` for quality.verify; an unpublished business `model` reaches architecture and backend.
Outside the tree: `.workspaces/projects/starci-academy/be.json` now declares `session-only`.

The Codex record above changed a second set of things, all of them about work that happens *beside* the
runtime rather than inside it. The session is now a precondition rather than a description
(`SKILL.md` Setup, `resources/orchestrator.json` → `session.lifecycle.create`, and the bootstrap
`bin/starci-skills.mjs` writes into `CLAUDE.md` and `AGENTS.md`, pinned by `install-cli.spec.mjs`);
`SESSION_MISSING` exists, scoped to the two source-writing operators and `git.publish`, domain
`caller`, route `user`; `git.publish` binds the session's receipts before it merges and refuses a
session branch with no `done` source-application response carrying its head, or with a declared
`frontend.surface.audit` or `uat.verify` step whose branch or screenshots are missing;
`frontend.direction.decide` renders every candidate it forms under `new` and `reconstruct`; and every
example workflow that applies frontend source now proves it — `apply` → `workspace.bind` (fe,
`runtimeNeed: consume`) → `audit` → `quality` → `uat` → `publish` — with
`scripts/validate-workflows.mjs` refusing a chain that publishes an applied surface with either proof
missing. `runtimeNeed: consume` moved from step 1 of `frontend-with-uat` to the post-apply bind of all
five delivery chains, which is also where it belongs: the surface that must be served is the one the
write just produced.

## When UAT runs

`uat.verify` is the only operator that drives a real product as a real person, and it is the easiest
one to skip quietly, so the preconditions are written here as well as in
[Getting started](../docs/getting-started.mdx):

- **A workflow with a `uat.verify` step.** After this round that is `frontend-refine`,
  `frontend-reconstruct`, `frontend-new-surface`, `frontend-with-uat` and `full-feature` — every
  example that writes frontend source under `mode: apply`. `backend-feature` has none and its `when`
  says why; `release` and `content-unit` write no surface.
- **A person who asked, by name.** `requestedBy`, `feature` and `flow` have no defaults, the workflow
  declares them under `asks`, and the branch refuses rather than inventing a requester.
- **A flow directory that already exists**: `uat/<flow>/flow.md` with the cases and their named
  assertions, `uat/<flow>/accounts.<env>.json` with a username, a role and a credential *name* per alias — never a
  secret — and `uat/<flow>/seed/` with the records a run namespaces.
- **A sealed shared password**, resolved by name from the credential roster at login and read nowhere
  else. No field of this operator can hold one, and its validator rejects a credential-shaped string
  anywhere in what it writes.
- **Both admissions at the pinned commit**: the `frontend-surface-audit` and the
  `quality-verification` taken at the same head, plus the `route` receipt whose endpoint the run
  drives.

Any of those missing is a stop, not a silence: no requester or no admission is `INVALID_INPUT` at the
request gate, no sealed credential is `PROVISIONING_UNAVAILABLE`, and nothing serving the product is
`RUNTIME_UNAVAILABLE`. On this machine round 2 met the first and the last, which is why no record in
this folder yet contains a UAT verdict — an absence that is now legible instead of invisible.

## Still open after round 2

- The `.claude` head is not in `request.json.contexts`, so a tree edit under a running session is invisible
  to `SOURCE_DRIFT` (both rounds saw it happen).
- Fingerprints: `routeFingerprint` now has a stated method; a general canonicalisation note for document
  fingerprints is not written.
- `declaredWriteRoots` still doubles as the dirt boundary; `toleratedDirtRoots` is proposed, not built.
- A nested exchange beside a running sibling is exercised by no published workflow.
- The v7-era result/snapshot pair under `.worktrees/_templates/uat` and the seven flow folders still do not
  match the flow layout `uat.verify` reads.
- The shared runtime registry claims `ready` with nothing listening; `platform.operate` territory.
- Session-first is a rule an agent obeys and a receipt gate `git.publish` enforces afterwards. Nothing
  can enforce it at the moment an agent opens an editor on a routed checkout, so a processor that
  ignores the bootstrap is still only caught at the publish — as the Codex record shows, after the
  work is done.
- The presentation violations that Codex run shipped were found by a person reading source, and the
  sweep that now catches them runs inside `frontend.source.apply` — the operator the run skipped. No
  `frontend.surface.audit` has ever looked at that surface rendered and no `uat.verify` has walked it,
  so the tree still knows nothing about how it behaves. Round 3 should do both.

## Round 3 — planned

`backend-feature` through the dry plan now that the authority citation and the operations handoff exist;
`frontend-refine` through a valid resolution into a dry apply; a served preview so `frontend.surface.audit`
produces a matrix; one `platform.operate` run against the stale registry.

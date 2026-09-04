# Tests — chain dry runs and their assessment

`tests/runs/` holds one record per real session of a chain: the request, every branch's status and
stop code, the validator output verbatim, the artifacts written, and the defects the run exposed. A
run is executed by a processor agent (Claude Opus in this round) that also plays each operator's agent;
every branch must pass `validate-request`, `validate-response` and the operator's own `validate.mjs`; a
valid `blocked` counts as green, a fabricated green is a failure. Source-writing steps ran with
`mode: dry`; nothing was written to a checkout or a businesses root; sessions live under
`.worktrees/sessions/` (gitignored) and are kept for inspection.

## Round 1 — 2026-09-03, tree at 1.0.2

| Workflow | Target | Reached | Stopped by | Judged | Report |
| --- | --- | --- | --- | --- | --- |
| `frontend-refine` | `/[lang]/subscriptions` (`ProSubscriptionBlock`) | bind → direction done | `interface.generate` `RULE_MISSING` (route block inset; accent marker on an unraised row) | correct stop; knowledge added (`PADDING-9`), resolve law added (forbidden class is removed) | [record](runs/20260903-frontend-refine-subscriptions.md) |
| `frontend-reconstruct` | learner dashboard | bind → direction → resolve (0 `RULE_MISSING`, 27 classes removed, 1 gap) → apply dry (5 paths, 0 `WRITE_REJECTED`) | `interface.audit` `RUNTIME_UNAVAILABLE` (no preview served) | correct stop; workflows now bind the fe checkout with `runtimeNeed: consume` | [record](runs/20260903-frontend-reconstruct-dashboard.md) |
| `frontend-new-surface` | `/games/billiards` (no promise exists) | bind done | `business.decide` `EVIDENCE_MISSING`; standalone direction `BUSINESS_REQUIRED` | correct refusal to draw an undecided page; design gap fixed: a greenfield promise now enters as the person's `promise` (intent claim) | [record](runs/20260903-frontend-new-surface-billiards.md) |
| `backend-feature` | `pro-subscription` | bind `CHECKOUT_DIRTY` → resume done → business (22 claims, 15 dimensions) → architecture done with `COMPATIBILITY_UNVERIFIED` fallback and the `critique` exchange (8 attacks hold) | stopped before `backend.generate` (no dry mode yet) | correct; the nested exchange and the fallback path work end to end | [record](runs/20260903-backend-feature-pro-subscription.md) |
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

- `backend.generate` has no `mode: dry`; the backend chain cannot be dry-run past architecture.
- A preview of the fe checkout must be served for `interface.audit` to produce a matrix; the
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
| `backend-feature` | `pro-subscription` | bind `CHECKOUT_DIRTY` → resume → business → architecture + critique → `backend.generate` dry | `BUSINESS_AUTHORITY_MISSING`: the plan must cite `BA-<n>` and nothing in the tree publishes one | correct refusal; the dry path itself untested for a second round | [record](runs/20260903-r2-backend-feature-dry-apply.md) |
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
`interface.audit` or `uat.verify` step whose branch or screenshots are missing;
`interface.generate` renders every candidate it forms under `new` and `reconstruct`; and every
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
  sweep that now catches them runs inside `interface.generate` — the operator the run skipped. No
  `interface.audit` has ever looked at that surface rendered and no `uat.verify` has walked it,
  so the tree still knows nothing about how it behaves. Round 3 should do both.

## Round 3 — 2026-09-04, five live Codex missions on 1.7–1.9, judged for 2.0

Not a dry run: five missions ran the tree for real on two products, on the Codex processor, and left
their session ledgers under `.worktrees/sessions/`. The record is
[`evidence/20260904-codex-five-tasks-retrospective.md`](evidence/20260904-codex-five-tasks-retrospective.md):
per mission its wall clock, steps, agents, waits, interrupts and compactions; every stop by kind
(walls nobody owned, walls the tree's own contracts raised, orchestration walls, misread rules); and
what held up. What the round changed is the 2.0 lineage line of the root index, one gate per wall.

Still open after round 3: the readiness operator and the chain route have self-tests and validators
but no live run yet; a served preview for `interface.audit` and a `runtime.serve` run against
the stale registry remain owed from round 2. The rebuild that followed — goal per mission, branch
and operator; one operator one job (21 packages); `inline`/`isolated` modes; plan/execute pairs;
full Sol; the planned chain — has validators, self-tests and specs, and no live Sol 5.6 mission yet:
that run is `TODO.md` item 3 and the evidence it leaves decides the publish.

Round 3 also retired the example workflows as runtime inputs. The eleven chains that used to live
under `workflows/` are planner fixtures now, one file per chain under `tests/chains/`: each carries
the mission whose done-when lines name the chain's outcomes, the operator order the 2.0.0 example
expected (rewritten to the split and merged operator ids), the end it declares, and a note on how it
was rewritten. `scripts/plan-chain.spec.mjs` plans every fixture from its mission on this tree's own
operator packages and proves the result passes `scripts/validate-chain.mjs`, carries every example
operator with no pair inverted, ends where the example ends, and puts a `<domain>.plan` before its
execute branch when the tree has one; a fixture naming an operator the tree does not carry yet is
skipped by name. They are evidence that the planner still reaches the shapes people used, not
shapes the entry picks from.
## Round 4 — 2026-09-05, the Nivo rerun on 2.0.0, judged for 2.0.2

One live mission rerun on 2.0.0 by an Opus processor met seven runtime defects in its first two
hours ([`evidence/20260905-nivo-recovery-on-2.0.0.md`](evidence/20260905-nivo-recovery-on-2.0.0.md)).
This cut closes D1 to D5, each behind a gate that is green at this head: D1, `workspace.bind` hands to
`architecture.decide` (`scripts/validate-routing.mjs`, `scripts/validate-operator.mjs`, the
`plan-chain.spec.mjs` fixtures); D2, a kind an imported slot carries is already produced for the
chain, in the plan and at the gate, credited only through the import gate
(`scripts/validate-chain.spec.mjs`, `scripts/plan-chain.spec.mjs`); D3, the plan fixes a branch's
requirements as `state.json.planned` before its request exists, the chain gate reads a bind's role
from the plan until the request is written, and a dispatched request that left the plan is refused
(`scripts/validate-session.spec.mjs`, `scripts/validate-chain.spec.mjs`, `templates/step/state.schema.json`);
D4, `gitPolicy` is typed as the object the route declaration carries and a wrong shape is refused by
a line naming the field, the shape and the declared value (`operators/workspace-bind/self-test.mjs`,
`scripts/workspace-checkout.spec.mjs`); D5, an origin's `next` is routing history and not a typed
output, so a 1.x producer whose receipt hands to a retired operator id imports while a missing typed
output still does not (`scripts/producer-import.spec.mjs`). D6 falls with D2, because a mission that
imports its decisions no longer routes through `business.decide`; D7 is closed by the Next rows the
2.0.2 branch already carries to every plan operator.

The replan proof on 2.0.2 itself
([`evidence/20260905-nivo-recovery-replan-on-2.0.2.md`](evidence/20260905-nivo-recovery-replan-on-2.0.2.md)):
on real ledgers, the recovery mission plans as `environment.preflight → workspace.bind#be →
backend.generate → quality.verify → business.reconcile` with architecture21 imported and no decide
branch, the same mission on 2.0.0 still refuses with the D1 wording, and three negative controls hold.
It exposed three narrower doors, closed in the same cut: D8, the plan carries the imported inputs a
branch binds (`state.json.planned[N/M].inputs`) so the chain gate is fed before the request exists
(`scripts/validate-chain.spec.mjs`); D9, an imported producer is judged by its own operator's law in
origin mode, never by today's session gates or catalogue (`scripts/validate-step.mjs#origin`,
`scripts/migration-contract.spec.mjs`); D10, the create order is stated: provisional state, import,
plan, rewrite (`resources/orchestrator.json#session.lifecycle`).

The Setup rerun of the same day
([`evidence/20260905-nivo-setup-uxui-on-2.0.0.md`](evidence/20260905-nivo-setup-uxui-on-2.0.0.md))
recorded the one wall that was an operator boundary rather than a defect: `library.update` required
the owner package and its consumer in one routed checkout and both the `plan` and the `consumer`
field, so an owner in one repository and a consumer in another could not run at all, not even
owner-only, and its preflight refused with `missing path: packages/grammar` before any write. This
cut answers it with the requirement `mode` — `full` unchanged, `publish` the owner half alone ending
at a recorded `library-release` whose registry publication stays a person's, `consume` the consumer
half alone against a release a sibling session produced and imported — so a chain route's owner
mission and the blocked consumer mission are two branches of the same operator. The gate is the
operator's own: `operators/library-update/validate.mjs` refuses a plan or a release input the mode
does not take, resolves a package path only where a package half runs, and refuses a receipt section
belonging to the half the branch never ran; `operators/library-update/self-test.mjs` binds each mode
over one routed checkout, refuses every cross-mode section and input, and proves that the D7 branch —
blocked because its plan names a package the checkout does not carry — validates as a lawful block.

## The findings ledger

From 2.0.1 a receipt is not the end of what an audit or a walk knows. Every done `interface.audit`
and `uat.verify` branch whose verdicts carry a failure appends its findings to
`knowledge/findings/<family>.jsonl` through `scripts/record-findings.mjs` (idempotent by finding id,
closures as second lines, the ledger's open lines materialized beside the receipt as the `findings`
kind), `scripts/validate-session.mjs#findingsLedgerErrors` refuses a session whose done audit or walk
the ledger does not hold, `interface.generate` answers every open finding for its surface under
`## Findings answered` or is refused, and `scripts/promote-findings.mjs` drafts a proposal and an
evidence stub here for any rule-less finding seen in two sessions, for a person to author under
`UPDATE.md`. Evidence notes the promoter writes land in this folder as
`evidence/<date>-findings-<slug>.md`; they are occurrences, never law, and a draft under
`knowledge/findings/proposals/` cites no ordinal until the rule exists.

## Round 4 — 2026-09-05, the walk runner

The evidence note on the surface-only control (`evidence/20260903-uat-verify-surface-only-control.md`)
records why a walk driven by hand cannot be told from a fake one by reading its receipt; 2.0.3 answers
it by taking the browser out of the agent's hands. `scripts/browser-walk.spec.mjs` proves the gate and
the sweep on synthetic walks with no browser at all — a selector target, a goto after step 1, a literal
secret, a capture taken before a sign-in redirect landed, a foreign URL and browser code are each
refused by name — and proves the runner itself by one real run: a static page with a labelled field, a
button and a heading is served on loopback by the tree's own `scripts/host-artifacts.mjs`, a walk
fills, clicks, expects and captures it, and the run leaves the walk beside its result at the walk's
digest, the ledger, the trace, the screenshot with its accessibility and DOM records, and a
`uat-capture` whose control is the walk's; a second walk names a button the page does not have and
stops at that step with the rest skipped. That run needs the host's Playwright install and is skipped,
with the runner's own wording as the reason, on a host that has none — it is never faked. The three
operator self-tests carry the same lawful walk and the same refusals through `uat.verify`,
`interface.audit` and `environment.preflight`.

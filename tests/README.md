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

`api.verify` is the backend's half of the same law, and the recovery run on 2.0.3
([evidence](evidence/20260905-nivo-recovery-on-2.0.3.md)) is why it exists: a backend-only mission has no
walk, so its integration tests ran as gates inside the checkout and nothing ever exercised the API the
way a client would, leaving a green receipt over a product nobody had called. The API walk runs
whenever a delivery is served — one flow per branch, against the entry the `platform-operation-receipt`
attests and never a server it starts, as the account the `uat-account` names, on the namespace the
`seed-receipt` names — and it runs the repository's own end-to-end command exactly as the route's gate
plan declares it, never a script written for the branch, so its case rows are the runner's and a case
identifier standing in no runner output is refused rather than judged. Its preconditions are the served
head and the seed rather than a person's request: nothing serving is `RUNTIME_UNAVAILABLE`, a case the
runner reported failing or named and never ran is `API_CASE_FAILED` and goes back to the delivery owner,
and a record written outside the run namespace is `API_NAMESPACE_LEAK` and goes back to whoever declared
the fixture boundary. `backend-feature` now carries one and `backend-e2e` runs two of them on one served
head; the `e2e` gate of `quality.verify` stays exactly what it was — never run unless a person asked —
because a gate proves the code and a walk proves the product, and a receipt that shows only the first
cannot be told from one that showed both.

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

## The registry publication

`library.update` under mode `publish` used to end at a packed archive nobody had published, because
publishing was a person's authority; a repair therefore reached the owner and never reached the
consumer, which is what the Setup rerun measured
(`evidence/20260905-nivo-setup-uxui-on-2.0.3.md`). The mode now ends at the registry, and the operator's
self-test proves that ending without a registry, a network or npm: a publication is lawful only when it
names the registry serving exactly the version this branch packed under exactly that archive's
integrity, on package proofs that passed; a record left `pending` is lawful only where the request
preset `publish: false`; a published claim on red proofs, on a wrong integrity or a wrong version, and
one made by a mode that sends no archive anywhere, are each refused by name; the release contract
refuses a published record missing its registry, integrity or moment; and a refused publication
validates as a blocked receipt only while it carries the registry's own answer and never the credential
that resolved it. A `consume` branch binds a `published` release the way it binds a `pending` one — the
pending path is now the rare one, since a pending archive lives only inside the session that packed it.

## Publishing a business head

The Nivo rerun (`evidence/20260905-nivo-recovery-on-2.0.3.md`) ended with a feature directory saying
`implemented` while the head index of the businesses root still named the head it replaced, and with a
lineage pointing at a session file because no object had been archived — both correct refusals by a
write set that was the feature directory alone, and both left for a person. From 2.0.4 publishing the
head is `business.reconcile`'s own job and one write set: the feature directory, the canonical model
archived under its content address, and the feature's entry in the index naming that address with the
state the head now holds. `scripts/business-registry.mjs` is the single home for it — the RFC 8785
canonical form, the content address a store files an object under, the self-fingerprint a document
carries about itself, the plan, the apply and the verification — so an operator that publishes and a
validator that reads the publication back cannot drift apart; `scripts/business-registry.spec.mjs`
proves the two halves against each other on a real store, and the operator's self-test now builds a
businesses root per branch and refuses a head that was archived nowhere, an index still naming the old
head or the old state, an object that does not hash to the head it is filed under, a lineage naming a
session file or an object the store does not hold, and an index resting the promise on a source head no
fact claim binds.

## The services beside the runtime

The 2.0.0 catalogue dropped the row that used to read "observability, the Sonar service, tunnels" and
put nothing in its place, so a mission that needed one of those had no operator to name and no way to
say whether it was running. From 2.0.4 the environment declares them — `services` in
`readiness/initialization/stacks/environment.schema.json`, each with its kind, the state the
environment wants it in, the declared command that moves it, the probe that proves it and whether the
environment keeps it with a person — `environment.preflight` asks two questions of each and owns
neither, and `service.operate` moves exactly one of them per branch. Both halves are proved without a
service at all: the preflight's synthetic host now declares one service it wants up and one it wants
down, and refuses a probe run against the second, a probe skipped for the first, and a declaration
wall over a service the declaration carries; the service operator's self-test builds a host with three
declared services and refuses a receipt about another service, a kind the declaration does not give, an
`up` observed without its probe, a holder that is a name rather than a pid, a `down` whose probe
answered or that still claims a holder, an attestation that ran the declared command, a move that
recorded neither a command nor a no-op, a person-held service brought up anyway, an approval naming a
declaration that moved, and a receipt that printed the command's credential. `tests/chains/service-fanout.json`
is the planner's half: two services named on two done-when lines become two branches of one operator,
because the enumeration is the declaration's and there is no plan to fan out over.

## What a source-writing branch did to its checkout

The Nivo reruns on 2.0.3 (`evidence/20260905-nivo-recovery-on-2.0.3.md`,
`evidence/20260905-nivo-setup-uxui-on-2.0.3.md`) left four traces nobody read: a branch that ran
`git stash push` inside a routed checkout and reported it itself because no gate could have found it,
a Setup branch that wrote the owner repair before its preflight ran, a bind receipt that could not be
re-validated once the chain had moved the head it recorded, and a session that deleted `node_modules`
by hand inside a worktree whose junction pointed at the installed tree several checkouts shared. From
2.0.4 each is a refusal with one home. `scripts/workspace-checkout.mjs` reads the checkout's own
history — `#reflogErrors` over the window between a branch's base and the commit it recorded,
`#junctionErrors` over its installed tree, `#sourceWriteErrors` over the `Preflight`, `Reflog before`
and `Reflog after` rows of `changes.md` — and every operator that writes source calls the last of
those, so a stash (whose reset entry outlives its own drop), a reset, a force, a clean, a checkout of
another branch, a rebase, an am, a first commit older than the recorded preflight, or a missing mark
each refuse the receipt by name; a bind is judged against the head it recorded, which a later branch
of the same chain is allowed to have advanced past and an unrelated commit or another branch is not.
`scripts/workspace-checkout.spec.mjs` proves all of it on temporary repositories — the worktree coming
into being is not read as the branch gaining an entry, a stash and its drop are, and a shared installed
tree binds only where the request declared `sharedInstall` — and the five operator self-tests carry the
same refusals through their own receipts.

## What a run decided not to prove

A mission's verification covers the surfaces its done-when journey passes through, and everything else
is written down rather than skipped in silence. `scripts/unchecked.spec.mjs` proves the ledger under
`@worktrees/unchecked` in both directions: an absent `tier` reads as `journey` so a plan written before the
field stays fully verified; an entry's id is derived from what it is about, so recording one receipt
twice appends nothing and a lane that finally covers it resolves the line it already has; no line is
ever edited, a resolution is a second line, and coverage taken and then dropped is unchecked again; a line
that does not match the kind is refused rather than written; a plan writes one entry per deferred unit
carrying that unit's own reason and none of its own; an open entry is covered by planning the unit into the
journey or extended by planning it secondary, and a plan that drops it from the list is refused; and a
verification covers what it took in its lane while recording the states it deferred, at the heavier
tier, because a state of a surface the journey walks is not the same as a surface it never enters.
`scripts/unit-gate.spec.mjs` proves the other half at the request gate: a verifying lane is fanned out
over the journey units alone and a `secondary` unit dispatched to one is refused by name, while
`interface.generate` — absent from the lane map on purpose — still builds everything the plan lists.
The operator self-tests carry the same law through their own receipts: the two plans refuse a Tier cell
that disagrees with the unit list, a deferral with no reason, and a plan that defers every unit it
names; `interface.audit` refuses a journey surface deferring one of the four states a reader meets on
the way through it (`UNCHECKED_UNLAWFUL`) and a deferred state with no reason for the ledger to copy;
`business.reconcile` refuses a receipt that leaves an open entry out of its `## Unchecked` table and a head
republished `implemented` while a journey entry stands; and `release.deploy` refuses a production
release over a journey entry while passing one over a unit outside the journey. Each of those runs
against a synthetic ledger root, so no test reads or writes the host's own `@worktrees/unchecked`.

## Round 5 — 2026-09-05, the reachability session on 2.1.0, judged for 2.1.2

One live mission ran the whole ladder on 2.1.0 — two routed checkouts, two repairs, a serve, two
audits under the walk runner, the gates and a Playwright walk that reached the surface the 2.0.3 run
could not ([`evidence/20260905-nivo-reachability-fix.md`](evidence/20260905-nivo-reachability-fix.md))
— and met seven defects of the tree itself. Each is closed here by a gate with a spec, and the same
note is the evidence behind them.

The first two are one wall seen twice. The walk sweep read the runner's own record of the page
against the route's origin, so every capture of a page that draws an inline icon or runs a framework
in development tripped it — 3 lines on one branch, 15 on another, 64 on the walk — and
`record-findings.mjs`, which records only a receipt its operator's validator accepts, then refused all
three. The origin question is *did the agent go somewhere the route does not cover*, so it is now
asked of what the agent wrote: `scripts/validate-walk.mjs#PAGE_RECORD` keeps the DOM record, the
accessibility snapshot, the measurements and the host receipt out of that one check while the secret
and browser-code checks still read every byte a run left. `scripts/browser-walk.spec.mjs` proves both
directions — a page record carrying an SVG namespace and a framework's own link passes, the same URL
inside the capture record the agent wrote is refused, a walk naming another origin is refused, and a
token inside a page record is still swept — and `operators/interface-audit/self-test.mjs` carries a
driven receipt with those records through the operator's own validator and then through the ledger, so
the findings of a Playwright audit reach `knowledge/findings/<family>.jsonl` instead of being lost.

The third is a platform truth the tree had never met: `--stop <pid>` sent `SIGTERM`, which Node
implements on Windows as a hard terminate, so the artifact host died before it could complete its own
receipt and every sheet read as a server still running. A stop is now a marker the running server
polls and honours, named after the pid in the system temp folder — the one address a stopper holding
nothing but a pid can compute — and the signal is the last resort for a server that never answered
(`scripts/host-artifacts.mjs#requestStop`). `scripts/host-artifacts.spec.mjs` proves the receipt gains
its `stoppedAt`, the port is freed, a marker left by an earlier server with the same pid stops nobody,
and a pid nothing runs at is reported rather than faked.

The fourth is a memory with no room for half of what a mission proves: `brief.proven` admitted only
done-when lines, so a bind, a preflight or an audit that existed to enable a later branch had nowhere
to be recorded and lived in the transition notes. `templates/step/state.schema.json#/$defs/provenEntry`
now publishes both spellings and `scripts/validate-session.mjs#provenErrors` reads that pattern rather
than carrying a copy, resolving `prerequisite:<N/M>` through the same ledger as a done-when line: the
branch is the chain's, its goal was a prerequisite, and its `goalCheck` was accepted.

The fifth and sixth are the same misjudgement of a refine. `TASTE-12` Case 1 falsified every one of
them — a refine's direction names no reference standards by law, and a gating criterion cannot be
failed by a rule that does not apply — and a `fix-first` taste lens then demanded a direction round
over composition the delivery had never touched, which no chain could follow. `TASTE-12` Case 5 says
the criterion does not apply where the presentation delta is `none`: the row reads `n/a`, out of the
mean and out of the gating set. The lens itself is inherited rather than re-scored, cited under
`## Calibration` as `inherited` with the branch that scored it, and a `fix-first` carried that way
leaves the finding where it was raised and lets `next` name `quality.verify`
(`operators/interface-audit/validate.mjs`, its self-test's refine cases, and the widened
`## Calibration` cells of the audit contract). A fix-first on composition the delivery did touch keeps
the law it always had.

The seventh is the packing law. A two-route mission that publishes both could not end in one chain,
because after `uat.verify` no Next table permitted `quality.verify`, so the second route's gate — and
with it its publish — was left behind. `uat.verify` now hands to `quality.verify` when another routed
checkout still awaits its gates; the planner places a boundary once every remaining branch is itself a
boundary, so two publishes end a chain one after the other; and which branch of a repeated operator a
consumer reads is settled by the mission's own order of done-when lines, so the walk reads the gates
that precede it and not the ones that follow. `tests/chains/two-route-publish.json` is the proof:
nine done-when lines plan as preflight → the two binds → the backend and the frontend deliveries →
serve → audit → the frontend gates → the walk → the backend gates → both publishes, accepted by
`scripts/validate-chain.mjs`. `scripts/plan-chain.spec.mjs` now reads every example as a subsequence
of the planned steps, so an operator a fixture names twice must occupy two planned steps rather than
being matched twice against one.

## The support layer and the bank it drafts

A helper is not an operator, and the whole of that difference is refusable. `scripts/validate-helper.mjs`
reads each helper package the way `validate-operator` reads an operator one — Params against
Requirements, Steps against Stops against the registry, Outputs against the kind schemas, English
against its Vietnamese mirror — and adds the three refusals that make the support layer a support
layer: a Writes alias must be one `alias/alias.json` marks `helperWritable` (which no product source
route, no runtime owner and no publication target carries, so the registry answers rather than a
second list); a tool must be one of the modes `resources/orchestrator.json#helpers.tools` permits (which
is why `git` stops at `read` and every mode that writes a checkout, operates a runtime, publishes or
resolves a secret is absent rather than declared `never`); and the mode must be `inline` or `isolated`,
because a helper is entered from the person and there is no transcript to inherit.

`scripts/bank.spec.mjs` proves the bank itself: that the canonical form ignores key order, that the
approval hash covers the composition of the queue and the content of its missions and deliberately not
their progress — running and finishing leave it alone, adding, reordering, dropping and correcting a
goal do not — that `next` hands back one mission at a time and waits for a dependency whatever its
priority, that a drafted bank comes out ordered by what a mission waits for then by priority then by
id, and that a mission with no evidence ref, or with prose where an evidence ref belongs, is refused.
It also proves that a bank is swept for secret-shaped values exactly as a receipt is, through
`scripts/sweep-secrets.mjs` and no second list of patterns. The same file proves the session half: `validate-session.mjs#bankRefErrors` refuses a `mission.bankRef`
whose entry is gone, whose entry belongs to another session, whose goal is not the one the bank carries
word for word, or whose approval no longer covers the bank as it stands — while a mission that was
never banked answers to none of it.

`helpers/generate-banks/self-test.mjs` runs the first helper's own validator against a synthetic host:
one lawful bank of three missions drafted from an unchecked entry, a finding and a walk, one lawful
`BANK_EMPTY` stop that wrote nothing at all, and one mutation per law — a mission drafted from nothing,
a tier hint no unchecked entry backs, a queue that ignores its own dependency order, a bank that names
another run, a run that wrote product source, a stop that still left a bank behind. Every fixture lives
in a temporary host root, so no test reads or writes the machine's own `@worktrees/banked`.

## What the three live nivo sessions cost, and the seven gates that answer them

Three sessions on 2.1.2 and 2.1.3 — the AgentOS Setup journey proved and published, the workspace
auto-recovery journey proved through the repository's own e2e suite, and the operations-history repair
that closed its one finding — left seven defects of the tree rather than of the work
(`tests/evidence/20260905-nivo-setup-uat-on-2.1.2.md`, `20260905-nivo-recovery-e2e-on-2.1.2.md`,
`20260905-nivo-recovery-operations-fix-on-2.1.3.md`). Each is closed by a gate with a spec.

`operators/library-update/self-test.mjs` carries the consume the Setup session could not write: a
presentation release — one whose `library-release` names the family it realizes — consumed by a
consumer that composes that family and calls none of it. Its before and after halves are two
`interface.audit` branches of the same session rather than a spec written for the occasion, and
`auditProofErrors` holds them to being two halves of one proof: both refs resolve inside the session,
both judge the same claims by identifier, the family version each observed is the version its half
stands for, the before half's claims fail routed to the family owner as a grammar gap, the after
half's pass, and the after half measured the commit this branch committed. The mutations are the ways
a pair can be two audits of different things — the wrong version, a gap that was never a gap, an
app-side failure dressed as a family gap, a claim only one half judged, a release that repaired
nothing, an after half on another head. A release that names no family is still proved by a consumer
regression, and the plan gate says so.

`operators/identity-provision/self-test.mjs` proves the flow's whole cast in one branch: the plan
lists one account per alias and the published record publishes every one, under the username the plan
asked for and no alias the plan never named. `scripts/identity-provision.spec.mjs` proves the runner
half — two aliases created in order under one admin session and one plan hash, and a second alias that
fails its product sign-in leaving the first standing, reported as a mutation and the run blocked.

`scripts/browser-walk.spec.mjs` gains the fixture DOM of a refused sign-in: a password field, a field
whose type is text and whose name says password, a value that is a prefix of another, and prose that
merely contains the word. The DOM record and the accessibility snapshot are written with those values
masked, so the state a refused sign-in exists to prove is capturable rather than refused whole — and
the secret sweep still reads every byte of every file the run left.

`scripts/validate-session.spec.mjs` proves the scope line the person reads: a mission that plans
surfaces and then plans flows has two plans and one coverage, and the counts are both plans'. Reading
them off the newest plan alone is what let an all-journey second plan erase eleven deferred surfaces
from the line, while the ledger under `@worktrees/unchecked` still carried them; the check no longer
hides behind a `budget.units` that may be absent.

`operators/git-publish/self-test.mjs` proves the publish half of one law: the closed four-rule set the
runtime owner resolves an integration merge under, shared as `scripts/merge-resolution.mjs` and not
copied, now resolves the merge into the target branch too. A receipt records every resolved hunk with
its file, its range in the merged result and the rule, records `MERGE_RESOLVED` and `MERGE_GATED`, and
is refused for a rule nobody published, a range nobody can find again, one hunk resolved twice, a
fast-forward that claims to have resolved anything, and the incoming session's side taken in a file
its own `changes` receipt does not name.

`scripts/bank.spec.mjs` runs a synthetic bank of three missions end to end: taken one at a time in the
order the queue holds, the entry marked when the session opens and again when it ends, the third
waiting for the first, and the queue hash untouched by any of it. A session that ended blocked leaves
its entry `running`, which is how a mission that stopped for the person pauses the bank — and a done
session over an entry still marked running is refused.

`operators/interface-audit/self-test.mjs` closes the loop on the live hot-fix: an audit that names no
`feature` has no ledger to address and never reaches the surface, and an inherited lens still carries
no anchors of its own while a lens scored here still owes them.

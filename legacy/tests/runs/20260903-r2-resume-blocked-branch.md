# Run — resuming a blocked branch on `frontend-reconstruct` (2026-09-03, round 2)

A dry session of StarCi Skills 1.0.3 whose whole subject is the resume: drive `workspace.bind` on the
`starci-academy/fe` route into a real block, let `routing.json` answer, re-enter the operator as a new
step with the resume linkage the session layout prescribes, and carry the chain two steps further.
Session root `.worktrees/sessions/20260903-r2-resume/`, gitignored and kept on disk.

Every branch below names the profile its `operator.json` binds, and every branch was actually run by
**Claude Opus** standing in for that profile under `resources/orchestrator.json` `profileEquivalents`.
Two of the three operators bind `luna`, whose Claude equivalent is `sonnet`, so those branches ran on a
model one class above the binding; `frontend.direction.decide` binds `sol-fresh`, whose declared
equivalent *is* `opus`, so that one branch is the only place in this session where the stand-in and the
binding are the same class. No profile boundary was exercised anywhere. Nothing was committed, nothing
was written into the frontend checkout, no `.claude` runtime file was edited, and no git write command
was run anywhere.

## Request summary

| Field | Value |
| --- | --- |
| Workflow | `frontend-reconstruct` |
| Target | `/[lang]/dashboard` — `src/app/[lang]/dashboard/page.tsx` mounts `DashboardPage`, which composes every `src/components/blocks/dashboard/*` block |
| Frozen frontend head | `8d8ed9a1456e1e8ef9d1d6fd80a41c20a520d3a2` (`git -C D:\Repositories\starci-academy-fe rev-parse HEAD`, read-only, clean tree, branch `main`) |
| Knowledge head | `.claude` at `3d30a88e4b5a4e56fab5502b54621b738be5654b` |
| Chain requested | 1 `workspace.bind` (fe, `runtimeNeed: consume` from the workflow presets) → 2 `frontend.direction.decide` → 3 `frontend.presentation.resolve`, then stop |
| Chain actually run | 4 branches plus 2 labelled probes: 1 `workspace.bind` **blocked**, 2 `workspace.bind` **resume, done**, 3 `frontend.direction.decide` done, 4 `frontend.presentation.resolve` done; `step-9/parallel-1` and `step-9/parallel-2` are hand-written `UNKNOWN_STOP` probes and no part of the chain |
| Ended | by the test owner after the resolve; `frontend.source.apply`, `frontend.surface.audit`, `quality.verify` and `git.publish` were never dispatched |

Requirements came from the workflow presets plus each operator's stated defaults. One value the
orchestrator had to supply is `declaredWriteRoots` (round-1 gap G3 is unfixed; the workflow still
presets none). One value was deliberately *not* supplied: `gitPolicy` was left out so the documented
default — "the policy the route declaration carries" — would apply, which is how this run reached the
`session-only` policy that round 1 could not express.

---

## Step 1 — `workspace.bind`, parallel-1: the block

**Status** `blocked`. **Stop** `RUNTIME_NOT_READY`.
**Profile** `operator.json` binds `luna`; run by Claude Opus standing in (`luna` ↔ `sonnet`).

**Validators**

```text
$ node scripts/validate-request.mjs <session>/step-1/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-1/parallel-1
response valid

$ node scripts/validate-step.mjs <session>/step-1/parallel-1
step valid

$ node operators/workspace-bind/validate.mjs <session>/step-1/parallel-1
valid workspace.bind branch
```

**Artifacts written** `response/response.json` only.

**Why this block and not the other one.** The block was chosen by the checkout, not staged. The first
candidate was `CHECKOUT_DIRTY`, the code round 1 exercised on the backend route: it needs something
dirty outside the declared write roots. The frontend checkout offers nothing —
`git -C D:\Repositories\starci-academy-fe status --porcelain` prints zero lines — so steps 1 to 4 of the
operator all pass and there is no honest way to make step 4 stop. The second candidate is the one the
machine actually hands over. `frontend-reconstruct` presets `runtimeNeed: consume`, so step 5 runs, and
step 5 reads the shared owner registry:

```text
$ cat .worktrees/sessions/central-runtime/owner.json   # excerpt
  "generation": 6,
  "status": "ready",
  "endpoints": { "frontend": "http://localhost:3000", "api": "http://localhost:3001", "identity": "http://localhost:8080" },
  "updatedAt": "2026-09-01T19:54:08.2134007Z"

$ node -e "<TCP connect to 127.0.0.1 on each declared port>"
3000:ECONNREFUSED
3001:ECONNREFUSED
8080:open
```

The registry publishes a `ready` generation two days old whose frontend and API listeners are gone;
only the identity container answers. The operator's own law settles what that means: a registry that is
"missing, stale, or not ready while the caller must consume it" is `RUNTIME_NOT_READY`, the caller is a
consumer and never an owner, and a stale endpoint authority "is refused rather than recomputed into
agreement". So the branch stops, and it stops without touching anything — no process started, no port
claimed, no fingerprint recomputed.

**Routing, resolved mechanically.** The domain lookup was run rather than read:

```text
RUNTIME_NOT_READY -> domain runtime -> routing.json routes["workspace.bind"]["runtime"] = {"kind":"external"}  (disposition terminate, home operators/workspace-bind/errors.json, mayEmit true)
CHECKOUT_DIRTY    -> domain source  -> routing.json routes["workspace.bind"]["source"]  = {"kind":"resume"}    (disposition terminate, home operators/workspace-bind/errors.json, mayEmit true)
```

That is the run's first real finding, and it is a contradiction rather than a surprise. `routing.json`
says `external`: stop, and report what outside the runtime must change. The same operator's `## Next`
table says the opposite — "the runtime owner is missing or not ready and one coordination request must
be raised → `platform.operate`" — and the code's own `resume` text agrees with the table, not with the
map: "Raise one coordination request to the registered owner and wait for a ready generation." Three
statements about one stop, two different answers. The branch recorded `next: ["external"]`, because
`routing.json` is the closed map the loop reads and a `## Next` table is checked by nothing. See D1.

**What a blocked branch can say.** `response.json` is the entire record; `workspace.bind` declares no
output kind for a stop and the `Findings` vocabulary of `workspace-route-binding` has no code that can
state a blocking condition. The `reason` field added in 1.0.2 is what saved this branch from being a
bare code: the probe results, the registry excerpt and the refusal to recompute all live in one 1 100
character paragraph of free prose. That is better than round 1's silence and it is still prose. See D4.

## Step 2 — `workspace.bind`, parallel-1 of step 2: the resume

**Status** `done`. No stop. No fallbacks.
**Profile** `luna`; run by Claude Opus standing in.

**Validators**

```text
$ node scripts/validate-request.mjs <session>/step-2/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-2/parallel-1
response valid

$ node scripts/validate-step.mjs <session>/step-2/parallel-1
step valid

$ node operators/workspace-bind/validate.mjs <session>/step-2/parallel-1
valid workspace.bind branch
```

**Artifacts written** `response/response.md` (kind `workspace-route-binding`),
`response/data/route.json` (kind `route`), `response/response.json`.

**How the resume is laid out.** `resources/orchestrator.json` prescribes it in one sentence —
"a blocked branch re-enters the same operator as a new agent in `step-(N+1)/parallel-1`, with
`request.json.resume` naming the blocked step and parallel; the blocked branch stays on disk as
evidence" — and this run followed it literally. The new request carries the linkage twice, in two
different places, because the tree asks for it twice:

```json
{
  "step": 2, "parallel": 1,
  "requirements": { "…": "…", "runtimeNeed": "none", "resume": "step-1-parallel-1-runtime-not-ready" },
  "resume": { "step": 1, "parallel": 1, "token": "step-1-parallel-1-runtime-not-ready" }
}
```

The top-level `resume` object is the gate's field, checked by `templates/step/request.schema.json`; the
`requirements.resume` token is `workspace.bind`'s own declared Requirements field, checked by
`validate-request` against the operator's Requirements table. Neither validator compares them, and
neither checks that `resume.step` names a branch that is actually blocked, or that it blocked in *this*
session — the linkage is convention held up by two unrelated schemas. It is nonetheless the same shape
round 1 used on the backend route, so the convention is at least stable across runs.

**The delta, stated plainly.** Exactly one requirement moved: `runtimeNeed` from `consume` to `none`.
Nothing was done to the runtime — the owner registry still publishes a ready generation with no
listeners, and this operator may not start one. What changed is what the chain asks for: this session
ends at `frontend.presentation.resolve` and never dispatches `frontend.surface.audit`, the only
operator in `frontend-reconstruct` that needs a served route, so binding endpoints was a requirement of
the *workflow preset*, not of the work actually being done. The receipt says so in its own opening
paragraph rather than hiding the reduction, and the reduction is real: this chain can no longer reach
an audit, and the record says that too.

That makes the resume delta honest under `NO_PROGRESS`, whose meaning is "a resume adds no evidence,
constraint, inventory, or approval delta". A narrowed requirement is a constraint delta. It is worth
naming what it is *not*: it is not the outside party changing anything, which is what `routing.json`'s
`external` kind asked for. See D2.

**What the branch bound.** `starci-academy/fe` → the sibling checkout `D:\Repositories\starci-academy-fe`,
branch `main`, head `8d8ed9a1…`, repository kind `sibling` (so the relative directory
`starci-academy-fe` is carried, as the validator requires), `authorityRoots.businesses` `null` because a
sibling checkout carries no business authority, `runtime` `null` because `runtimeNeed` is now `none`.
Steps 1 to 4 were re-run rather than reused: the resume rule admits only unchanged fingerprinted
observations, and the checkout could have moved between the two branches. It had not.

Two things this binding could express that round 1's could not. The routed policy is
`worktreeBranches: session-only`, taken from the declaration instead of invented, and
`templates/kinds/route.schema.json` now accepts it — round-1 defect O1 is fixed, and this is the first
run to prove it end to end. And `writeRoots` is no longer forced to hold at least one entry in the
schema (round-1 O10, fixed on the data side). The receipt side of O10 is not fixed: see D11.

What it still cannot express is that the policy *is* `session-only`. `## Findings` publishes
`WORKTREE_BRANCH_FORBIDDEN` and no counterpart, and `operators/workspace-bind/validate.mjs` requires the
forbidden finding and demands nothing for the other value, so the only policy under which a
source-writing operator may run at all is the one the receipt is silent about. See D3.

The hydrated route still records head `14e0c20f…`, two commits behind the observed `8d8ed9a1…`. The
observed head is the binding and the stale record is prose in the receipt, exactly as in round 1,
because no finding code covers it.

## Step 3 — `frontend.direction.decide`, parallel-1

**Status** `done`. No stop. No fallbacks.
**Profile** `operator.json` binds `sol-fresh`; run by Claude Opus, which is `sol-fresh`'s declared
equivalent.

**Validators**

```text
$ node scripts/validate-request.mjs <session>/step-3/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-3/parallel-1
response valid

$ node scripts/validate-step.mjs <session>/step-3/parallel-1
step valid

$ node operators/frontend-direction-decide/validate.mjs <session>/step-3/parallel-1
valid frontend.direction.decide branch
```

**Artifacts written** `response/response.md` (kind `frontend-direction-decision`),
`response/data/coverage.json` (kind `ui-coverage`), `response/response.json`. No candidate page and no
image: one candidate under `preview: no` renders none, and the validator rejects a page in that
configuration.

**The decision, and what re-observation changed.** The direction is `dashboard-rail-owned-column`, the
same one round 1 decided on this surface: the dashboard hand-builds a rail beside a main track in
application class names and an application `matchMedia` listener, while `PrimaryRailLayout` already owns
that relationship and is live three times in the same checkout. Nineteen UI-contract elements, eight
regions, six states, three responsive branches; thirteen falsification attacks, all `holds`; no
reference row and no image row.

The re-observation is not a formality and it produced two new evidence rows. Between round 1's head and
this one the frontend moved two commits, and `git diff --stat 14e0c20f..8d8ed9a1` touches nine files, all
of them under `packages/grammar/`. Every dashboard artifact the direction cites is byte-identical, so
every observation carries forward with its head suffix rewritten to `@8d8ed9a` — and two rows were added
to say exactly that, rather than letting an unchanged citation imply an unchecked one. The one
substantive move is `@starci/grammar` 0.4.0 → 0.4.2, in which `HorizontalScrollRegion` gained
`data-contract="PADDING-1 MEASURE-3 OVERFLOW-3 OVERFLOW-5"` and its own class; that is the round-1
Grammar-claims fix landing, and it changes step 4.

One row this run had to correct rather than copy: round 1 cited the composition inventory as
`.claude/knowledge/grammars/starci/DNA.md:95-135@14e0c20`, a `.claude` file pinned to the *frontend*
head. `.claude` is its own repository and the evidence cell has no notion of which checkout a head
belongs to; the citation is now `DNA.md:107-125@3d30a88`, the `.claude` head. Nothing in the contract
caught the original — the cell pattern is `` `path@sha` `` and any 7-to-40 hex string satisfies it.

**Images, judged on a runtime that could not have made one.** The `## Images` table is empty because the
judgement is that no region of this surface reads empty. That judgement is real, but it was made on a
runtime where the decision was moot: `operator.json` grants `@tools/imagegen: judged`, and
`profileEquivalents.imageVersusVisualize` restricts image generation to OpenAI profiles, so the Claude
stand-in could not have produced artwork whatever it decided. The contract can record that outcome — a
row whose `File` cell is `—` is legal — but nothing forced it, and an empty table now means both "no
image was needed" and "no image was possible" with no way to tell them apart.

## Step 4 — `frontend.presentation.resolve`, parallel-1

**Status** `done`. No stop. No fallbacks. `contractEmission: on`, `maxRounds: 2`.
**Profile** `operator.json` binds `luna`; run by Claude Opus standing in.

**Validators**

```text
$ node scripts/validate-request.mjs <session>/step-4/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-4/parallel-1
response valid

$ node scripts/validate-step.mjs <session>/step-4/parallel-1
step valid

$ node operators/frontend-presentation-resolve/validate.mjs <session>/step-4/parallel-1
valid frontend.presentation.resolve branch
```

**Artifacts written** `response/response.md` (kind `frontend-presentation-resolution`),
`response/data/inventory.json` (kind `inventory`),
`response/artifacts/dashboard.resolved.tsx` (kind `resolved-tree`), `response/response.json`.

**The resolution.** Eleven owner-map rows, five Grammar-owned and six application-owned; three rule ids
(`GAP-4`, `GAP-5`, `MEASURE-2`), seven class tokens, twenty-seven removals across six nodes. Zero
`RULE_MISSING`: every property the walk reached resolved to a published case. The ordinal-to-step check
passed — `GAP-5` renders `gap-6`, never `gap-5` — and the operator's validator confirmed that every
inventory class appears in the resolved tree and every applied rule is claimed under a `data-contract`
token.

**The one row the Grammar move changed.** Round 1 recorded a single `## Gaps` row and justified it with
two clauses: Common exposes no outside-in path for bounding the contribution calendar's inline axis, *and*
`HorizontalScrollRegion` owns nothing an audit can measure. The second clause is now false. At
`@starci/grammar` 0.4.2 the composite carries `starci-core-horizontal-scroll-region` and claims
`MEASURE-3 OVERFLOW-3 OVERFLOW-5 PADDING-1`, and `knowledge/grammars/starci/DNA.md:117@3d30a88` records
exactly those four rules against it. The gap survives on its first clause alone, reworded: only the block
that renders the calendar can compose the region, and `OverviewContributions` publishes no prop through
which this surface could ask. The receipt row and `inventory.gaps[0].missingPath` carry the identical new
sentence, which is what the operator's validator compares.

Two round-1 knowledge gaps were re-checked at `3d30a88` and are still open: `padding.md:64-65` still lists
`` `Rail` | body, inset="content" `` twice, once as `PADDING-3` and once as `PADDING-5`, so a receipt
claiming the rail's inset still cannot say which (round-1 K3); and `overflow.md:55` still conditions
`Rail` on `height!="fill"` for `OVERFLOW-3` while the owned tables condition it on `height="fill"` for
`MEASURE-6`, so a rail still cannot both fill and scroll (round-1 K2). `PADDING-9` did land and is
published at `padding.md:251`.

---

## What `state.json` records across the block and the resume

`state.json` is the only file that spans both branches, and reading it back is the cleanest way to see
what the layout does and does not carry.

| Key | Across the block and the resume |
| --- | --- |
| `chain` | `[["1/1"],["2/1"],["3/1"],["4/1"]]` — four positions for a three-operator workflow. The block consumed a chain position, so `frontend.direction.decide` is step 3 of a chain whose workflow calls it step 2. Round-1 orchestrator gap 1, unfixed. |
| `steps` | `1/1` and `2/1` both map to `workspace.bind`. Nothing in the documented shape says the second is the first again rather than a genuine second bind of a different route. |
| `current` | `4/1`. It moved past the block without recording that a block happened. |
| `requestHashes` | six entries, one per request including both probes; `validate-request` compared each and all six matched. This is the one part of `state.json` any script actually reads. |
| `leases` | four, each naming the bound profile and the stand-in: `workspace.bind@luna-profile/run-by-claude-opus`. The lease is prose; nothing checks it against `operator.json`. |
| `status` | `stopped-by-test-owner`, a value the documented enum (`running \| blocked \| done`) does not contain. Round 1 wrote the same value; nothing rejected it either time. |

Two keys were invented for this run because the block and the resume are otherwise invisible:
`resumes: { "2/1": { "resumes": "1/1", "stop": "RUNTIME_NOT_READY", "delta": "runtimeNeed consume -> none" } }`
and `probes`, which labels `9/1` and `9/2` as deliberate non-chain branches. Both were accepted without
complaint, which is the finding: `state.json` has no schema, so a resume can be recorded in an invented
key or not recorded at all, and both pass. See D10.

## What `validate-step` says about the blocked step versus the resumed step

Both say `step valid`, and that is correct rather than lenient. `validate-step` runs
`validate-request` and then `validate-response` over the same branch, and `validate-response` enforces a
required Output only when `response.status === 'done'`:

```js
if (files.length === 0) { if (isYes(row.required) && response.status === 'done') errors.push(`… required output ${kind} is not in fields`); continue; }
```

So the blocked branch, whose `fields` is `{}` and which has neither `response.md` nor `route.json`, is
green on exactly the terms the tree intends: a valid block is a valid outcome. The resumed branch is
green on the opposite terms — both required outputs present, the markdown checked against
`workspace-route-binding.contract.json`, the data checked against `route.schema.json`, and then
`operators/workspace-bind/validate.mjs` cross-reading the two against each other, twenty-odd assertions
deep.

What the two verdicts do **not** distinguish is anything about the resume itself. `validate-step` never
looks at `request.json.resume`; it does not check that `1/1` is blocked, that `2/1` names it, that the
operator ids match, that the delta is non-empty, or that the resumed branch belongs to the same session.
A `step-2` request with `resume: {"step": 47, "parallel": 3, "token": "x"}` would pass both halves. The
resume is enforced by the orchestrator's prose and by nothing executable.

One asymmetry worth naming: the blocked branch is green *because* it is blocked, so a fabricated block
is the cheapest possible green in this tree. The only thing standing between a real stop and an invented
one is the `reason` paragraph, which no validator reads.

## The `UNKNOWN_STOP` probe — two labelled branches, kept

The question was whether the `UNKNOWN_STOP` path is reachable by hand-writing a response with a code
outside the registry. It is not, and neither is `UNKNOWN_STOP` itself. Both branches are kept under
`step-9/`, labelled in `state.json.probes`, and are no part of the chain.

`operators/errors.json` and `operators/INDEX.md` both publish the rule: "A runtime that meets a code the
merged registry does not list terminates with `UNKNOWN_STOP`." `UNKNOWN_STOP` is registered with
`scope: ["*"]`, `domain: caller`, `disposition: terminate`.

**Probe A — `step-9/parallel-1`, an unregistered code.** The response stops with
`RUNTIME_GENERATION_STALE`, a plausible name for what step 1 actually observed, registered nowhere.

```text
$ node scripts/validate-request.mjs <session>/step-9/parallel-1
request valid
exit=0

$ node scripts/validate-response.mjs <session>/step-9/parallel-1
step-9/parallel-1/response/response.json: stop RUNTIME_GENERATION_STALE is not in the Stops table of workspace.bind
step-9/parallel-1/response/response.json: stop RUNTIME_GENERATION_STALE is not a registered code workspace.bind may emit
exit=1

$ node scripts/validate-step.mjs <session>/step-9/parallel-1
step-9/parallel-1/response/response.json: stop RUNTIME_GENERATION_STALE is not in the Stops table of workspace.bind
step-9/parallel-1/response/response.json: stop RUNTIME_GENERATION_STALE is not a registered code workspace.bind may emit
exit=1

$ node operators/workspace-bind/validate.mjs <session>/step-9/parallel-1
step-9/parallel-1/response/response.json: stop RUNTIME_GENERATION_STALE is not in the Stops table of workspace.bind
step-9/parallel-1/response/response.json: stop RUNTIME_GENERATION_STALE is not a registered code workspace.bind may emit
exit=1
```

Two rejections, both correct and both specific. No conversion happens: the response does not become an
`UNKNOWN_STOP`, it becomes an invalid response, and per `SKILL.md` an invalid response does not route at
all. So the prescribed landing place is never reached from the direction the rule describes.

**Probe B — `step-9/parallel-2`, `UNKNOWN_STOP` itself.** If the runtime performed the conversion the
note prescribes and wrote the registered code, this is what would happen:

```text
$ node scripts/validate-request.mjs <session>/step-9/parallel-2
request valid
exit=0

$ node scripts/validate-response.mjs <session>/step-9/parallel-2
step-9/parallel-2/response/response.json: stop UNKNOWN_STOP is not in the Stops table of workspace.bind
exit=1

$ node scripts/validate-step.mjs <session>/step-9/parallel-2
step-9/parallel-2/response/response.json: stop UNKNOWN_STOP is not in the Stops table of workspace.bind
exit=1

$ node operators/workspace-bind/validate.mjs <session>/step-9/parallel-2
step-9/parallel-2/response/response.json: stop UNKNOWN_STOP is not in the Stops table of workspace.bind
exit=1
```

The registry check passes — the code *is* registered and `workspace.bind` *may* emit it — and the Stops
table check fails, because `validate-response` requires every stop to appear in the emitting operator's
own `## Stops` table and no operator's table lists it:

```text
$ node -e "<load every operator.md package and scan its ## Stops table>"
operators whose ## Stops table lists UNKNOWN_STOP: none of 14
```

So `UNKNOWN_STOP` is a registered, routed, documented code that no operator in the tree can legally
emit. Its route exists and is answered (`workspace.bind`/`caller` → `{"kind":"user"}`); nothing can ever
take it. See D5 and D6.

---

# Defects and proposed fixes

No file under `.claude/` was edited by this run. Each entry names the file, the evidence, and the exact
change proposed.

## D1 — `routing.json` and `workspace.bind`'s own `## Next` disagree about a runtime stop

**File** `routing.json`; `operators/workspace-bind/operator.md` (`## Next`);
`operators/workspace-bind/errors.json` (`RUNTIME_NOT_READY.resume`, `ENDPOINT_AUTHORITY_STALE.resume`).
**Evidence** `routes["workspace.bind"]["runtime"] = {"kind":"external"}`, while the `## Next` table row
reads "the runtime owner is missing or not ready and one coordination request must be raised |
`platform.operate`", and the code's own resume text reads "Raise one coordination request to the
registered owner and wait for a ready generation". `ENDPOINT_AUTHORITY_STALE` shares the domain and its
resume text is "Recompute the authority fingerprint at its owner" — also an owner action, not an outside
one. `frontend.surface.audit` routes its `platform` domain to `platform.operate` for the same real-world
condition.
**Proposed change** in `routing.json`, replace

```json
"workspace.bind": { "…": "…", "runtime": { "kind": "external" } }
```

with

```json
"workspace.bind": { "…": "…", "runtime": { "kind": "operator", "target": "platform.operate" } }
```

`platform.operate` is an operator in this tree, it owns the runtime owner registry
(`alias/alias.json` lists it as the sole writer of `@worktrees/sessions/central-runtime`), and routing
there makes the operator's `## Next` table, the two codes' resume texts and the map say one thing.
Rejected alternative: deleting the `## Next` row, which would leave both codes' resume texts describing
an action no route can reach.

## D2 — a `user` or `external` stop has no documented way back into the chain, yet the lifecycle prescribes one

**File** `resources/orchestrator.json` (`session.lifecycle.block`, `handoff.resume`); `SKILL.md`
(`## The loop`); `routing.json` (`kinds`).
**Evidence** `routing.json` defines `user` and `external` as "Stop." — full stop, no continuation.
`resources/orchestrator.json` defines the block lifecycle without qualification: "status blocked keeps
the session on disk; the orchestrator asks the person for the field the stop names, then re-enters the
operator in step-(N+1)/parallel-1 with resume set." This session's step 2 is legal under the second
sentence and has no standing under the first. Nothing distinguishes "the person supplied the field the
stop named" from "the person overrode a workflow preset to route around the stop", which is closer to
what actually happened here.
**Proposed change** in `resources/orchestrator.json`, `session.lifecycle`, replace the `block` entry
with:

```text
"block: status blocked keeps the session on disk. When routing.json answers the stop's domain with kind resume, the orchestrator asks the person for the field the stop names and re-enters the operator in step-(N+1)/parallel-1 with resume set. When it answers operator, user or external, the branch stays blocked and the chain continues only after the named operator, the person, or the outside party has changed something the stop names; that continuation is also a step-(N+1)/parallel-1 re-entry with resume set, and request.json must carry the changed requirement or input, because a re-entry with no delta is NO_PROGRESS."
```

## D3 — a `session-only` route cannot say so in its own receipt

**File** `templates/kinds/workspace-route-binding.contract.json` (`## Findings` `Code` enum);
`operators/workspace-bind/validate.mjs`.
**Evidence** the enum is
`^`(ROUTE_HYDRATED_FROM_PORTABLE|RUNTIME_CONSUMED_NOT_OWNED|IDENTITY_ROSTER_SEALED|PROVENANCE_HEAD_BOUND|CACHED_ROUTE_REUSED|WORKTREE_BRANCH_FORBIDDEN)`$`,
and the validator enforces `WORKTREE_BRANCH_FORBIDDEN` for a forbidden policy and nothing for
`session-only`. `operator.md` describes both values in the same sentence, so the asymmetry is in the
contract, not in the operator's law. This run's step 2 binds `session-only` and its `## Findings` table
says nothing about the policy at all.
**Proposed change** add `WORKTREE_BRANCH_SESSION_ONLY` to the enum, and in
`operators/workspace-bind/validate.mjs` add the mirror of the existing check, immediately after it:

```js
if (route.gitPolicy.worktreeBranches === 'session-only' && !findingKeys.has(`WORKTREE_BRANCH_SESSION_ONLY|${route.gitPolicy.mutationBranch}`)) errors.push('response/response.md: a session-only worktree policy must be recorded on the bound route');
```

## D4 — a blocked `workspace.bind` branch has no law about what it may record

**File** `operators/workspace-bind/operator.md` (`## Nothing is repaired here`).
**Evidence** the operator declares two Outputs, both required only for a `done` branch, and no output
kind covers a stop; `workspace-route-binding`'s `Findings` vocabulary contains no blocking code. This
run's step 1 therefore put the registry excerpt and the three port probes into `response.json.reason`,
a free-text field no validator reads. Round 1 recorded the same shape as a defect and the 1.0.2 `reason`
field is the partial fix; what is still missing is any statement that `reason` is where the evidence
goes, so two runs may reasonably record nothing at all.
**Proposed change** append one sentence to the `## Nothing is repaired here` section of
`operators/workspace-bind/operator.md`:

```text
A blocked branch emits no receipt and no route: `response.json` is the whole record, and `reason` carries the observation that justified the stop, including the registry generation, the endpoints probed and what each answered.
```

## D5 — `UNKNOWN_STOP` is registered, routed, and unemittable

**File** `scripts/validate-response.mjs`; `operators/errors.json` (note); `operators/INDEX.md`
(generated, so `scripts/generate-operators-index.mjs`).
**Evidence** the verbatim probe-B output above, plus: no operator's `## Stops` table lists
`UNKNOWN_STOP` (none of 14, scanned through `loadOperatorPackages`). `validate-response` checks the Stops
table before the registry, so the check that would have passed never decides anything.
**Proposed change** in `scripts/validate-response.mjs`, inside the `status === 'blocked'` branch,
replace

```js
if (!stopsTable.has(response.stop)) errors.push(`${rel('response/response.json')}: stop ${response.stop} is not in the Stops table of ${op.id}`);
```

with

```js
// UNKNOWN_STOP is the one code no operator declares: it is what a runtime writes when it meets a code the merged registry does not list.
if (response.stop !== 'UNKNOWN_STOP' && !stopsTable.has(response.stop)) errors.push(`${rel('response/response.json')}: stop ${response.stop} is not in the Stops table of ${op.id}`);
```

and append to the `note` of `operators/errors.json`: "`UNKNOWN_STOP` is the one code an operator emits
without declaring it in its own `## Stops` table." Rejected alternative: adding the row to all fourteen
Stops tables, which would print a code no operator chooses fourteen times in the generated index.

## D6 — nobody owns the conversion to `UNKNOWN_STOP`

**File** `resources/orchestrator.json` (`handoff.stop`); `operators/errors.json` (note).
**Evidence** the rule is written in the passive ("a runtime that meets a code … terminates with
`UNKNOWN_STOP`") and no component performs it. The agent cannot: it does not read the merged registry
and has no way to know its code is unlisted before writing it. `validate-response` cannot: it validates
and never rewrites, and probe A shows what it does instead. Nothing else touches the response between
the two.
**Proposed change** replace `handoff.stop` in `resources/orchestrator.json` with:

```text
"stop": "response.json status blocked with stop = code; errors/ says whether the code terminates or falls back, and routing.json says where a terminated step hands to. A code the merged registry does not list is read by the orchestrator as UNKNOWN_STOP and routed on domain caller; the branch keeps the code the agent wrote as evidence and the orchestrator records the substitution in state.json."
```

## D7 — `routeFingerprint` still has no published canonicalization

**File** `templates/kinds/route.schema.json` (`routeFingerprint`).
**Evidence** `identityFingerprint` reproduced exactly across the two rounds
(`sha256:27a787a3…` = sha256 of `.workspaces/device-state.json`), so that one is de facto specified.
`routeFingerprint` did not: this run computed `sha256(portable bytes ‖ hydrated bytes)` =
`sha256:e76b23d1…`, and round 1 recorded `sha256:1e488f3b…` for the same pair of files under a method it
did not state. Two runs of one operator on one route produce incomparable fingerprints, which defeats
the purpose of the field. Carried over from round 1's backend record, defect 8, and still open.
**Proposed change** add a `description` to `routeFingerprint` in `templates/kinds/route.schema.json`:

```json
"routeFingerprint": { "$ref": "#/$defs/fingerprint", "description": "sha256 over the bytes of the portable declaration followed by the bytes of the hydrated route, each exactly as stored on disk, with no normalisation." }
```

and the same sentence for `identityFingerprint` naming `.workspaces/device-state.json`.

## D8 — `mutationReadiness` still has no stated derivation

**File** `operators/workspace-bind/operator.md` (Steps, row 4); `templates/kinds/route.schema.json`.
**Evidence** round-1 defect O11, unfixed: on the mutation branch both `ready` and `read-only` pass every
validator, and the two round-1 fe runs in the same session folder chose differently on the same route.
This run chose `ready` and nothing would have objected to `read-only`. The `session-only` policy adds a
second legal branch shape that the ambiguity now also covers.
**Proposed change** append to the paragraph under the Steps table in
`operators/workspace-bind/operator.md`:

```text
`mutationReadiness` is `ready` when the observed branch is one the routed policy permits a write on — the mutation branch, or a `session/<sessionId>` branch under `session-only` — and the working tree is clean outside the declared write roots; it is `read-only` in every other case, including a route bound with no declared write roots.
```

## D9 — the `runtimeNeed: consume` preset moved the guaranteed block from step 5 to step 1

**File** `workflows/frontend-reconstruct.json`.
**Evidence** round-1 gap G2 said the workflow guaranteed its own audit would block, and the fix added
`runtimeNeed: consume` to the `workspace.bind` preset. On this machine the shared runtime is down, so the
fix relocated the block to the chain's *first* step: `frontend.direction.decide`,
`frontend.presentation.resolve` and `frontend.source.apply` all need zero endpoints, and none of them can
run. That is strictly worse than blocking at the audit, which at least produced four decided steps first.
**Proposed change** in `workflows/frontend-reconstruct.json`, drop `"runtimeNeed": "consume"` from the
step-1 `workspace.bind` preset and let `frontend.surface.audit` raise its own `RUNTIME_UNAVAILABLE`,
which `routing.json` already answers with `platform.operate`. If a bound endpoint is genuinely wanted
before the audit, the honest shape is a second `workspace.bind` step immediately before it:

```json
[ { "operator": "workspace.bind", "requirements": { "role": "fe", "runtimeNeed": "consume" } } ],
[ { "operator": "frontend.surface.audit", "fanout": "matrix", "maxParallel": 3 } ]
```

`workflows/frontend-refine.json` and `frontend-new-surface.json` carry the same preset and want the same
change.

## D10 — `state.json` has no schema, so the resume is unrecorded and unrecordable

**File** `resources/orchestrator.json` (`session.manifest`); `scripts/`; `templates/step/`.
**Evidence** round-1 gap G6, unfixed. The documented `status` enum is `running | blocked | done` and both
rounds wrote `stopped-by-test-owner` unchallenged; this run added two keys (`resumes`, `probes`) that no
documented shape contains and nothing objected; `chain` gives a resume its own position with no way to
say it is a re-entry; and the only key any script reads is `requestHashes`.
**Proposed change** add `templates/step/state.schema.json` covering the fields
`resources/orchestrator.json` `session.manifest` already names, with `status` widened to
`running | blocked | done | stopped` and one new required-when-present key:

```json
"resumes": {
  "type": "object",
  "additionalProperties": {
    "type": "object", "additionalProperties": false,
    "required": ["resumes", "stop"],
    "properties": {
      "resumes": { "type": "string", "pattern": "^[0-9]+/[0-9]+$" },
      "stop": { "type": "string", "pattern": "^[A-Z][A-Z0-9_]+$" }
    }
  }
}
```

and validate `state.json` against it inside `scripts/validate-request.mjs`, which already opens the file
for the hash check, so no new read is added. With that key present, `validate-request` can also assert
what nothing asserts today: that a request carrying `resume: {step, parallel, token}` names a branch
`state.json` records as blocked, and that the resumed branch runs the same `operatorId`.

## D11 — a read-only binding is representable in the data and not in the receipt

**File** `templates/kinds/workspace-route-binding.contract.json` (`## Write roots`).
**Evidence** `route.schema.json` now allows `writeRoots` with `minItems: 0` (round-1 O10, fixed), while
the document contract still carries `"minRows": 1` on `## Write roots`. A binding whose
`declaredWriteRoots` is the documented default — empty — passes the data half and cannot emit its own
receipt.
**Proposed change** remove `"minRows": 1` from the `## Write roots` section of
`templates/kinds/workspace-route-binding.contract.json`.

---

## What worked

The resume mechanics worked exactly as `resources/orchestrator.json` writes them: a new step, a new
`request.json`, `resume` naming the blocked branch, the blocked branch untouched on disk, and the same
operator re-entering with one changed requirement. The stop itself was found rather than staged — a clean
checkout closed the `CHECKOUT_DIRTY` route and the machine's own runtime state opened the other one — and
the domain lookup through `errors.json` into `routing.json` needed no interpretation, only reading. Every
schema rejection in this run was correct: the two probe branches failed in precisely the way that proves
the point they were written to test, with error text specific enough to name the missing table. Round-1
fixes that this run confirms landed: `route.schema.json` accepts `session-only` and an empty
`writeRoots`, `response.json.reason` gives a blocked branch somewhere to speak, `PADDING-9` is published,
and the Grammar claims now match the rendered CSS well enough to close half of a recorded gap.

## What is on disk

`.worktrees/sessions/20260903-r2-resume/`, kept: `state.json`, four chain branches under
`step-1/parallel-1`, `step-2/parallel-1`, `step-3/parallel-1` and `step-4/parallel-1`, and two labelled
probe branches under `step-9/parallel-1` and `step-9/parallel-2` that must never be read as outcomes of
`workspace.bind`. The frontend checkout is untouched and clean at
`8d8ed9a1456e1e8ef9d1d6fd80a41c20a520d3a2`; the shared runtime owner registry was read and not written;
no file under `.claude/` was edited except this report and its Vietnamese mirror.

# Run — frontend-with-uat on `/[lang]/subscriptions`, the UAT admission stop (2026-09-03, round 2)

A dry session of StarCi Skills: one orchestrator plus one agent per operator, all inside one process.
Session root `.worktrees/sessions/20260903-r2-frontend-with-uat/` (gitignored), kept on disk. The
point of this case is the admission gate of `uat.verify`: whether the operator refuses honestly when
nobody asked for the run, no flow directory exists, no sealed credential exists, nothing serves the
product, and neither admission receipt was ever produced. It does. It refuses earlier and harder than
the operator's own prose predicts, and the interesting result is *where* the refusal happens rather
than *that* it happens.

Every branch below names the profile its `operator.json` binds and was actually run by Claude Opus
standing in for it, declared under `resources/orchestrator.json` → `profileEquivalents`. For
`uat.verify` that stand-in is the registered pair (`sol-fresh` ↔ `opus`); for `workspace.bind` it is
not, because that operator now binds `luna`, whose registered equivalent is `sonnet`, so Opus stood in
for the stand-in and no profile boundary was exercised anywhere in this run. Nothing was committed,
nothing was written into any checkout, no `.claude` runtime file was edited by this session, no git
write command was run anywhere, no browser was driven, no secret was read or decrypted, and no
`uat/` folder, account or credential was created.

## Request summary

| Field | Value |
| --- | --- |
| Workflow | `frontend-with-uat` (`workflows/frontend-with-uat.json`, `when`: a frontend change a person asked to walk through) |
| Target | `/[lang]/subscriptions` |
| Tree | published head `3d30a88e`; `INDEX.md` read `# StarCi Skills 1.0.3` when this session began and `# StarCi Skills 1.1.0` an hour later, edited under the run by another session (see G7) |
| Frozen backend head | `90ef7fcb8dfbe83129af877e15a2c5fc029358de` (`git rev-parse HEAD`, branch `mtp`, tree dirty in two paths) |
| Frozen frontend head | `8d8ed9a1456e1e8ef9d1d6fd80a41c20a520d3a2` (`git -C D:\Repositories\starci-academy-fe rev-parse HEAD`, branch `main`, clean) |
| Chain requested | bind (be) ∥ bind (fe, `runtimeNeed: consume`) → direction → resolve → apply (`dry`) → audit (matrix) → quality → uat → publish |
| Chain actually run | step 1 only, both branches `blocked`; then `uat.verify` dispatched out of chain as the admission probe the case asks for |
| Ended | at the UAT gate. `frontend.direction.decide`, `frontend.presentation.resolve`, `frontend.source.apply`, `frontend.surface.audit`, `quality.verify` and `git.publish` were never dispatched, because step 1 blocked on both branches |

Requirements came from the workflow presets plus each operator's stated defaults. `project` had to be
supplied by the orchestrator on both bind branches, because no preset and no default covers it —
round 1's G3, unchanged. Nothing was asked of a person, because there was no person in the loop; that
is itself the first finding.

---

## Step 1 — `workspace.bind` (be), parallel-1

**Status** `blocked`. Stop `CHECKOUT_DIRTY` (`operators/workspace-bind/errors.json`, domain `source`,
disposition `terminate`; `routing.json` sends `source` back to the same operator as a `resume`).
**Profile** `operator.json` binds `luna`; run here by Claude Opus.

```text
$ node .claude/scripts/validate-request.mjs <session>/step-1/parallel-1
request valid

$ node .claude/scripts/validate-response.mjs <session>/step-1/parallel-1
response valid

$ node .claude/scripts/validate-step.mjs <session>/step-1/parallel-1
step valid

$ node .claude/operators/workspace-bind/validate.mjs <session>/step-1/parallel-1
valid workspace.bind branch
```

**Artifacts** `response/response.json` and nothing else, which is the only shape a blocked branch has;
the `reason` field carries the prose, so this run does not repeat round 1's O3 for this operator.

**What the branch found.** The two route halves agree on project `starci-academy`, role `be`,
repository `https://github.com/starci-lab/starci-academy-backend` and branch `mtp`; the `source`-kind
repository resolves to the Source root itself. Step 4 then refused the checkout: `git status
--porcelain` reports ` M .workspaces/projects/tayson/fe.json` and `?? .workspaces/projects/tayson/be.json`.
The workflow presets no `declaredWriteRoots` and the Requirements default is empty, so every dirty
path lies outside the declared write set. The dirty files belong to another project entirely, so no
honest write root of a subscriptions mission could have covered them, and the operator never stashes,
cleans or resets. No resume was attempted: a resume that declares another project's declaration files
as this mission's write roots would be bending the gate rather than clearing it.

---

## Step 1 — `workspace.bind` (fe, `runtimeNeed: consume`), parallel-2

**Status** `blocked`. Stop `RUNTIME_NOT_READY` (`operators/workspace-bind/errors.json`, domain
`runtime`, disposition `terminate`; `routing.json` sends `runtime` to `external`).
**Profile** `operator.json` binds `luna`; run here by Claude Opus.

```text
$ node .claude/scripts/validate-request.mjs <session>/step-1/parallel-2
request valid

$ node .claude/scripts/validate-response.mjs <session>/step-1/parallel-2
response valid

$ node .claude/scripts/validate-step.mjs <session>/step-1/parallel-2
step valid

$ node .claude/operators/workspace-bind/validate.mjs <session>/step-1/parallel-2
valid workspace.bind branch
```

**Steps 1 to 4 held.** The route halves agree on project, role `fe`, repository
`https://github.com/starci-lab/starci-academy-fe.git` and branch `main`; the sibling checkout resolves
to `D:\Repositories\starci-academy-fe`, sits on `main`, is clean at `8d8ed9a1…`, and its
`worktreeBranches` is `session-only`, so a source-writing step would have been permitted — round 1's
fix is live.

**Step 5 ran, and that is round 1's other fix.** `frontend-with-uat` presets the fe bind with
`runtimeNeed: consume`, so the endpoint binding is attempted at step 1 rather than discovered missing
at the audit. The projection is closed and consistent — offset 0, application slot `main` 0, therefore
frontend 3000 and api 3001, exactly what the owner registry advertises — so the authority is not
stale. Readiness is not proved:

```text
$ cat .worktrees/sessions/central-runtime/owner.json   # generation 6, status "ready"
$ curl -s -o /dev/null -w "%{http_code}" --max-time 6 http://localhost:3000/en/subscriptions
000
$ curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3001/
000
$ netstat -ano | grep LISTENING | grep -E ":(3000|3001|8089|5432|8080) "
  TCP    0.0.0.0:5432           0.0.0.0:0              LISTENING       20388
  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING       20388
```

The registry claims `ready` while no listener answers on either endpoint; only Postgres and Keycloak
are up. The operator never starts a shared process, so the claim cannot be repaired here and the
binding stops. The consequence for the chain is total: with the fe route unbound, the whole frontend
half — direction, resolution, dry apply, audit — is unreachable, and so is `quality.verify`. Round 1
moved this wall from step 5 to step 1, which is the right direction (fail fast, before four operators
do work that the audit would throw away), but it also means `frontend-with-uat` cannot reach
`uat.verify` through its own chain on this machine.

---

## Step 2 — `uat.verify`, parallel-1 — the admission probe

This branch is not a chain transition. Step 1 blocked on both branches and routing sent one to a
`resume` and one to `external`, so an orchestrator following `SKILL.md` stops there. The case asks
for the UAT admission stop specifically, so `uat.verify` was dispatched out of chain, with the request
an honest orchestrator would write for it: nobody asked, so `requestedBy` is null; nothing on disk
declares a flow for this surface, so `flow` is null; no admission receipt exists anywhere in the
session, so `inputs` is empty; and the exclusive lease could not be granted, because a lease is taken
on a flow directory that does not exist.

**Status** `blocked`. Stop `INVALID_INPUT` (`operators/errors.json`, scope `*`, domain `caller`,
disposition `terminate`; `routing.json` sends `caller` to `user`).
**Profile** `operator.json` binds `sol-fresh`; run here by Claude Opus, the registered equivalent.

```text
$ node .claude/scripts/validate-request.mjs <session>/step-2/parallel-1
request.json: required field requestedBy has no value
request.json: required field flow has no value
request.json: required input frontend-surface-audit is absent
request.json: required input quality-verification is absent

$ node .claude/scripts/validate-response.mjs <session>/step-2/parallel-1
response valid

$ node .claude/scripts/validate-step.mjs <session>/step-2/parallel-1
request.json: required field requestedBy has no value
request.json: required field flow has no value
request.json: required input frontend-surface-audit is absent
request.json: required input quality-verification is absent

$ node .claude/operators/uat-verify/validate.mjs <session>/step-2/parallel-1
request.json: required field requestedBy has no value
request.json: required field flow has no value
request.json: required input frontend-surface-audit is absent
request.json: required input quality-verification is absent
request.json: UAT runs only when a person asked; requestedBy has no value
```

**This branch does not pass its four validators, and it cannot.** `validate-response` is green — the
blocked response is well formed, `INVALID_INPUT` is in the operator's Stops table, and its effective
disposition is `terminate` — but the request gate refuses on four independent counts and both the step
check and the operator's own validator inherit those four. The only way to make the request valid
would be to name a person who did not ask and to point at two admission receipts that do not exist,
which is fabrication, not a fix. The failure is recorded verbatim rather than engineered away.

**What was verified read-only, and never reached.** Two further preconditions were confirmed on disk
so the record can say what *would* have fired next, without creating anything:

```text
$ ls .stacks/dev
infra  runtime  seeds
$ ls .stacks/dev/secrets
ls: cannot access '.stacks/dev/secrets': No such file or directory
$ find . -maxdepth 5 -name uat.enc         # no output
$ ls .worktrees/uat/*/*
   result.json  snapshot.json             # in every one of the seven flow folders
$ ls .worktrees/_templates/uat
result.schema.json  result.template.json  snapshot.schema.json  snapshot.template.json
```

There is no `.stacks/dev/secrets/uat.enc`, so step 3 would have stopped at
`PROVISIONING_UNAVAILABLE`; no flow folder anywhere carries a `flow.md`, an `account.json` or a
`seed/`, and there is no `subscriptions` feature folder at all, so step 4 would have had nothing to
freeze and no template to freeze it from; and nothing serves the product, so step 6 would have stopped
at `RUNTIME_UNAVAILABLE`. Nothing was created, decrypted, seeded, driven or deleted, and no run record
was published — which is exactly what the operator says a blocked run must do.

---

## Which stop fires first, and whether the tables agree

**The first stop is `INVALID_INPUT`, and it fires in the orchestrator's request gate, not inside the
operator.** On that code the three sources agree completely: `uat.verify`'s Stops table lists it as
`terminate`, `operators/errors.json` registers it with scope `*`, domain `caller` and disposition
`terminate`, `operators/INDEX.md` reproduces both, `routing.json` maps `uat.verify` + `caller` to
`user`, and `operators/uat-verify/validate.mjs` enforces the same law in its own words
(`UAT runs only when a person asked; requestedBy has no value`). The refusal is honest, it is early,
and it costs nothing.

**`ADMISSION_MISSING` never fires, and on the evidence of this run it never can for the half of its
meaning that says "absent".** Three sources describe the absent admission and none of them can reach
it:

- `operator.md` Inputs marks both `frontend-surface-audit` and `quality-verification` required, so
  `scripts/validate-request.mjs` rejects the request before an agent is ever spawned — with a generic
  gate message that carries no code, which the orchestrator can only classify as `INVALID_INPUT`.
- `operators/uat-verify/errors.json` gives `ADMISSION_MISSING` a meaning that opens with "is absent".
- `validate.mjs` contains the matching check —
  `request.json: ADMISSION_MISSING — input ${kind} is absent` — but it sits inside `if (snapshot)`,
  and a snapshot only exists once the run has reached operator step 4. A branch that blocked before
  execution has no snapshot, so the check does not run; a branch that has a snapshot got past the
  gate, so its inputs were present. The line is unreachable in both directions.

What remains reachable is the other half: both receipts present but one taken at another commit than
the pinned head. That half is well covered, by three separate comparisons in `validate.mjs`.

---

## Defects and proposed fixes

Nothing in the `.claude` tree was edited by this run. Each entry below names the file, the evidence,
and the exact change proposed.

### O13 — a branch that blocks at the gate can never pass its own operator validator

**File** `operators/uat-verify/validate.mjs`, lines 40–42.
**Evidence** the fourth validator output above: the branch blocked with `INVALID_INPUT` *because*
`requestedBy` was absent, and the validator then rejects the branch for the same absence.
**Why it matters** `runId` and `lease` are already gated on `decided`; `requestedBy` is not, so of the
three orchestrator-or-person fields only the one that defines the operator's whole trigger makes a
lawful refusal unpublishable. A valid `blocked` is supposed to count as green.
**Proposed change** gate the requester check the same way the other two are gated, and keep the strict
form for a decided run:

```js
if (decided && empty(requirements.requestedBy)) errors.push('request.json: UAT runs only when a person asked; requestedBy has no value');
```

The gate already refuses a request with no `requestedBy`, so nothing is lost: a run that reaches the
agent still cannot have an empty requester.

### O14 — the "absent admission" branch of `ADMISSION_MISSING` is dead code

**File** `operators/uat-verify/validate.mjs`, the `for (const kind of ADMISSIONS)` block nested inside
`if (snapshot)`; `operators/uat-verify/errors.json` → `ADMISSION_MISSING.meaning.en`.
**Evidence** the reachability argument above; the request gate rejects an absent required input first,
and the check that would name the code only runs when a snapshot already exists.
**Proposed change** either (a) move the two `request?.inputs?.[kind] === undefined` checks out of the
`if (snapshot)` block so a blocked branch is judged on them too, or (b) narrow the code's meaning to
what is actually reachable — "one of the two admissions was taken at another commit than the pinned
head" — and let the absent case stay `INVALID_INPUT` in the gate. (a) is the better fix, because the
code's `resume` line ("Re-run the missing admission at the pinned commit") is the correct instruction
for a person and `INVALID_INPUT`'s ("Correct request.json") is not.

### O15 — an absent lease and an absent runId are three different things in three places

**File** `operators/uat-verify/operator.md`, the section "UAT runs only when a person asked", the
Requirements table, and the Steps table; `operators/uat-verify/validate.mjs` lines 41–42.
**Evidence** this run's request carried `lease: null` and the gate accepted it (`request valid` would
have followed had the other four counts passed; the four errors listed do not include the lease).
The prose says "an invocation that arrives without them is `INVALID_INPUT` rather than a prompt"; the
Requirements table gives both fields a Default, which is precisely what makes the gate accept an
absent value; the validator checks them only when the branch is `decided`; and the Steps table assigns
the lease two different codes depending on when it is noticed — `INVALID_INPUT` at step 1, and
`LEASE_INVALID` at step 6, whose domain is `control-panel` and whose route is `external`.
**Proposed change** make the Requirements Default of `runId` and `lease` `—` (the orchestrator fills
them, exactly as it fills `project`; a Default cell that reads "the orchestrator's run id" is prose,
not a value the gate can use), and leave `LEASE_INVALID` for a lease that exists but is expired,
foreign or bound to another run — which is what its own meaning already says.

### O16 — the custody scan does not read `response.json.reason`

**File** `operators/uat-verify/validate.mjs`, the `scanned` array.
**Evidence** the scan covers `response.md`, `snapshot.json`, `verdicts.json` and every capture, but
`response.json` carries a free-prose `reason` of up to 2000 characters — added after round 1 — and it
is the one file a blocked run always writes. The operator's law is that the credential appears nowhere
this operator writes.
**Proposed change** add `'response/response.json'` to `scanned`.

### O17 — `@worktrees/_templates` cannot produce the flow directory the Context table describes

**File** `operators/uat-verify/operator.md` Context table; `.worktrees/_templates/uat/`.
**Evidence** the Context row calls it "the UAT flow template a new flow directory is created from",
and the template folder holds `result.schema.json`, `result.template.json`, `snapshot.schema.json` and
`snapshot.template.json` — the v7-era result/snapshot pair — with no `flow.md`, no `account.json` and
no `seed/`. The seven live flow folders under `.worktrees/uat/` carry the same old pair. This is
round 1's O9 confirmed a second time and extended to the template itself; it is still open.
**Proposed change** publish the flow template the operator actually reads —
`_templates/uat/flow.md`, `_templates/uat/account.json` (username, role, credential name, sealed file
path, and no field that could hold a secret) and `_templates/uat/seed/records.json` — or, if the
v7-era pair is the intended shape, correct the Context table and Steps 4 and 10 to name it.

### O18 — `workspace.bind`'s Next table and `routing.json` disagree about a runtime that is not ready

**File** `operators/workspace-bind/operator.md` `## Next`; `routing.json` → `workspace.bind.runtime`.
**Evidence** the Next table row reads "the runtime owner is missing or not ready and one coordination
request must be raised → `platform.operate`", while `RUNTIME_NOT_READY` carries domain `runtime`,
which `routing.json` maps to `external` — a full stop, not an operator. This branch's `next` therefore
had to name `external`, an outcome its own `operator.md` does not offer. Same family as round 1's O7
and O8, on a different operator and a different code, and still nothing checks Next tables against
`routing.json`.
**Proposed change** teach `scripts/validate-routing.mjs` to read every operator's `## Next` table and
require that each operator it names is reachable from that operator through `routing.json` or through
a workflow edge, then fix whichever side is wrong — here, most likely `routing.json`, since
`platform.operate` is exactly the operator that can serve a route.

### G7 — the `.claude` tree changed under the running session, again

**Evidence** `INDEX.md` read `# StarCi Skills 1.0.3` when this session bound its context and
`# StarCi Skills 1.1.0` less than an hour later; `package.json` reads `1.1.0`; `git status` in the
`.claude` repository shows twelve modified or untracked paths, including `bin/`, `README.md` and
`scripts/install-cli.spec.mjs`, none of them written by this run. `npm test` failed on the first
invocation (`install-cli.spec.mjs` asserting `^# StarCi Skills 1\.1\.0$` against an `INDEX.md` that
still said `1.0.3`) and passed on the second, with no action of this session in between.
**Why it matters** this is round 1's G1 in a sharper form: there `.workspaces` route authority moved
mid-session, here the runtime tree itself did. `SOURCE_DRIFT` compares the checkout head a request
froze, and `.claude` is gitignored by the backend and versioned in its own repository, so a tree edit
moves no head any request pinned and no code fires.
**Proposed change** put the `.claude` head in the request: give `request.json.contexts` a
`@trust` (or `@skills`) alias whose `head` is the `.claude` repository head plus a dirty flag, and let
`SOURCE_DRIFT` cover it. A run whose own law changed underneath it should say so before its receipts
are read as evidence.

### G8 — a workflow can be "closed" and still be undispatchable

**File** `scripts/validate-workflows.mjs`; `scripts/validate-defaults.mjs`;
`workflows/frontend-with-uat.json`.
**Evidence** `node scripts/validate-workflows.mjs` prints `workflows closed: 8 examples`. The
`uat.verify` branch of `frontend-with-uat` presets nothing at all, while three of that operator's
Requirements have Default `—`: `requestedBy`, `feature` and `flow`. Nothing in the workflow, in
`routing.json` or in any script says where those three come from. `validate-defaults.mjs` passes the
operator by filling every required field with the literal string `placeholder` and pointing every
required input at a file it writes itself, so the one check that looks like coverage is a static shape
check that a real chain can never satisfy — and `requestedBy` is exactly the field the operator says
must never be defaulted.
**Proposed change** extend `validate-workflows.mjs` with the missing half of the composition rule it
already enforces for Inputs: every Requirements field of a branch whose Default is `—` must either be
preset by the workflow, be derivable from the workflow target, or be listed in a new `asks` array on
the branch, so that a chain declares up front which fields a person must supply before it starts. For
`frontend-with-uat` specifically, add `"asks": ["requestedBy", "feature", "flow"]` to the
`uat.verify` branch — the workflow's own `when` already says a person asked by name, and there is
currently nowhere to write that name down.

### G9 — the bound endpoint never reaches the operator that needs it most

**File** `operators/uat-verify/operator.md` Inputs and Context tables;
`workflows/frontend-with-uat.json`.
**Evidence** step 1 of the chain computes a closed endpoint projection and refuses a merely listening
port, and `uat.verify` consumes neither the `route` receipt nor the `workspace-route-binding`: its
Inputs are the two admissions only, and its Context binds
`@worktrees/sessions/central-runtime` directly — the same registry that advertised `ready` while
nothing listened. The operator that drives a real browser against a real product re-derives readiness
from the least trustworthy source in the chain.
**Proposed change** add a required Input `route` (kind `route`, from the fe `workspace.bind` branch)
to `uat.verify`, and have step 6 execute against the endpoint that receipt carries rather than against
an origin read from the registry. `frontend.surface.audit` deserves the same treatment.

### Knowledge gaps

None. No knowledge topic was bound by this run: `workspace.bind` binds none, and `uat.verify` binds
none either (`operator.json` → `grammarBound: false`, and its Context table names no `@knowledge`
alias). Round 1's six knowledge gaps stand untouched.

---

## What is on disk

`.worktrees/sessions/20260903-r2-frontend-with-uat/` was kept: `state.json` plus three branches
(`step-1/parallel-1`, `step-1/parallel-2`, `step-2/parallel-1`), each with its `request/request.json`
and its `response/response.json`. No branch wrote a `data/` or `artifacts/` file, because all three
blocked. The backend checkout is untouched at `90ef7fcb8dfbe83129af877e15a2c5fc029358de` with the same
two dirty paths it had before the run; the frontend checkout is untouched and clean at
`8d8ed9a1456e1e8ef9d1d6fd80a41c20a520d3a2`; no file under `.claude/` was edited by this session except
this report and its Vietnamese mirror.

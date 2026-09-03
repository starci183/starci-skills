# Run — frontend-new-surface for a billiards game page (2026-09-03)

Second dry run of StarCi Skills 1.0.2, on the workflow that creates a surface which does not exist
yet. One orchestrator plus one agent per operator, all inside one process. Session root
`.worktrees/sessions/20260903-dryrun-frontend-new-surface/`, kept on disk for inspection. Nothing was
committed, nothing was written into either checkout or into the businesses root, and no git write
command was run anywhere.

Two things to hold in mind before any verdict is read. First, the profile boundary was not exercised:
every branch names the profile its own `operator.json` binds, and every branch was actually run by
Claude Opus standing in for it. Second, the brief for this run assumed that every operator in this
chain binds `sol-fresh`, and that is not what the tree says — `workspace.bind` binds `sonnet`,
`business.decide` and `frontend.direction.decide` bind `sol-fresh`, and further down the chain
`frontend.presentation.resolve` binds `sonnet`, `frontend.source.apply` binds `opus` and
`frontend.surface.audit` binds `sol-reviewer`. Each step below states the profile its `operator.json`
actually names.

## Request summary

| Field | Value |
| --- | --- |
| Request, verbatim | "tạo trang game chơi bida" — a billiards game page in `starci-academy-fe` at `/games/billiards` |
| Workflow | `frontend-new-surface` |
| Target | `/games/billiards`; the checkout routes pages through `src/app/[lang]/`, and no `games` segment exists at the frozen head |
| Feature id | `billiards-game`, supplied by the caller; no business head of that name exists |
| Frozen frontend head | `14e0c20f4746ae08f00a84a4eac18aa78ded987b` on `main`, clean tree (`git -C D:\Repositories\starci-academy-fe rev-parse HEAD`, read-only) |
| Frozen backend head | `d5926ae857aa4f8c11c53a80d6a764ee92a60149` on `mtp` (observed; the hydrated `be` route still records `4456c4bc8…`, so the hydration is stale) |
| Knowledge head | `ffaa99115149d921e5191b93b2b5018f3f8cb8f9` on `main` of `.claude`, working tree dirty |
| Chain requested | 1 `workspace.bind` (fe) → 2 `business.decide` (model) → 3 `frontend.direction.decide` (create/new) → 4 `frontend.presentation.resolve` → 5 `frontend.source.apply` (dry) → 6 `frontend.surface.audit` |
| Chain actually run | steps 1 and 2, plus one standalone proof branch as step 3. Step 2 blocked, so the workflow's own steps 3 to 6 were never dispatched |

Requirements came from the workflow presets plus each operator's stated defaults. Three required
fields with no default had to be supplied: `project` (`starci-academy`), `featureId`
(`billiards-game`, from the brief) and `target` (`/games/billiards`, from the request).

---

## Step 1 — `workspace.bind`, parallel-1

**Status** `done`. No stop. No fallback taken.
**Profile** `operator.json` binds `sonnet` with no runtime grants; in this test the branch was run by Claude Opus, as every branch was.

**Validators**

```text
$ node scripts/validate-request.mjs <session>/step-1/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-1/parallel-1
response valid

$ node operators/workspace-bind/validate.mjs <session>/step-1/parallel-1
valid workspace.bind branch
```

**Artifacts written** `response/response.md` (kind `workspace-route-binding`),
`response/data/route.json` (kind `route`), `response/response.json`.

**What the branch found.** The portable declaration `.workspaces/projects/starci-academy/fe.json` and
the hydrated route `.workspaces/local/routes/starci-academy/fe/config.json` agree on project, role,
Git repository and branch, and the hydration names this Source. The checkout is a `sibling` kind in
`starci-academy-fe`, resolving to `D:\Repositories\starci-academy-fe`, on `main` at `14e0c20f…` with a
clean working tree and the exact head the hydration records, so nothing drifted. `runtimeNeed` was
`none`, so step 5 of the operator never ran and the binding carries no endpoints. `authorityRoots.businesses`
is `null`, which is the law for a sibling checkout — and which matters a great deal one step later.
Mutation readiness was reported `ready`, because the checkout sits on the routed mutation branch;
that value is discussed under the defects, because the earlier `frontend-refine` dry run reported
`read-only` from this same route and nothing in the operator settles which is right. Findings
recorded: `ROUTE_HYDRATED_FROM_PORTABLE`, `WORKTREE_BRANCH_FORBIDDEN`, `IDENTITY_ROSTER_SEALED`.

---

## Step 2 — `business.decide`, parallel-1

**Status** `blocked`. **Stop** `EVIDENCE_MISSING`.
**Profile** `operator.json` binds `sol-fresh` with `webSearch: bounded`; in this test the branch was run by Claude Opus, and no web search was performed, because the missing thing was routed-source evidence and no external page can supply that.

**Stop domain and routing answer.** `EVIDENCE_MISSING` is registered in `operators/errors.json` with
`scope: ["*"]`, `disposition: terminate` and `domain: "self"`. `self` means the emitting operator's
own domain, and `business.decide`'s `operator.json` declares `domain: "business"`. `routing.json`
answers `routes["business.decide"]["business"]` with `{ "kind": "resume" }`: the same operator is
re-entered in a new step with `request.json.resume` naming the blocked branch. That resume can only
end one way here — the same input reaches the same wall, which is `NO_PROGRESS`, whose domain is
`caller` and whose route is `{ "kind": "user" }`. So the person is reached on the second bounce, not
the first.

**Validators**

```text
$ node scripts/validate-request.mjs <session>/step-2/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-2/parallel-1
response valid

$ node operators/business-decide/validate.mjs <session>/step-2/parallel-1
valid business.decide branch
```

A valid blocked branch is green, and this one is.

**Artifacts written** `response/response.json` only. No `response.md`, no `claims.json`, no
coverage matrix, and — the point of the exercise — **no `response/data/model.json`**. No would-be head
was recorded, because the branch never reached step 8 and had nothing evidence-backed to record.
Nothing at all was written into `.worktrees/businesses`.

**Which stop, and why that one.** The brief expected one of `EVIDENCE_MISSING`,
`LIFECYCLE_TRANSITION_INVALID` or `APPROVAL_REQUIRED`, whichever the operator's law names first. The
answer is `EVIDENCE_MISSING`, and it is not close. The Steps table orders the checks: step 2
normalizes the evidence into claims and stops with `EVIDENCE_MISSING` or `CONTRADICTION_UNRESOLVED`;
step 3 is the one that checks the published head and the transition authority and owns
`LIFECYCLE_TRANSITION_INVALID`, `AUTHORITY_CONFLICT` and `APPROVAL_REQUIRED`. Step 2 runs first and
step 2 cannot complete.

The evidence pass was run for real against the frozen backend head and the businesses root:

| Observation | Result |
| --- | --- |
| `business-registry-v1.json` → `featureHeads` | 13 keys; `billiards-game` is not one of them |
| `.worktrees/businesses/features/` | 14 directories; none is `billiards-game` |
| backend at `d5926ae8…`, case-insensitive search for `billiard`, `snooker`, `bida` | no match anywhere in the repository outside `node_modules` and `.git` |
| frontend at `14e0c20f…`, any `games` route segment | absent |

So there is no fact claim to be had. The operator's own law then closes the only remaining door:
`claims.schema.json` requires `path`, `lineStart` and `lineEnd` on **every** claim, whatever its
`kind`, and requires the claims array to carry at least one item. The owner's sentence is an intent,
and `intent` is a declared claim kind — but an intent spoken in a request has no file and no line
range, so it cannot be written as a claim at all. Step 2 therefore has nothing it may write, and
`response/data/claims.json` cannot exist. `EVIDENCE_MISSING` is the honest stop.

Had it reached step 3, the transition would have been legal: the head is absent, the request asked
for `pending`, and `absent->pending` is in `LEGAL_TRANSITIONS`. `APPROVAL_REQUIRED` would not have
fired either, because no approval is bound to that transition. Both alternative codes were available
and neither applied.

**What the branch found, in one sentence.** The chain refused to draw a page whose promise nobody has
decided, and it refused for the right reason: not "no head exists", but "no observed fact in routed
source says what this product promises, to whom, or when it is denied."

---

## Step 3 — `frontend.direction.decide`, parallel-1 (standalone proof branch)

This branch is not a continuation of `frontend-new-surface`; the workflow died at step 2. It was run
once, deliberately, with `changeLevel: new`, `intent: create` and **no** `business-promise-authority`
input, to prove where the direction operator stops on its own.

**Status** `blocked`. **Stop** `BUSINESS_REQUIRED`.
**Profile** `operator.json` binds `sol-fresh` with `webSearch`, `browser` and `imageGeneration`; in this test the branch was run by Claude Opus. No bounded research was performed and no image was generated, because the run stopped at step 3 of 12, before the research step and before anything was drawn.

**Stop domain and routing answer.** `BUSINESS_REQUIRED` is registered in
`operators/frontend-direction-decide/errors.json` with `disposition: terminate` and `domain: "business"`.
`routing.json` answers `routes["frontend.direction.decide"]["business"]` with
`{ "kind": "operator", "target": "business.decide" }` — invoke `business.decide` and come back. In
this session that operator has already blocked with `EVIDENCE_MISSING`, so the two branches close a
loop whose only exit is the person.

**Validators**

```text
$ node scripts/validate-request.mjs <session>/step-3/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-3/parallel-1
response valid

$ node operators/frontend-direction-decide/validate.mjs <session>/step-3/parallel-1
valid frontend.direction.decide branch
```

**Artifacts written** `response/response.json` only. No `coverage.json`, no candidate page, no image.

**What the branch found.** Steps 1 and 2 of the operator passed honestly. The gate held; the frozen
head matched the observed one; the route was verified by step 1 of this session; the change level was
stated by the request rather than inferred from source, and `create` with `new` is the only legal
pairing, so `CHANGE_LEVEL_AMBIGUOUS` did not apply; the default owner ceiling
`surface-and-nested-layouts` authorizes the host layout `src/app/[lang]/layout.tsx` and the new
surface below it, so `OWNER_CEILING_INVALID` did not apply either. Step 3 is where the operator binds
the inputs the change level requires, and `new` requires the business promise. There was none.
`BUSINESS_REQUIRED` is a terminate, and the run ended there — before observing the existing context,
before compiling any UI contract, and before a single candidate was formed. That is the result the
branch was run to obtain: the direction operator will not invent a promise, and it will not draw a
billiards table because someone asked for one.

---

## Defects this run exposed

### Knowledge gaps

**A blocked branch leaves no readable trace, so nothing carries the reason forward.** This is a
knowledge gap before it is a contract defect: there is no kind in `templates/kinds/` for "why this
stopped". Both blocked branches in this session are a single `response.json` holding a status and a
code. Everything a person would want — which files were searched, what was found, why
`EVIDENCE_MISSING` rather than `LIFECYCLE_TRANSITION_INVALID` — exists only in this hand-written
record. A resume, per `orchestrator.json`, re-enters the operator with `resume` naming the blocked
branch; the blocked branch it names contains nothing to read.

**`knowledge/ui/composition` publishes no law for a play surface.** The folder's 36 rules span
`ACCENT-1..5`, `ACTION-1..3`, `COVERAGE-1`, `CTA-1..5`, `FEEDBACK-1..3`, `HIERARCHY-1..5`, plus
`LAYOUT`, `RESPONSIVE` and `STATE`. Every one of them describes a document-shaped surface: regions,
ranks, actions with settlements, responsive branches. A billiards page is a real-time interactive
canvas — a play area with a tick loop, pointer aim, shot power, turn state, pause and resume, and a
result. Even with a business head in hand, step 5 of `frontend.direction.decide` would compile a UI
contract that has no law at all about the one region that carries the whole product. `ACTION-2`
("pending belongs to the initiator") and `FEEDBACK-3` ("settlement must be known before it is
claimed") are about request/response actions, not about a physics frame.

**Whether a canvas is a Grammar gap is decided by one sentence of prose in an operator file.**
`frontend.direction.decide`'s narrative says "A node the application legitimately owns, a canvas for
instance, is not a Grammar gap and never raises one." That is the entire law separating
`GRAMMAR_REQUIRED` (a person publishes a family component) from "the application owns this". It lives
in `operator.md`, not in `knowledge/`, so it carries no rule identifier, no fingerprint, and nothing
in `knowledge/ui/composition` or `knowledge/grammars/starci` can be cited for it.

**Nothing in the tree turns a product request into a feature id.** `billiards-game` was supplied by
the caller and no operator checks that it means anything. `business.decide` will happily open an
authority root for any slug that matches `^[a-z0-9][a-z0-9-]*$`.

### Operator and contract defects

**A blocked branch cannot carry its own receipt.** `business-promise-authority` requires `## Cited
claims` with at least one row; `frontend-direction-decision` requires `## Observed`, `## UI contract`
and `## Falsification` each with at least one row. Every one of those rows is produced by a step that,
by definition, did not run when the branch blocked earlier. `validate-response.mjs` enforces required
outputs only when `status` is `done`, so the honest branch writes no markdown — and writing a partial
one is not allowed either, because `checkDocument` would fail it on `minRows`. The contracts assume
success. The fix is either a `## Findings`-only degraded form per kind, or a shared `stop-record` kind
every operator may emit when it blocks.

**`claims.schema.json` has no room for a claim whose source is the person.** Every claim requires
`path`, `lineStart`, `lineEnd`, regardless of `kind`, and `intent` is a declared kind. An owner's
stated intent — which is the whole content of "tạo trang game chơi bida" — therefore cannot be
recorded as a claim of any kind. The consequence is structural, not incidental: **no greenfield
promise can ever leave step 2 of `business.decide`.** A promise whose enforcement is not already in
the backend has no fact claims by construction, and cannot record even the intent that motivated it.
The operator's stated job is to "decide and publish one evidence-backed business promise"; as
written, it can only *describe a promise the backend already keeps*. Either the claim schema needs a
source kind for an owner statement (a request reference, not a file and line), or the operator needs
a documented first-publication path where `pending` is publishable on intent alone.

**`dimensions` is required on a first run and the gate does not enforce it.** The Requirements table
says "required on a first run, because no previous head declares it", but its Default cell reads "the
dimensions of the previous head", so `isRequiredField` in `validate-request.mjs` — which tests
whether the default starts with `—` — returns false. A first-run request that omits `dimensions`
passes the gate. This run declared the eight mandatory dimensions explicitly; nothing forced it to.

**`gitPolicy`'s declared type contradicts its validator.** `workspace.bind`'s Requirements table types
it as "list of `{worktreeBranches, mutationBranch}`", while `validate.mjs` reads
`requirements.gitPolicy?.worktreeBranches` — a single object. An orchestrator that believed the table
and sent an array would silently skip both policy comparisons rather than fail.

**`mutationReadiness` is underdetermined when the worktree policy is `forbidden`.** The validator
accepts `ready` whenever `checkout.branch === gitPolicy.mutationBranch`, and accepts `read-only`
unconditionally. From this exact route, the earlier `20260903-frontend-refine-subscriptions` run
reported `read-only` and this run reported `ready`, both green. Two dry runs, one route, two answers,
no rule to appeal to.

**`route.schema.json` requires at least one write root; `declaredWriteRoots` defaults to empty.** With
the default, `workspace.bind` must invent a write root it was never given in order to emit a
schema-valid `route.json`. This run declared `src` and `public` explicitly, so the contradiction did
not bite; it will bite the first caller who takes the default.

**The businesses head index and the directory disagree.** During the evidence pass,
`.worktrees/businesses/features/` held `course-community`, which `business-registry-v1.json`
`featureHeads` did not list. `business.decide` classifies a head as absent, fresh or stale against the
registry, so a head that exists on disk but not in the index reads as absent, and a first publication
would be attempted over a live head. The businesses worktree was dirty throughout (an untracked
`features/course-community/` alongside a modified registry), so the immediate cause here is another
session mid-write — which is the same hazard from the other side: this operator reads a shared
read-modify-write root with no lease it can observe.

**The validator law moved under the run, twice.** `.claude` was dirty for the whole session, and its
dirty set changed while the session was running. At the start it was `M scripts/validate-response.mjs`
and `M templates/kinds/route.schema.json` — both files this run is judged by. By the end those two were
gone and a different set was dirty (`knowledge/ui/presentation/padding.md`, the two `knowledge/ui`
indexes, and `operators/frontend-presentation-resolve/operator.md` and its mirror), which is the
knowledge and the operator that step 4 of this workflow would have bound had it got there. Every
validator was re-run at the end and stayed green, so nothing in this record depends on the earlier
state. The finding is the exposure, not a broken result: a run is judged against a working tree rather
than a head, and two sessions sharing this tree can change each other's verdicts mid-flight. One
incidental consequence is worth recording — the earlier dry run reported that
`scripts/validate-response.mjs` could not be invoked from its own CLI; it invoked cleanly here, so that
defect was fixed somewhere in the traffic and this run can no longer say by whom.

### Orchestrator gaps

**`frontend-new-surface` never binds the backend, and `business.decide` cannot work without it.** The
workflow's step 1 binds role `fe` and only `fe`. Step 2's Context table declares `@workspaces/be` as
**required**, "read at the frozen head; every fact claim cites it by path, line range, and head". No
step of this workflow binds `be`, so the orchestrator has to freeze a backend head that no
`workspace.bind` ever resolved — which is exactly the "a directory whose name matches is not route
authority" move that `workspace.bind` exists to forbid. This run read the head directly
(`d5926ae857…`) and says so rather than pretending otherwise. The workflow needs a second
`workspace.bind` branch with `role: be` in step 1, and `validate-workflows.mjs` cannot catch the
omission because it only checks Inputs, never Context.

**The one binding the chain produces cannot carry the authority root the next step needs.** The `fe`
route is a `sibling` checkout, and `workspace.bind`'s validator states that "a sibling checkout
carries no business authority root", so `authorityRoots.businesses` is `null` by law. The very next
step publishes a head under `@worktrees/businesses`. It gets there through `alias/alias.json`, which
resolves the root from `<Source>` independently of any binding — so the businesses root reaches
`business.decide` outside every validated field, and the receipt that was supposed to authorize it
says `null`.

**Step 1 → step 2 is an adjacency no `## Next` table permits.** `workspace.bind`'s Next table names
`git.publish`, `backend.source.apply`, `frontend.source.apply` and `platform.operate`. It does not
name `business.decide`, and it does not name `frontend.direction.decide` either — yet three of the
eight example workflows begin with exactly those hops. `SKILL.md` says a composed chain is built from
the operators' `## Next` tables, but `validate-workflows.mjs` never reads them, so the examples ship
green while contradicting the rule the entry applies to everything else.

**No typed carrier joins step 1 to step 2.** `business.decide` declares no Input of kind `route` or
`workspace-route-binding`, so `request.json.inputs` was necessarily `{}` and the frozen heads travelled
only as orchestrator-written `contexts` entries. `orchestrator.json` states the handoff rule as "the
next branch's `request.json` inputs point at `step-N/parallel-M/<path>`"; here there is nothing to
point at, and the step-1 receipt is never read by anything.

**`EVIDENCE_MISSING` routes to a resume that cannot succeed.** `domain: "self"` sends it back to
`business.decide`, which will meet the same wall and return `NO_PROGRESS` → `caller` → `user`. The map
has no way to express "this evidence can only come from a person", so the person is reached one
wasted invocation late. `SKILL.md` anticipates this ("a `resume` route that returns `NO_PROGRESS`
means the same input reached the same wall: report the wall rather than trying again"), which is
guidance to the reader rather than a route.

**A forbidden worktree policy and the session-branch rule cannot both hold.** `orchestrator.json`
`sourceWrites` requires every source-writing operator to commit on `session/<sessionId>` in a worktree
prepared from the frozen head, and `git.publish` to merge it. The routed `fe` policy sets
`worktreeBranches: forbidden`, and `workspace.bind`'s validator refuses to bind such a route on any
branch but the mutation branch. For this route, steps 5 and 8 of `frontend-new-surface` could never
legally run as specified. The workflow has never reached them, so nothing has failed yet.

**A blocked session's only durable record is hand-written.** `orchestrator.json` keeps the session
folder on a block, which happened. But the session folder holds two bare `response.json` files; the
account of what was searched and why the run stopped exists only because this document was written by
hand into `.claude/tests/runs/`. Nothing in the runtime produces it.

## What a person owns next

The request cannot proceed as a frontend mission. Before any page is drawn, someone has to decide the
promise: who plays a billiards game on this academy, whether it is free, entitlement-gated or
purchased, what the entry points are, what happens on denial, and what a completed or abandoned game
settles into. That decision has no evidence in routed source today and the runtime is correct to
refuse to invent it. Once it exists — either as a real backend path with fact claims, or through a
first-publication route the tree does not currently have — the same chain can run again from step 2,
with a `role: be` binding added to step 1.

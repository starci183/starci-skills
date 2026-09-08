# Run — frontend-reconstruct on the learner dashboard (2026-09-03)

A dry session of StarCi Skills v8: one orchestrator plus one agent per operator, all inside one
process. Session root `.worktrees/sessions/20260903-dryrun-frontend-reconstruct/`, kept on disk.
Every branch below names the profile its `operator.json` binds, and every branch was actually run by
Claude Opus standing in for that profile — so no profile boundary was exercised, which is the first
thing to hold in mind when reading a verdict here. The chain does **not** bind one profile: it binds
four different ones across two providers (`sonnet`, `sol-fresh`, `sonnet`, `opus`, `sol-reviewer`),
and the assumption that every operator in this chain runs `sol-fresh` is wrong at four of five steps.
Nothing was committed, nothing was written into the frontend checkout, no `.claude` runtime file was
edited, and no git write command was run anywhere.

## Request summary

| Field | Value |
| --- | --- |
| Workflow | `frontend-reconstruct` |
| Target | `/[lang]/dashboard` — `src/app/[lang]/dashboard/page.tsx` mounts `DashboardPage`, which composes every `src/components/blocks/dashboard/*` block |
| Frozen frontend head | `14e0c20f4746ae08f00a84a4eac18aa78ded987b` (`git -C D:\Repositories\starci-academy-fe rev-parse HEAD`, read-only, clean tree, branch `main`) |
| Chain requested | 1 `workspace.bind` (fe) → 2 `frontend.direction.decide` (modify, reconstruct, 1 candidate, no preview) → 3 `frontend.presentation.resolve` → 4 `frontend.source.apply` (dry) → 5 `frontend.surface.audit` |
| Chain actually run | all five. Steps 1–4 `done`; step 5 `blocked` with `RUNTIME_UNAVAILABLE`, which `routing.json` sends to `platform.operate` |
| Ended | at the audit, as instructed; `quality.verify` and `git.publish` were never dispatched |

Requirements came from the workflow presets plus each operator's stated defaults; nothing was asked
of a person. Three values had to be supplied by the orchestrator because no preset and no default
covers them: `project` (`starci-academy`, the only portable declaration naming this checkout),
`target` (found by grepping for the dashboard blocks), and `declaredWriteRoots` (see orchestrator gap
G3). One preset was overridden on the caller's instruction: `frontend.source.apply` runs `dry`, where
the workflow presets `apply`.

---

## Step 1 — `workspace.bind`, parallel-1

**Status** `done`. No stop.
**Profile** `operator.json` binds `sonnet` (`claude-opus-5`'s sibling profile in `resources/agents/profiles/claude.json`); in this test Claude Opus ran the branch, as it ran every branch.

**Validators**

```text
$ node .claude/scripts/validate-request.mjs <session>/step-1/parallel-1
request valid

$ node .claude/scripts/validate-response.mjs <session>/step-1/parallel-1
response valid

$ node .claude/operators/workspace-bind/validate.mjs <session>/step-1/parallel-1
valid workspace.bind branch
```

**Artifacts** `response/response.md` (kind `workspace-route-binding`), `response/data/route.json`
(kind `route`), `response/response.json`.

**What the branch found.** The portable declaration `.workspaces/projects/starci-academy/fe.json` and
the hydrated route `.workspaces/local/routes/starci-academy/fe/config.json` agreed on project, role,
Git repository and branch. The checkout is a `sibling` kind in `starci-academy-fe`, resolving to
`D:\Repositories\starci-academy-fe`, on `main`, clean, at `14e0c20f…` — the same head the hydration
records. `authorityRoots.businesses` is `null`, correctly, because a sibling checkout carries no
business authority. `runtimeNeed` defaulted to `none`, so step 5 of the operator never ran and the
binding carries no endpoints at all; that default is what makes step 5 of the *chain* unreachable
(G2). Mutation readiness was recorded `ready` because the observed branch equals the declared
mutation branch. Findings: `ROUTE_HYDRATED_FROM_PORTABLE`, `WORKTREE_BRANCH_FORBIDDEN`,
`IDENTITY_ROSTER_SEALED`.

**What happened afterwards.** Between this branch and step 2, another session rewrote both route
halves: `worktreeBranches` moved from `forbidden` to `session-only` in the portable declaration and
then in the hydrated route. The frozen head did not move, so `SOURCE_DRIFT` never fires, and there is
no code for a route authority that changes under a live session. The `routeFingerprint` this receipt
carries (`sha256:1e488f3b…`) recomputes to `sha256:38b07641…` today. The branch was left exactly as it
ran, as evidence; see G1 and O1.

---

## Step 2 — `frontend.direction.decide`, parallel-1

**Status** `done`. No stop. No fallback taken.
**Profile** `operator.json` binds `sol-fresh` (`gpt-5.6-sol`, OpenAI runtime, permits web search, browser, image generation and source write); run here by Claude Opus.

**Validators**

```text
$ node .claude/scripts/validate-request.mjs <session>/step-2/parallel-1
request valid

$ node .claude/scripts/validate-response.mjs <session>/step-2/parallel-1
response valid

$ node .claude/operators/frontend-direction-decide/validate.mjs <session>/step-2/parallel-1
valid frontend.direction.decide branch
```

**Artifacts** `response/response.md` (kind `frontend-direction-decision`),
`response/data/coverage.json` (kind `ui-coverage`), `response/response.json`. No candidate page and no
image were rendered: one candidate under `preview: no` produces none, and the operator's validator
rejects a page in that configuration.

**The UI contract.** Nineteen elements: eight regions (`dashboard-shell`, `identity-rail`,
`panel-track`, `overview-lead`, `overview-streak`, `overview-metrics`, `overview-support`,
`overview-updates`), six states, three responsive branches, one content row and one accessibility
row. The direction's thesis is narrow and evidenced: the dashboard hand-builds a rail beside a main
track — sticky offset, `lg:h-[calc(100dvh-4rem-2rem-1px)]`, `lg:w-64`, `lg:border-r`, a bounded
scroll lane, `max-w-5xl mx-auto`, and a `matchMedia("(max-width: 69.999rem)")` listener driving a
compact drawer — while `PrimaryRailLayout` already owns exactly that relationship and is live three
times in the same checkout (`CourseCommunity:251`, `ProSubscriptionBlock:202`, `CoursePersonalProject`).
The candidate `rail-owned-column` hands both tracks to `PrimaryRailLayout`, the sticky bound and the
rail's own scroll to `Rail mode="sticky"`, the page measure and inset to `PageContainer`, and the one
reflow to the published container query at inline-size `56rem`, retiring the application drawer whose
only job was to reproduce that reflow. Business facts, blocks, panels and reading order are untouched.

**Coverage.** `coverage.actions` is empty and that is a decision, not an omission: once the compact
drawer and its back control are retired, the surface initiates nothing of its own — every action on
screen belongs to a block or to the navigation above the route. Eight regions each carry one
published composition and one playbook or idiom reference; six state meanings each carry their own
carrier with no carrier shared; three responsive branches each name exactly one owner. `COVERAGE-1`
holds under the operator's own check.

**Images judged.** The `## Images` table is empty. The operator's image policy is `judged`, so the
decision was made rather than deferred: no region of this surface reads empty. The overview is eight
data-bearing blocks with their own labels, measures and empty states; the rail carries identity and
shortcuts. Under the operator's own rule — "a region that the copy and the Grammar objects already
carry gets no image" — nothing here earns one, and no image generation was invoked.

**Bounded research.** References were empty and the change level is `reconstruct`, so step 6 ran. One
web search returned generic dashboard-layout advice (F-pattern scanning, type hierarchy, a
"setup, change, next step" narrative). None of it survived: the playbook's `Learner dashboard` row
already fixes what a reference is allowed to contribute — which sections exist, their reading order,
and which one is the next action — and explicitly refuses grid geometry, card chrome and densities,
which is all the sources actually offered. No page was fetched, so no limitation could be verified
against a source, and `## References` carries no row rather than a row nobody checked.

**Falsification.** Thirteen attacks, all `holds` for the one candidate: business and backend
conformance, hierarchy, content density, action feedback, recovery, responsive reflow, content
stress, keyboard and focus, accessibility, family coherence, reversibility, owner leakage. The owner
leakage row is the one that had to be argued rather than asserted, and it was nearly the run's
honest failure. The support region reaches into a block's anatomy with
`max-lg:[&_[data-part=calendar-viewport]]:!overflow-x-auto` and two siblings. Marked `fails`, the only
candidate dies and the operator stops with `NO_VIABLE_DIRECTION`. It is recorded `holds` on a
defensible boundary: at composition level every region resolves to a published composition and no
region is owned by an application arrangement, while the surviving leak is a *class*, and
`frontend.presentation.resolve` step 7 publishes the exact mechanism for a class that overrides
Grammar anatomy — remove it with its own row and record the missing public path under `## Gaps`,
which is what step 3 then did. The operator's falsification list does not distinguish composition
leakage from class leakage, and that ambiguity is recorded below as O12.

---

## Step 3 — `frontend.presentation.resolve`, parallel-1

**Status** `done`. No stop. No fallback taken.
**Profile** `operator.json` binds `sonnet`; run here by Claude Opus.

**Validators**

```text
$ node .claude/scripts/validate-request.mjs <session>/step-3/parallel-1
request valid

$ node .claude/scripts/validate-response.mjs <session>/step-3/parallel-1
response valid

$ node .claude/operators/frontend-presentation-resolve/validate.mjs <session>/step-3/parallel-1
valid frontend.presentation.resolve branch
```

**Artifacts** `response/response.md` (kind `frontend-presentation-resolution`),
`response/data/inventory.json` (kind `inventory`),
`response/artifacts/dashboard.resolved.tsx` (kind `resolved-tree`), `response/response.json`.

**Owner map.** Eleven rows. Five are Grammar-owned and emit no application class: `PageContainer`
holds the page measure (`MEASURE-1`), `PrimaryRailLayout` the region gap (`GAP-5`), and `Rail` the
frame gap (`GAP-4`), the body inset (`PADDING-3`) and the body's block scroll (`OVERFLOW-3`). Six are
application-owned across four containers: the primary-slot panel, the overview column, and the lead,
metrics and support bands.

**Rules chosen.** `GAP-5` → `gap-6` on the panel and on the overview column (GAP-5 Case 2, the
standing rhythm between top-level dashboard sections); `MEASURE-2` → `w-full` on the panel (Case 1,
the region follows the width its host supplies); `GAP-4` → `gap-4` on lead, metrics and support
(Case 1, stacked blocks sharing one purpose). The ordinal-to-step check passed: `GAP-5` renders
`gap-6`, never `gap-5`. Inventory: three rule ids (`GAP-4`, `GAP-5`, `MEASURE-2`), seven class tokens,
all present in the resolved tree, and every applied rule claimed under a `data-contract` token, since
emission is on.

**Removed.** Twenty-seven rows across six nodes, each with one of the three published reasons. The
frame's flex-direction and scroll-padding entries and the rail's `lg:sticky`, `lg:border-r`, `px-3`
and `py-6` go as *reimplements an owned relationship*; the four `calc()` heights and offsets,
`lg:w-64`, `lg:max-w-64`, `lg:h-0` and the subnav's `!top-[calc(6rem+1px)]` go as *off the closed
scale*; the main track's `max-w-5xl`, `mx-auto`, `px-3` and `py-6` go as *reimplements an owned
relationship*, because `MEASURE-1` says in as many words that recreating the page width with a cap
and a centring margin reproduces a component the page already has. The three descendant overrides on
the support region and the subnav toggle's `!size-11` go as *overrides Grammar anatomy* — the leak
step 2 handed down, removed here exactly as that hand-off predicted.

**Gaps.** One row, and it is the honest residue of that removal: Common exposes no public path for
bounding the contribution calendar's inline axis from outside the block that renders it.
`OverviewContributions` must compose `HorizontalScrollRegion` itself, and the family's own DNA already
records that `HorizontalScrollRegion` "owns nothing an audit can measure". Per the operator's rule
that a missing public path is a gap and not a stop, the branch recorded it and continued.

**Every `RULE_MISSING`.** None. Every property the walk reached resolved to a published case. Three
resolutions were close calls and are recorded as knowledge gaps rather than stops: the `Rail` height
and scroll conflict (K2), the doubled `Rail` padding row (K3), and the page inset that no rule id
addresses (K6).

---

## Step 4 — `frontend.source.apply`, parallel-1

**Status** `done`. No stop. No fallback taken. Mode `dry`.
**Profile** `operator.json` binds `opus` (`claude-opus-5`, the only profile in the chain that permits `sourceWrite` and is bound for it); run here by Claude Opus.

**Validators**

```text
$ node .claude/scripts/validate-request.mjs <session>/step-4/parallel-1
request valid

$ node .claude/scripts/validate-response.mjs <session>/step-4/parallel-1
response valid

$ node .claude/operators/frontend-source-apply/validate.mjs <session>/step-4/parallel-1
valid frontend.source.apply branch
```

**Artifacts** `response/response.md` (kind `frontend-source-application`), `response/changes.md`
(kind `changes`), `response/data/writes.json` (kind `writes`), `response/response.json`. `commits` is
empty and `writes.commit` is `null`.

**Write plan.** Five declared paths, each hashed at the frozen head. Four are projected `modified`
with a null after-hash, which is what `dry` means: `component.tsx` becomes the resolved tree;
`classNames.ts` keeps only the seven published class tokens; `index.tsx` stops owning the compact-rail
media query and the drawer open value; `component.spec.tsx` is rewritten in the same commit because
it asserts the retired subnav, drawer and rail-presentation props sixty-one times, and a write that
leaves its own specs failing is not a write. The fifth, `src/app/[lang]/dashboard/layout.tsx`, is
declared `unchanged` with equal before and after hashes: it is a route-family ancestor layout outside
`surface-and-nested-layouts`, declared so it is hashed and proven untouched rather than so it may be
written.

**`WRITE_REJECTED`.** None, and the `## Rejections` table is empty. Every class in the plan
(`flex`, `flex-col`, `flex-1`, `w-full`, `min-w-0`, `gap-6`, `gap-4`) appears in the resolution
inventory the request bound, which the validator read back beside the receipt. The checkout is
untouched at `14e0c20f…`, no session worktree exists, and no branch was cut — which, when this branch
ran, was the only lawful outcome anyway, because the route bound at step 1 forbade worktree branches
entirely. The declaration has since moved to `session-only`, so an `apply` run today would be
permitted where the same run an hour earlier would not.

---

## Step 5 — `frontend.surface.audit`, parallel-1

**Status** `blocked`. Stop `RUNTIME_UNAVAILABLE` (registered in `operators/errors.json`, scope
`frontend.surface.audit` and `uat.verify`, disposition `terminate`, domain `platform`).
**Profile** `operator.json` binds `sol-reviewer` (`gpt-5.6-sol`, fresh, browser only); run here by Claude Opus.

**Validators**

```text
$ node .claude/scripts/validate-request.mjs <session>/step-5/parallel-1
request valid

$ node .claude/scripts/validate-response.mjs <session>/step-5/parallel-1
response valid

$ node .claude/operators/frontend-surface-audit/validate.mjs <session>/step-5/parallel-1
valid frontend.surface.audit branch
```

A valid `blocked` is green, and both validators treat it as such: the required outputs are enforced
only for a `done` branch.

**Artifacts** `response/response.json` and nothing else. That is not a shortcut; it is the only shape
available, and it is defect O3.

**Reachability, probed before anything was claimed.** The registry
`.worktrees/sessions/central-runtime/owner.json` advertises generation 6, status `ready`, frontend at
`http://localhost:3000`, last attested 2026-09-01 at head `5fe51662…`. The probe contradicts it:

```text
$ curl -s -o /dev/null -w "%{http_code}" --max-time 8 http://localhost:3000/en/dashboard
000
$ curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:3001/
000
$ Get-NetTCPConnection -State Listen -LocalPort 3000,3001,8080
LocalAddress LocalPort OwningProcess
::1               8080         38888
::                8080         20388
```

Only the identity service listens. Nothing serves the frontend route, so readiness at step 4 of the
operator cannot be reached for any matrix entry. The operator never starts a runtime, so the branch
blocks and `routing.json` sends the `platform` domain to `platform.operate`.

**The matrix.** Empty, and it could not have been anything else. Two independent reasons stack. The
first is the probe above. The second is structural: `mode = dry` produced no commit, and the audit's
own step 1 requires the applied receipt's commit to equal the pinned head and the preview to serve
the session worktree *at that commit*. With `commits: []` there is no such commit and no such
worktree — and there is no stop code for "the applied receipt carries no commit", so the runtime would
have reached the readiness step regardless and blocked there. Nothing was captured, nothing was
measured, and no verdict was recorded for a node that was not measured.

---

## Defects this run exposed

### Knowledge gaps

- **K1 — no idiom covers a page-level region.** `COVERAGE-1` Case 3 requires every region to name one
  idiom in `playbook.md`, but every idiom in `idioms.md` is card-level. `dashboard-shell`,
  `identity-rail` and `panel-track` had to cite the playbook's shape row instead of an idiom, because
  no idiom exists for a shell, a rail or a primary track.
- **K2 — a rail cannot both fill and scroll.** `overflow.md` OVERFLOW-3 Case 3 names `Rail` as the
  owner of a rail body that scrolls, while the generated owned tables condition `Rail` on
  `height!="fill"` for OVERFLOW-3 and on `height="fill"` for MEASURE-6. The direction had to choose
  `height="content"` and give up the filled height to keep a published scroll owner.
- **K3 — one condition, two padding rules.** `padding.md` lists `Rail | body, inset="content"` twice,
  once as PADDING-3 and once as PADDING-5. A receipt claiming the rail's inset cannot say which.
- **K4 — `min-w-0` is mandatory and unaddressable.** `measure.md` requires it on every region that can
  receive long content, but no numbered rule owns it, so it is a class with no rule id: it cannot be
  claimed under `data-contract` and the audit cannot measure it.
- **K5 — a missing composition has two contradictory answers.** `layout.md` LAYOUT-2 Case 4 lets a
  region resolve "to a recorded gap" and continue; LAYOUT-1 Case 6 turns the same situation into
  `GRAMMAR_REQUIRED`, which the operator's Stops table terminates on. This run met the situation (no
  published composition offers a peer two-up band) and had to reason its way out by removing the
  parallel band rather than demanding a component.
- **K6 — the page inset has no rule id.** `--grammar-page-inset` is explicitly off the padding scale,
  so `PageContainer`'s inset ownership cannot be written into the Owner map at all, whose `Rule`
  column requires a `PREFIX-n`. Only its `MEASURE-1` half is recordable.

### Operator and contract defects

- **O1 — `route.schema.json` cannot express the live policy.** Its `worktreeBranches` enum is
  `["forbidden","allowed"]`; the portable route schema publishes `["forbidden","session-only"]`. The
  value the declaration now carries has no representation in a route receipt, and `allowed` is a value
  no declaration can produce.
- **O2 — `workspace-route-binding` has no `## Fallbacks taken` section**, yet `validate-response`
  reconciles `response.fallbacks` against that heading in the main markdown. Latent today, because
  every code `workspace.bind` may emit terminates; live the moment one does not.
- **O3 — a blocked audit cannot say why.** `frontend-surface-audit.contract.json` requires at least
  one row in `## Matrix` and in `## Verdicts by owner`, so a branch that blocks before capture — the
  expected outcome whenever no preview exists — cannot emit its receipt without fabricating a matrix
  entry and a verdict. This run's step 5 carries a stop code and no prose anywhere in-band.
- **O4 — the Owner column has two values where the knowledge publishes three.**
  `frontend-presentation-resolution.contract.json` allows `app|grammar`; presentation knowledge
  publishes `App`, a component name, and `—`. A `—`-owner node has to be written as `app` plus a
  `## Gaps` row; the receipt cannot say "nobody owns this".
- **O5 — a rule whose render is more than one token cannot be recorded.** In `## Rules chosen` the
  `Class` cell is compared with `inventory.classNames.includes(cell)`, and `classNames` items may not
  contain spaces. The published side-contact renders (`px-4 py-3`, PADDING-4 Cases 6 and 7) are
  therefore unwritable in one row.
- **O6 — a dry plan and a deletion look alike.** Under `mode = dry` the validator rejects any file
  whose `before !== after` unless `after` is null, so every touched path reports `after: null`, which
  is exactly the shape of a `deleted` file; only `change` disambiguates.
- **O7 — `workspace.bind`'s `## Next` table cannot express this workflow's own first transition.** It
  routes to `git.publish`, `backend.source.apply`, `frontend.source.apply` and `platform.operate`, but
  `frontend-reconstruct`, `frontend-new-surface` and `frontend-refine` all go from step 1 to
  `frontend.direction.decide`. `scripts/validate-workflows.mjs` never reads a Next table, so the
  mismatch is unchecked.
- **O8 — the same for the audit.** Its `## Next` lists `frontend.presentation.resolve`,
  `quality.verify` and itself, while `routing.json` sends its `platform` domain to `platform.operate`.
  This branch's `next` therefore names an operator its own `operator.md` does not.
- **O9 — the UAT alias and the disk disagree.** `@worktrees/uat` declares `flow.md`, `account.json`,
  `seed/`, an append-only `runs/<runId>/` and a `latest` link; `.worktrees/uat/dashboard/landing-tabs`
  and `session-boundary` carry only `result.json` and `snapshot.json`.
- **O10 — a read-only binding is unrepresentable.** `declaredWriteRoots` defaults to empty while
  `route.schema.json` requires `writeRoots` to hold at least one item.
- **O11 — `mutationReadiness` has no stated derivation.** On the mutation branch under
  `worktreeBranches: forbidden`, both `ready` and `read-only` pass the validator; this run chose
  `ready` and the sibling `frontend-refine` run in this same folder chose `read-only` on the same
  route.
- **O12 — the falsification list does not separate composition leakage from class leakage.**
  `frontend.direction.decide` must attack "owner leakage" and a direction is invalid while an owner
  leak remains, but a class that overrides Grammar anatomy is explicitly
  `frontend.presentation.resolve`'s to remove. Read strictly, any inherited class-level leak kills
  every direction on that surface with `NO_VIABLE_DIRECTION`.

### Orchestrator gaps

- **G1 — route authority can change under a live session and nothing notices.** Mid-run, another
  session rewrote both halves of the starci-academy/fe route from `worktreeBranches: forbidden` to
  `session-only`. `SOURCE_DRIFT` covers the checkout head only; the step-1 receipt now describes a
  policy that no longer exists, its `routeFingerprint` no longer recomputes, and no stop code and no
  validator says so.
- **G2 — the workflow guarantees its own audit will block.** `frontend-reconstruct` presets
  `workspace.bind` with `role: fe` and nothing else, so `runtimeNeed` defaults to `none` and no
  endpoint is ever bound — while step 5 is an audit whose whole job needs a served route. The chain
  cannot reach a capture on its own presets.
- **G3 — nobody owns the write roots.** Step 4 writes source, but the workflow presets no
  `declaredWriteRoots` and no rule says where they come from. The orchestrator invented three, which
  is precisely the kind of authority `workspace.bind` refuses to take from a hint.
- **G4 — nothing says whether a caller may override a preset.** `frontend-reconstruct` presets
  `mode: apply`; this run was instructed to use `dry`. Neither the workflow file nor
  `validate-workflows.mjs` nor the request gate has anything to say about that.
- **G5 — `fanout: "matrix"` has no set to fan out over.** `ui-coverage.schema.json` enumerates
  actions, regions, states and responsive branches; it carries no viewport × scheme × state matrix.
  The audit's `matrix` default is "every coverage entry", and that is not a set the orchestrator can
  split across three branches.
- **G6 — `state.json` is unvalidated.** The orchestrator manifest is mandated in prose, but no schema
  covers it and no script reads it except the request-hash comparison inside `validate-request.mjs`.

---

## What is on disk

`.worktrees/sessions/20260903-dryrun-frontend-reconstruct/` was kept: `state.json` plus five
`step-N/parallel-1/` branches, each with its `request/request.json` and its `response/`. The frontend
checkout is untouched and clean at `14e0c20f4746ae08f00a84a4eac18aa78ded987b`, and no file under
`.claude/` was edited except this report and its Vietnamese mirror.

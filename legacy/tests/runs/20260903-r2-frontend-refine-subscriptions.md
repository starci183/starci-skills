# Run — frontend-refine on the Pro subscription surface, round 2 (2026-09-03)

Second dry run of the same workflow on the same target, against tree 1.0.3 and a frontend head two
commits ahead of round 1. The question this round was asked to answer is narrow: does
`frontend.presentation.resolve` now pass the route block inset with `PADDING-9` and remove the accent
marker class instead of stopping `RULE_MISSING`, and does `frontend.source.apply` then run with
`mode: dry`. The first half is answered yes. The second half never got its turn, and the reason is
recorded below rather than smoothed over.

Session root `.worktrees/sessions/20260903-r2-frontend-refine/`, gitignored, kept on disk. One
orchestrator plus one agent per branch, all inside one process. Nothing was committed, nothing was
written into the frontend checkout, no git write command was run anywhere, no e2e was run, no secret
was read. Every branch names the profile its `operator.json` binds and every branch was actually run
by Claude Opus standing in for it, under `resources/orchestrator.json#profileEquivalents`. That
matters twice over here: `workspace.bind` and `frontend.presentation.resolve` bind `luna`, whose
declared Claude equivalent is `sonnet`, so Opus was not even the declared stand-in for three of the
four branches, and no profile boundary was exercised in this round either.

## Request summary

| Field | Value |
| --- | --- |
| Workflow | `frontend-refine` |
| Target | `/[lang]/subscriptions` — `src/app/[lang]/subscriptions/page.tsx`, the one route that renders `ProSubscriptionBlock` through `ProSubscriptionPage` |
| Frozen frontend head | `8d8ed9a1456e1e8ef9d1d6fd80a41c20a520d3a2` (`git -C D:\Repositories\starci-academy-fe rev-parse HEAD`, read-only; round 1 froze `14e0c20f`, and `f7167fa` + `8d8ed9a` landed since) |
| Knowledge head | `3d30a88e4b5a4e56fab5502b54621b738be5654b` on `main` of `.claude` (INDEX 1.0.3), with `package.json` dirty in the working tree when the run froze it; by the end of the run another session had committed `f6ca8fb3` and `74108a4b` and the tree calls itself 1.1.0 |
| Grammar package | `@starci/grammar@0.4.2` |
| Chain the workflow declares | bind (`runtimeNeed: consume`) → direction → resolve → apply (`mode: apply`) → audit (matrix) → quality → publish |
| Chain actually run | 1 `workspace.bind` blocked → 2 `workspace.bind` resumed, done → 3 `frontend.direction.decide` done → 4 `frontend.presentation.resolve` resolved the whole tree and failed its own validators |
| Caller overrides | source-writing operators run `mode: dry` only, so step 5 would have carried `dry` against the workflow's `apply` preset |

Requirements came from the workflow presets plus each operator's stated defaults. `project` and
`target` again had no default and were derived exactly as in round 1. `declaredWriteRoots` was
declared as `src` by the orchestrator, because no file says who owns it; that gap is unchanged.

---

## Step 1 — `workspace.bind`, parallel-1

**Status** `blocked`. **Stop** `RUNTIME_NOT_READY`, domain `runtime`, which `routing.json` answers
with `{"kind": "external"}`.
**Profile** `operator.json` binds `luna`; run by Claude Opus standing in.

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

The `validate-response.mjs` CLI defect round 1 reported is fixed: every branch of this round validated
from its own CLI with the correct exchange, and the four spurious errors are gone.

**Artifacts written** `response/response.json` only, with the new optional `reason` paragraph. A
blocked bind writes no receipt and no `route.json`, and `operators/workspace-bind/validate.mjs`
enforces that ("a blocked branch cannot carry a route"), so `reason` is the only place the branch had
to explain itself. It is the second round-1 fix this run exercised, and it worked.

**What the branch found.** Steps 1 to 4 passed exactly as in round 1: the portable declaration and the
hydrated route agree, the sibling checkout resolves to `D:\Repositories\starci-academy-fe` on `main`,
clean, at `8d8ed9a1`. The routed Git policy is now `session-only` with mutation branch `main`, so the
contradiction round 1 found between `sourceWrites` and a `forbidden` route is gone and a source-writing
branch has a legal place to commit. Step 5 ran, because the workflow preset now raises `runtimeNeed`
to `consume`, and that is where it stopped. `.worktrees/sessions/central-runtime/owner.json` declares
generation 6 with `status: ready`, but its newest attestation is `2026-09-01T19:54:08Z` against head
`5fe51662…`, which is neither this session's head nor round 1's, and nothing is listening now:

```text
$ curl -s -o /dev/null -w "%{http_code}" -m 5 http://localhost:3000/en/subscriptions
000
$ curl -s -o /dev/null -w "%{http_code}" -m 5 http://localhost:3001/
000
```

A registry that claims ready while no declared endpoint serves is stale, which is `RUNTIME_NOT_READY`.
A second, independent defect in the same registry was recorded and is not what the branch stopped on:
its `identity` endpoint is `http://localhost:8080`, while `.workspaces/ports/starci-academy` (offset
0, slot step 1000) plus the project convention gives 8089; on its own that is
`ENDPOINT_AUTHORITY_STALE`. The misspelt route `/vi/subcribtions` in the latest frontend attestation
is still there too.

---

## Step 2 — `workspace.bind`, parallel-1 of the next step, resumed

**Status** `done`. No stop. No fallback.
**Profile** `operator.json` binds `luna`; run by Claude Opus standing in.

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

**Why this branch exists.** `RUNTIME_NOT_READY` routes to `external`, so the chain was over as far as
the runtime does the deciding. The person who scoped this round owns that decision, and the decision
they had already stated is the reduced chain: bind → direction → resolve → apply in `mode: dry`, with
`frontend.surface.audit` outside the round. No branch of that chain consumes an endpoint. The resume
therefore carries exactly one delta, a requirement rather than an observation, and says so in its
token: `runtimeNeed` from `consume` to `none`. It is a real delta, so `NO_PROGRESS` does not apply,
and the blocked branch stays on disk as evidence.

**What the branch found.** The same binding as round 1 with three changes: the head is `8d8ed9a1`, the
worktree policy is `session-only`, and `mutationReadiness` is therefore `ready` rather than
`read-only`. `writeRoots` is `["src"]` and the `route.schema.json` `minItems: 1` defect from round 1 is
fixed, so a read-only bind would now also be expressible. `authorityRoots.businesses` is `null`,
correctly, for a sibling checkout. Findings recorded: `ROUTE_HYDRATED_FROM_PORTABLE`,
`IDENTITY_ROSTER_SEALED`; `WORKTREE_BRANCH_FORBIDDEN` is gone with the policy that produced it. One
thing the receipt could only say in prose: the hydrated route file still records
`head: 14e0c20f…`, two commits behind the checkout it points at. No rule makes that a stop, and there
is no finding code for it.

Fingerprints were derived as in round 1 and the derivation is still unspecified anywhere:
`routeFingerprint` is the SHA-256 of the hydrated route file, `identityFingerprint` the SHA-256 of
`.workspaces/device-state.json`.

---

## Step 3 — `frontend.direction.decide`, parallel-1

**Status** `done`. No stop. No fallback taken.
**Profile** `operator.json` binds `sol-fresh`, whose declared Claude equivalent is `opus`; run by
Claude Opus, the one branch of this round whose stand-in is the declared one. `@tools/websearch` was
not used: a refine works from the family idioms alone, and the operator's own validator refuses a
reference row on a refine.

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
image, for the same reason as round 1: one candidate under `preview: no`, and no region of this surface
reads empty.

**What the branch found.** The same direction as round 1, `pro-subscription-refine`, classification
`locked-refine`, candidate `resting-status-truth`, twelve attacks all `holds`, five regions, four
actions, seven state meanings with seven carriers, two responsive branches. This is the honest
description of how it was produced: the observations were re-read at the new head one by one and every
evidence line in `## Observed` was re-anchored to `8d8ed9a1` before the receipt was accepted, and where
an observation was unchanged the round-1 wording was reused rather than reworded for the sake of it.
Nothing in the two intervening commits touches this block: `f7167fa` and `8d8ed9a` are Grammar
changes, and the container query that owns the rail stack still sits at
`packages/grammar/src/common/styles.css:986-990`, `PrimaryRailLayout` still publishes only `railWidth`
and `align` (`packages/grammar/src/core/composition/PrimaryRailLayout/index.tsx:4-35`), and the block's
own two files are byte-identical to round 1 apart from line drift.

---

## Step 4 — `frontend.presentation.resolve`, parallel-1

**Status** `done` as the agent emitted it, and **not green**: the response fails `validate-response`
and the operator's own validator, so it does not route. No stop code was emitted, because none of the
eight codes in the operator's Stops table describes what happened, and inventing one is not available.

**Profile** `operator.json` binds `luna`, declared Claude equivalent `sonnet`; run by Claude Opus
standing in.

**Validators**

```text
$ node scripts/validate-request.mjs <session>/step-4/parallel-1
request valid

$ node scripts/validate-response.mjs <session>/step-4/parallel-1
step-4/parallel-1/response/response.md:138: row 14 cell Because "`SURFACE-4` Case 2 publishes this pairing only for a leading marker inside a raised region, and this marker sits on the unraised card face" does not match ^(reimplements an owned relationship|overrides Grammar anatomy|off the closed scale)$

$ node scripts/validate-step.mjs <session>/step-4/parallel-1
step-4/parallel-1/response/response.md:138: row 14 cell Because "`SURFACE-4` Case 2 publishes this pairing only for a leading marker inside a raised region, and this marker sits on the unraised card face" does not match ^(reimplements an owned relationship|overrides Grammar anatomy|off the closed scale)$

$ node operators/frontend-presentation-resolve/validate.mjs <session>/step-4/parallel-1
step-4/parallel-1/response/response.md:138: row 14 cell Because "`SURFACE-4` Case 2 publishes this pairing only for a leading marker inside a raised region, and this marker sits on the unraised card face" does not match ^(reimplements an owned relationship|overrides Grammar anatomy|off the closed scale)$
response/data/inventory.json: rule MARGIN-6 is applied and no node claims it under data-contract
```

**Artifacts written** `response/response.md` (kind `frontend-presentation-resolution`),
`response/data/inventory.json` (kind `inventory`),
`response/artifacts/pro-subscription-refine.resolved.tsx` (kind `resolved-tree`),
`response/response.json`. Steps 8 and 9 of the operator ran for the first time in any round, so this
is the first inventory and the first resolved tree the runtime has produced, and both of the failures
above come from that new ground.

**The two round-1 knowledge fixes both work.** This is the answer the round was asked for:

- `block>main` and `block>main[failed]` carry `py-6 sm:py-8`. `PADDING-9` Case 1 publishes exactly that
  condition — the `main` of a routed block directly under the page shell, block axis only, inline sides
  left to `PageContainer` — and it was selected without hesitation. Its ordinal is 9, above the
  `ORDINAL_TO_STEP` map, so the class-step check correctly skips a composite. Round 1's first
  `RULE_MISSING` is gone.
- the `IncludedMark` of each benefit row carries `text-accent-soft-foreground`, and the new operator law
  "A forbidden class is removed, not ruled" resolves it: `SURFACE-4` Case 2 publishes that pairing only
  inside a raised region, this marker sits on the unraised card face, the case has answered no, and the
  class is removed at step 7. The marker falls back to the inherited foreground the component is
  designed for (`packages/grammar/src/core/primitive/IncludedMark/index.tsx`, an outlined circle-check
  "in inherited foreground" drawn with `currentColor`). Round 1's second `RULE_MISSING` is gone.

The walk ended with **zero `RULE_MISSING`, zero `KNOWLEDGE_UNBOUND`, zero `UNKNOWN_RULE`**: 47 owner
rows, 41 chosen rule rows over 17 rules, 14 removals, 4 gaps, and every rule in the inventory published
by `@knowledge/ui/presentation`.

**Where it failed, and why the branch did not make it pass.** Two places, both in the tree rather than
in the surface:

1. The removal above has no permitted reason. `## Removed` publishes a closed three-value enum, and
   none of the three is true of this class: `IncludedMark` publishes `className` as part of its public
   props, so a passed class is not an anatomy override; the class reimplements no owned relationship;
   and `text-accent-soft-foreground` is on the published colour scale, not off it. The operator's own
   new law says the removal "is recorded with the case that refused it", and there is no column for a
   case and no reason value that means refusal. The branch wrote the true sentence and let the
   validator reject it. Writing one of the three permitted reasons instead would have been a false
   statement about why a class left the tree, which is the one thing this operator exists to refuse.
2. `MARGIN-6` cannot be claimed. The application owns the rhythm between the orientation stack and the
   workspace, and the only node that can carry it is `PrimaryRailLayout`, whose `className` reaches the
   container div while every other prop is destructured away. With `contractEmission: on`, step 8 has
   nowhere to put `data-contract="MARGIN-6"`, and the validator requires every applied rule to be
   claimed on the tree. Dropping `MARGIN-6` from the inventory would have made the branch green by
   hiding an applied value, so it stayed.

**One defect the run hit and worked around, having established it first.** The receipt's `## Gaps`
rows and `inventory.gaps` must be equal strings, and `tableUnder`'s `unquote` strips a leading
backtick from every cell independently of a trailing one. A Missing path that opens with a code span,
which is the natural way to write "`PageContainer` publishes no gap prop", therefore arrives at the
comparison as ``PageContainer` publishes no gap prop`` and can never equal the JSON. Observed as:

```text
response/response.md: the Gaps table and inventory.gaps differ (4 rows against 4)
```

The four gap sentences were reworded so that none begins with a code span, which is a workaround in the
receipt for a defect in the validator, and the row count in the message is what makes it hard to find:
it says the two lists differ while printing two identical counts and naming no row.

**The owner map and the removals, in short.** Grammar owns the region gap of `PrimaryRailLayout`
(`GAP-5`), the joined card's content gap and inset (`GAP-0`, `PADDING-0`), the accordion trigger inset
(`PADDING-4`), the `SurfaceCopyGroup` gap (`GAP-2`), the price rank once it moves to
`Text size="metric-lead"` (`FONT-5`), and the `EmptyNotice` inset and gap. The application owns the
rest. The fourteen removals are round 1's thirteen — six `proWorkspaceClassName` overrides reaching
into Grammar anatomy, `gap-5` off the closed scale, the four typography classes on the price span, the
disclosure summary's `text-left`, and `rounded-medium` off the closed scale — plus the accent marker
foreground. The four gaps are `PageContainer` with no region-rhythm prop, `PrimaryRailLayout` with no
rail-order prop, `Button` with no full-width or wrapping prop, and `IncludedMark` with no size or
alignment prop; the last of these lost its tone half this round, because the tone is now answered by a
refusal rather than missing.

---

## Step 5 — `frontend.source.apply`, not dispatched

**Profile it would have bound** `luna`. It did not run.

`frontend.source.apply` declares `frontend-presentation-resolution` as a **required** input. Step 4's
response does not route: it fails both validators, and only a validated field of `response.json`
routes. Pointing step 5 at the receipt anyway would have validated cleanly — `validate-request.mjs`
checks that an input path exists inside the session and never reads the producing branch's
`response.json`, which is round 1's first orchestrator gap, still open — and it would have been a
fabricated green. So `mode: dry` is untested for the second round running, and this is what can be said
about it without running it, from `operator.md` and `operators/frontend-source-apply/validate.mjs` at
this head: the mode exists now, `writes.json` carries `mode`, a null `commit` and `files`, and the
validator holds a dry branch to a null commit, no `commits` entry, and no file whose `before` differs
from a non-null `after`. That last clause means a dry plan can only be expressed with `after: null`,
so the plan can say which paths it would move but not what they would contain; and `writes.branch` is
still required to be `session/<sessionId>` under a mode that creates no branch.

`frontend.surface.audit` was outside this round by the person's own scoping, and could not have run in
any case: no endpoint serves, which is what step 1 stopped on.

---

## Defects and proposed fixes

### 1. `## Removed` cannot state the reason the operator's own law produces

**File** `templates/kinds/frontend-presentation-resolution.contract.json`.
**Evidence** `operators/frontend-presentation-resolve/operator.md`, "A forbidden class is removed, not
ruled": "the removal is recorded with the case that refused it". The contract's `Because` cell is
`^(reimplements an owned relationship|overrides Grammar anatomy|off the closed scale)$`. This run's
`validate-response` output above. Round 1 reported the same enum as too narrow (operator/contract
defect 6) and it was not changed; the new law has now put it on the main path, so the very case the
knowledge round was fixed for cannot be written down.
**Proposed change** widen the cell to carry the refusing case, and keep the three taxonomy reasons:

```json
"Because": "^(reimplements an owned relationship|overrides Grammar anatomy|off the closed scale|refused by [A-Z][A-Z0-9-]*-[0-9]+ Case [0-9]+)$"
```

and add one line to `frontend-presentation-resolution.skeleton.md` showing the fourth form
(`| `…>IncludedMark` | `text-accent-soft-foreground` | refused by SURFACE-4 Case 2 |`). A fourth free
value such as "the composition decision changed" is deliberately not proposed: the refusal has an
address, and the address is what a later audit needs.

### 2. A claim has nowhere to land when the application styles a Grammar component through `className`

**File** `operators/frontend-presentation-resolve/validate.mjs` (the `contractEmission === 'on'` loop)
and `operator.md` step 8.
**Evidence** `MARGIN-6` / `mt-8` is written on `PrimaryRailLayout`
(`src/components/blocks/commerce/ProSubscriptionBlock/component.tsx:202-204` at `8d8ed9a1`), and
`packages/grammar/src/core/composition/PrimaryRailLayout/index.tsx:16-22` destructures `primary`,
`rail`, `railWidth`, `align`, `className` and forwards nothing else, so no `data-contract` attribute
can be passed. The validator message is in this run's output above. The same shape will occur wherever
Common publishes `className` but no prop for the relationship the application owns, which is exactly
the situation the `## Gaps` table exists for; three of this surface's four gaps are that shape.
**Proposed change** make the emission check skip a rule whose owner-map node is a Grammar component,
and make the receipt say so instead of leaving it silent. Concretely: in `validate.mjs`, before
`errors.push('… is applied and no node claims it under data-contract')`, skip the rule when the
receipt records that node under `## Gaps`; and add to `operator.md` step 8 one sentence — "a property
the application owns on a Grammar component's `className` carries no attribute, and its rule is
recorded under `## Gaps` instead". The alternative, forwarding `data-contract` from every Common
component that accepts `className`, is a Grammar change and belongs to the family owner, not here.

### 3. `unquote` strips a leading backtick, so a Gaps sentence may never open with a code span

**File** `scripts/validate-response.mjs`, `const unquote = (s) => String(s ?? '').trim().replace(/^`|`$/g, '')`.
**Evidence** this run's `the Gaps table and inventory.gaps differ (4 rows against 4)`, with all four
rows differing only by a leading backtick, e.g. the receipt yielding
``PageContainer` publishes no gap or region-rhythm prop…`` against the JSON's
``` `PageContainer` publishes no gap or region-rhythm prop… ```. Every consumer of `tableUnder` is
affected, not only the resolve validator.
**Proposed change** unquote only a fully quoted cell:

```js
const unquote = (s) => { const t = String(s ?? '').trim(); return /^`[^`]*`$/.test(t) ? t.slice(1, -1) : t; };
```

and, in `operators/frontend-presentation-resolve/validate.mjs`, name the first differing row in the
message instead of printing two counts.

### 4. The `runtimeNeed: consume` preset makes the whole refine chain unreachable

**File** `workflows/frontend-refine.json` (and the four other frontend workflows that took the same
preset).
**Evidence** step 1 of this run. Only step 5, `frontend.surface.audit`, consumes an endpoint, and
`workspace.bind` stops the chain at step 1 when the shared runtime is down, so direction, resolve and
apply — none of which touches a port — cannot run at all. Round 1 raised the preset to fix
`RUNTIME_UNAVAILABLE` at the audit; the fix moved the failure earlier and made it total.
**Proposed change** bind the runtime where it is consumed: leave step 1 as `{"role": "fe"}` and add a
second `workspace.bind` step immediately before the audit,
`{"operator": "workspace.bind", "requirements": {"role": "fe", "runtimeNeed": "consume"}}`, which
`validate-workflows.mjs` already accepts because `workspace.bind → frontend.surface.audit` would need
adding to `workspace.bind`'s Next table (one row: "the route is bound and a served surface must be
observed"). Round 1's open question "who owns `runtimeNeed`" then has an answer: the step that reads
an endpoint.

### 5. A stand-in profile cannot be recorded anywhere

**File** `templates/step/response.schema.json`.
**Evidence** `resources/orchestrator.json#profileEquivalents.rule` says "response.json records both
(boundProfile, ranProfile) so an audit can tell a stand-in from the binding". The response schema has
`additionalProperties: false` and neither property, and `grep -rn "boundProfile\|ranProfile"
templates scripts` returns nothing. Every branch of this round ran on a stand-in and none of them could
say so in the file the rule names; this record is the only place it is written down.
**Proposed change** add to `response.schema.json#properties`:

```json
"boundProfile": { "type": "string", "pattern": "^[a-z][a-z-]*$" },
"ranProfile": { "type": "string", "pattern": "^[a-z][a-z-]*$" }
```

and one sentence in `resources/orchestrator.json#agent` saying the orchestrator fills them at dispatch.

### 6. A session has no shape for a branch that is `done` and invalid

**File** `resources/orchestrator.json#session.manifest`.
**Evidence** step 4 here: the response is `status: done`, both validators reject it, and nothing routes.
`state.json`'s declared fields are `id, project, startedAt, status, chain, steps, current, leases,
requestHashes`; `blocked` is described only for a stop code. This run invented `stoppedAt` again, now
with `stop: null` and a `why`, exactly as round 1 invented it with a code.
**Proposed change** add `stoppedAt` to the manifest field list with the shape
`{ step, parallel, operator, stop: code | null, domain: string | null, route, why }`, and one sentence
in `session.lifecycle`: a response that fails a validator ends the session the same way a stop does,
with `stop: null` and the validator output in `why`.

### 7. Nothing compares the hydrated route's recorded head with the observed head

**File** `readiness/initialization/workspaces/local-route.schema.json` (the `repository.head` field) and
`operators/workspace-bind/operator.md`.
**Evidence** `.workspaces/local/routes/starci-academy/fe/config.json` records
`head: 14e0c20f4746ae08f00a84a4eac18aa78ded987b` while the checkout it points at is at `8d8ed9a1`, two
commits ahead. The binding reports the observed head and no rule makes the difference anything.
**Proposed change** state in the schema's `description` for `repository.head` that it records the head
at hydration and is never route authority, and add one sentence to `workspace.bind`'s "Nothing is
repaired here": the observed head wins, and a stale hydration head is not a stop. If the owner wants it
visible, the alternative is a `HYDRATION_HEAD_STALE` value in the receipt's Findings enum
(`workspace-route-binding.contract.json`), which is a bigger change for a smaller benefit.

### 8. Knowledge candidate: no topic owns border radius

**File** `knowledge/ui/presentation/` (a new `radius.md`, plus the catalog row in `INDEX.md`).
**Evidence, more than two occurrences** `src/components/blocks/commerce/ProSubscriptionBlock/classNames.ts:96`
(`rounded-medium` on the status band, removed by this run as "off the closed scale") and
`src/components/blocks/learn/CourseFlashcardSessionBlock/classNames.ts:22` (`rounded-medium` on the
read-only notice); `grep -rno "rounded-[a-z]*" src --include=*.ts --include=*.tsx` outside specs
returns 134 matches across the application. Round 1 reported this as knowledge gap 4 and it is
unchanged.
**Proposed change** this is a decision for the knowledge owner and this run does not make it. Either
publish `knowledge/ui/presentation/radius.md` with the closed radius scale the theme exposes
(`rounded-small`, `rounded-medium`, `rounded-large`, `rounded-full`) as `RADIUS-1` upward, one case per
kind of boundary, and add its row to the `## Catalog` table of `INDEX.md`; or state once, in
`INDEX.md`'s authority section, that radius is never an application property and every app-owned
radius class is removed — in which case the removal reason enum of defect 1 needs a value for it too,
because "off the closed scale" is being used 134 times for a property that has no scale published at
all.

### Carried over from round 1, unchanged and still open

- `## Owner map` has no row shape for a node whose owner is determined and whose rule is not selected;
  this round it bit the accent marker, which has an owner (`app`), no chosen rule, and lives only in
  prose and in `## Removed`.
- `## Rules chosen` cannot hold a multi-token class, so `PADDING-9`'s published render `py-6 sm:py-8`
  occupies two rows per node, and a rule whose render is "No class" still cannot be chosen at all.
- `validate-request.mjs` does not read the producing branch's `response.json`, so an invalid or blocked
  predecessor can be fed forward; only routing discipline stopped it here, twice.
- The session id convention in `orchestrator.json` and the caller's folder name still disagree, and
  nothing validates the id.
- `.claude` moved under this round, again. It was dirty when the head was frozen (`package.json`
  modified), and by the time the record was written another session had published `f6ca8fb3`
  ("release 1.1.0") and `74108a4b` on top of `3d30a88e`. `git diff --stat 3d30a88e..74108a4b` touches
  only packaging, docs, INDEX and other runs' records, so no operator, knowledge topic, template or
  script this round bound actually changed, and the branches above stand. Nothing in the runtime
  noticed either the dirt or the two commits: `SOURCE_DRIFT` compares the frontend head, and no
  branch pins a `.claude` head it can check.
- The `central-runtime` registry is still `ready` two days after its last attestation, still declares
  identity on 8080 against a project convention of 8089, and its newest frontend attestation still
  names `/vi/subcribtions`. That is `platform.operate` territory and no operator owns noticing it.

## Verdict

Green on the question the round was asked. `PADDING-9` answers the route block inset, the forbidden
class is removed instead of stopping, and the resolve walk completed with no `RULE_MISSING`, no
`KNOWLEDGE_UNBOUND` and no `UNKNOWN_RULE` — the two knowledge fixes from round 1 hold on the surface
they were written for. Three more round-1 fixes were exercised and hold: the `validate-response` CLI,
`route.schema.json`'s write roots, and `response.json.reason`, which was the only thing a blocked bind
could write.

Not green on the chain. It reached four branches and stopped at the fourth, and it stopped on the tree
rather than on the product: the first receipt that ever reached steps 8 and 9 cannot be expressed in
its own contract. `frontend.source.apply` with `mode: dry` is untested for a second round, and this
time not because the mode was missing but because nothing valid could be handed to it. The two fixes
that would unblock a third round are small and named above: a fourth reason value in
`frontend-presentation-resolution.contract.json`, and one skip in the emission check for a property the
application owns on a Grammar component's `className`.

The stop at step 1 is a correct stop and a design result worth keeping: `runtimeNeed: consume` on the
first bind of five workflows means that a machine with no dev server running can no longer decide a
direction or resolve a tree, which is more than the audit ever needed.

# Run — frontend-refine on the Pro subscription surface (2026-09-03)

First real session of StarCi Skills v8, run as a dry run: one orchestrator plus one agent per
operator, all inside one process. Session root
`.worktrees/sessions/20260903-dryrun-frontend-refine/`, kept on disk for inspection. Every branch
names the profile its `operator.json` binds, and every branch in this test was actually run by Claude
Opus standing in for that profile, which is the first thing to hold in mind when reading a verdict
here: no profile boundary was exercised. Nothing was
committed, nothing was written into the frontend checkout, and no git write command was run anywhere.

## Request summary

| Field | Value |
| --- | --- |
| Workflow | `frontend-refine` |
| Target | `/[lang]/subscriptions` — `src/app/[lang]/subscriptions/page.tsx`, the one route that renders `ProSubscriptionBlock` through `ProSubscriptionPage` |
| Frozen frontend head | `14e0c20f4746ae08f00a84a4eac18aa78ded987b` (`git -C D:\Repositories\starci-academy-fe rev-parse HEAD`, read-only) |
| Knowledge head | `efe38af2c0467b88444f9a7426e6bece1fac3eb2` on branch `v8` of `.claude` |
| Chain requested | 1 `workspace.bind` (role fe) → 2 `frontend.direction.decide` (audit-repair, refine) → 3 `frontend.presentation.resolve` → 4 `frontend.source.apply` (dry) → 5 `frontend.surface.audit` |
| Chain actually run | steps 1 to 3. Step 3 blocked, and `routing.json` sends the `knowledge` domain to `user`, so steps 4 and 5 were never dispatched |

Requirements came from the workflow presets plus each operator's stated defaults; nothing was asked
of a person. Two required fields with no default had to be derived and are called out where they
occur: `project` (`starci-academy`, the only project whose portable declaration names this checkout)
and `target` (the route above, found by grepping for the block).

---

## Step 1 — `workspace.bind`, parallel-1

**Status** `done`. No stop.
**Profile** `operator.json` binds `sonnet`; in this test the branch was run by Claude Opus, as every branch was.

**Validators**

```text
$ node scripts/validate-request.mjs <session>/step-1/parallel-1
request valid

$ node operators/workspace-bind/validate.mjs <session>/step-1/parallel-1
valid workspace.bind branch
```

`node scripts/validate-response.mjs <session>/step-1/parallel-1` could not be used; see the
operator/contract defect on its CLI below. The response half was checked through
`operators/workspace-bind/validate.mjs`, which calls the same `validateResponse` with the correct
exchange argument.

**Artifacts written** `response/response.md` (kind `workspace-route-binding`),
`response/data/route.json` (kind `route`), `response/response.json`.

**What the branch found.** The portable declaration `.workspaces/projects/starci-academy/fe.json`
and the hydrated route `.workspaces/local/routes/starci-academy/fe/config.json` agree on project,
role, repository and branch. The checkout is a `sibling` kind in `starci-academy-fe`, resolving to
`D:\Repositories\starci-academy-fe`, on `main` at `14e0c20f…`, with a clean working tree and the head
the hydration records. Business authority root is `null`, correctly, because a sibling checkout
carries none. `runtimeNeed` defaulted to `none`, so step 5 of the operator never ran and the binding
carries no endpoints. Mutation readiness was reported `read-only`: the routed policy sets
`worktreeBranches: forbidden`, so no `session/<sessionId>` branch can be cut from this route at all.
Findings recorded: `ROUTE_HYDRATED_FROM_PORTABLE`, `WORKTREE_BRANCH_FORBIDDEN`,
`IDENTITY_ROSTER_SEALED`.

---

## Step 2 — `frontend.direction.decide`, parallel-1

**Status** `done`. No stop. No fallback taken.
**Profile** `operator.json` binds `sol-fresh` with `webSearch: bounded`, `browser` and now `imageGeneration`; in this test the branch was run by Claude Opus, with no web search performed because a `refine` works from the family idioms alone.

**Validators**

```text
$ node scripts/validate-request.mjs <session>/step-2/parallel-1
request valid

$ node operators/frontend-direction-decide/validate.mjs <session>/step-2/parallel-1
valid frontend.direction.decide branch
```

**Artifacts written** `response/response.md` (kind `frontend-direction-decision`),
`response/data/coverage.json` (kind `ui-coverage`), `response/response.json`. No candidate page and
no image: one candidate under `preview: no` renders nothing, and no region of this surface reads
empty.

**The UI contract and its coverage.** Five regions (`orientation`, `explanation`, `disclosures`,
`decision-rail`, `recovery`), four actions, seven state meanings with seven distinct carriers, and
two responsive branches. Direction id `pro-subscription-refine`, classification `locked-refine`,
selected candidate `resting-status-truth`, twelve falsification attacks, all `holds`.

**What the branch actually found in the source.** Every claim below has a file behind it and is
recorded in `## Observed` at the frozen head:

- One accent band carries three different lifecycle facts. `proStatusClassName` is
  `rounded-medium bg-accent-soft p-3`, and `verification-pending`, `active` and `cancelled` all
  render into it (`component.tsx:147-176`, `classNames.ts:95-96`). That is one carrier against three
  named facts (`STATE-1` Case 3) and accent standing in for an outcome (`ACCENT-5` Case 1); the
  family's own idiom says an unclaimed promise stays neutral.
- The announcement is hand-built. An app `div role="status" aria-live="polite"` wraps two `Text`
  nodes (`component.tsx:170-175`) where `Text` publishes `live: off | polite | assertive`.
  `FEEDBACK-3` Case 2 puts the announcement on the smallest owner, and Case 4 wants exactly one.
- `renewalNote` renders twice in the cancelled state, once as the status description and once as the
  standing line below it (`component.tsx:151-177`).
- The pending tree only half rests. `isSkeleton` reaches the plan `Heading` and nothing else; the
  price, the period, the benefit copy and the breadcrumb keep resolved geometry, and an em dash is
  written into the dominant price slot while the measurement is unknown (`component.tsx:162-177`).
  `STATE-2` Case 3 says no node states a value for an unknown measurement. The `Breadcrumbs` leaf
  publishes `isLoading` and the block never binds it.
- The failed state is a hand-built notice: `SurfaceCard composition="joined"` around an app
  `div role="alert"` with a `Heading`, a `Text` and a `Button` (`component.tsx:126-145`), where
  `EmptyNotice` is the published owner (`FEEDBACK-2` Case 1) and the family idiom says empty and
  failed are a different tree.
- The rail reflow has two owners. `proWorkspaceClassName` (`classNames.ts:12-21`) turns the Grammar
  grid into a flex column at a `max-[895px]` viewport breakpoint and swaps the rail with
  `order-first` / `min-[896px]:order-last`, while `@container starci-core-primary-rail (max-width:
  56rem)` in `packages/grammar/src/common/styles.css:986-990` already owns that stack. That breaks
  `RESPONSIVE-2` Cases 1 and 5, `RESPONSIVE-3` Case 3, `LAYOUT-2` Case 4, and the `order` swap
  reverses meaning order at narrow widths against `LAYOUT-4` Case 5, `HIERARCHY-3` Case 2 and
  `CTA-5` Case 2.

The candidate makes six element-level moves inside the approved structure: neutral status band with a
`Badge` per outcome; one `Text live="polite"` announcement owner; `renewalNote` stated once; the
pending tree resting completely with no em-dash value; `EmptyNotice` for the failed region; and the
reflow returned to its single published owner. The last of these is the one move that trades a real
narrow-viewport convenience — the decision card sitting above the explanation — for single-owner
conformance, because `PrimaryRailLayout` publishes no rail-position or order prop that could express
the preference.

---

## Step 3 — `frontend.presentation.resolve`, parallel-1

**Status** `blocked`. **Stop** `RULE_MISSING`.
**Profile** `operator.json` binds `sonnet`; in this test the branch was run by Claude Opus.

 Domain `knowledge`; `routing.json` answers the
`knowledge` domain with `{"kind": "user"}`, so the chain stops and a person owns the next move.

**Validators**

```text
$ node scripts/validate-request.mjs <session>/step-3/parallel-1
request valid

$ node operators/frontend-presentation-resolve/validate.mjs <session>/step-3/parallel-1
valid frontend.presentation.resolve branch
```

A blocked response is green when its stop is valid, which is the case here: `RULE_MISSING` is in the
operator's Stops table and its effective disposition under these requirements is `terminate`.

**Artifacts written** `response/response.md` (kind `frontend-presentation-resolution`) and
`response/response.json`. No `inventory.json` and no resolved tree: those are steps 8 and 9 of the
operator, which never ran.

**The owner map.** 45 rows. Grammar owns the region gap of `PrimaryRailLayout` (`GAP-5`), the joined
card's content gap and inset (`GAP-0`, `PADDING-0`), the accordion trigger inset (`PADDING-4`), the
`SurfaceCopyGroup` gap (`GAP-2`), the price rank once it moves to `Text size="metric-lead"`
(`FONT-5`), and the `EmptyNotice` inset and gap. The application owns the rest: the hero stack, the
workspace offset, the primary column rhythm, and every band of the explanation card and the decision
rail.

**Rules chosen.** 36 rows. The band grammar of this surface maps onto the published cases almost
exactly, because those cases were written from it: `PADDING-4` Case 7 for every band's inline sides,
`PADDING-4` Case 6 for a band meeting the outer edge, `PADDING-3` Case 3 for a band between
separators, `PADDING-3` Case 4 for the separator-facing side of the closing band, `PADDING-7` Cases 1
to 3 for the `sm` step, `BOUNDARY-1` Case 2 for a band carrying its own leading seam, Case 3 for the
closing action band, `BOUNDARY-2` Case 3 for the two-column benefit grid, `SURFACE-3` Cases 1 and 2
for the intro and journey bands, `GAP-1` Case 1 for the outcome copy pair, `GAP-1` Case 2 for the
price and its unit on the block axis, and `GAP-5` Case 1 for the two page regions.

**Removed.** Thirteen classes. Six of them are the `proWorkspaceClassName` overrides that reach into
`.starci-core-primary-rail-layout`, `[data-grammar-primary-region]` and `[data-grammar-rail-region]`
(`overrides Grammar anatomy`). `gap-5` on the plan details is `off the closed scale` — 1.25 rem is
not on `COMMON_SPACING_SCALE` at all — and resolves to `GAP-4` Case 1. The price value's
`text-4xl font-semibold tracking-tight text-foreground` on an app `span` is
`reimplements an owned relationship`: `font.md` states plainly that there is no `App` owner in that
file and an application typography class is `APP_OVERRIDE`. `text-left` on the disclosure summary
restates the default that `FLOW-1` Case 1 says needs no class. `rounded-medium` on the status band is
`off the closed scale` because no presentation topic publishes radius at all.

**Gaps.** Four, all kept as recorded workarounds rather than stops, per the operator's own rule that a
missing public path is a gap and not a stop:

| Node | Property | Missing path |
| --- | --- | --- |
| the workspace wrapper | region rhythm | `PageContainer` publishes no gap or region-rhythm prop, so page rhythm can only be written as a child margin |
| `PrimaryRailLayout` | rail order in the stacked branch | it publishes only `railWidth` and `align`; the removed override had no published replacement |
| the action band's `Button` | inline size and label wrapping | `Button` publishes no full-width or wrapping prop |
| `IncludedMark` | tone, size, optical offset | it publishes no tone, size or alignment prop, and the `mt-0.5` nudge is itself off the closed scale |

**Every `RULE_MISSING` hit.** Two, and they are what stopped the branch:

1. **`block>main` — the route's block inset.** `py-6 sm:py-8` is a block-only route inset stepping
   1.5 rem to 2 rem. `PADDING-5` and `PADDING-6` publish only equal four-side insets on an app
   section; `PADDING-7` is composed explicitly from an inline inset of 1 rem → 1.5 rem plus
   outer-edge block sides at the same values, and states the sides it is composed from.
   `PageContainer` owns the inline page inset (`--grammar-page-inset`) and no block one. No published
   case's `When` describes this condition.
2. **The `IncludedMark` in each benefit row — foreground.** `SURFACE-4` Case 2 publishes exactly this
   shape, "a leading marker inside a raised region, taking the paired foreground alone", but this
   marker sits on the unraised card face, so the case's condition is not met. No other case publishes
   a marker foreground on an ordinary band. Selecting `SURFACE-4` anyway would be citing a rule whose
   `When` does not match, which is the fabrication the operator exists to refuse.

---

## Steps 4 and 5 — not run

**Profiles they would have bound** `frontend.source.apply` binds `opus` and `frontend.surface.audit`
binds `sol-reviewer`. Neither ran, so neither profile was exercised; had they run, Claude Opus would
have stood in for both, as it did for every branch above.

`frontend.source.apply` declares `frontend-presentation-resolution` as a **required** input and
`frontend.surface.audit` declares all three of `frontend-source-application`,
`frontend-presentation-resolution` and `frontend-direction-decision` as required. Step 3 produced no
`done` resolution, so neither request could be composed honestly and neither branch was dispatched.
There is no write plan and no `WRITE_REJECTED` to report, and no audit matrix.

The orchestrator nevertheless ran the reachability check the caller asked for, because it decides
whether step 5 could ever have succeeded:

```text
$ curl -s -o /dev/null -w "%{http_code}" -m 5 http://localhost:3000/en/subscriptions
000
$ curl -s -o /dev/null -w "%{http_code}" -m 5 http://localhost:3001/
000
```

`.worktrees/sessions/central-runtime/owner.json` declares generation 6, `status: ready`, frontend
`http://localhost:3000`, last attested `2026-09-01T19:54:08Z` against head
`5fe51662dbf214c7c24ca014e8e5d0197d0441eb`. Nothing is listening now. Had step 5 been reached it
would have blocked with `RUNTIME_UNAVAILABLE` (domain `platform`), and step 1 would have blocked with
`RUNTIME_NOT_READY` had it been asked to consume the runtime. Three further facts about that registry
are worth recording: its attested head is not the head this session froze; its `identity` endpoint is
`http://localhost:8080` while the project's Keycloak convention is `8089`; and its most recent
frontend attestation names the route `/vi/subcribtions`, a misspelling, and still records `GET => 200`.

---

## Defects this run exposed

### Knowledge gaps

1. **No case for a route-level block inset.** `knowledge/ui/presentation/padding.md` publishes equal
   four-side insets (`PADDING-4` to `PADDING-6`) and one composite for a surface's inline sides
   (`PADDING-7`), and nothing for the vertical inset a routed page gives itself. This is the first of
   the two stops. Every routed page in the app that writes `py-*` on its `main` hits it.
2. **No case for a leading marker's foreground on an unraised band.** `SURFACE-4` Case 2 covers the
   marker only inside a raised region. This is the second stop.
3. **`BOUNDARY-3` and `BOUNDARY-4` are cited but not published.** `knowledge/ui/presentation/INDEX.md`
   advertises "BOUNDARY-1 to BOUNDARY-6"; `boundary.md` publishes only `BOUNDARY-1`, `-2`, `-5`, `-6`.
   `BOUNDARY-1` and `BOUNDARY-2` both close with "Use BOUNDARY-3", which resolves to nothing, and the
   live package emits `data-contract="BOUNDARY-3"` on accordion rows and `BOUNDARY-4` on
   `WorkspaceShell`. `frontend.presentation.resolve`'s validator derives its inventory from `## PREFIX-n`
   headings, so any node that legitimately claimed `BOUNDARY-3` would be `UNKNOWN_RULE`.
4. **No topic owns border radius.** `rounded-medium` is a real presentation property on an app-owned
   node with no bound topic, which is literally the definition of `KNOWLEDGE_UNBOUND`. The catalog's
   ten topics do not include one.
5. **`COVERAGE-1` Case 3 names a field the schema does not have.** It asserts that
   `coverage.regions[]` "covers every entry in `regionModel`"; `templates/kinds/ui-coverage.schema.json`
   has no `regionModel` anywhere.
6. **`COVERAGE-1` Case 3 demands an idiom that the playbook does not carry for every region.** It
   requires each region to name "one idiom in `knowledge/grammars/starci/playbook.md`". The
   purchase-decision row of the playbook names no idiom for the route's orientation region, and
   `idioms.md` records that shape only under "Seen once, not yet an idiom", which a direction "may not
   compose from". A refine that keeps an approved structure therefore cannot satisfy the rule without
   citing a shape the same knowledge forbids composing from.
7. **`ACCENT-1` Case 5 has no case for a closed decision.** It requires the count of dominant accents
   to be "identical in every state and at every width". On this surface the `active` and
   `verification-pending` states legitimately have no next action and therefore no primary button. The
   rule as written is failed by correct behaviour.
8. **The family gap table does not list the reflow gap.** `knowledge/grammars/starci/family.md`
   publishes seventeen gaps and none of them is `PrimaryRailLayout` having no rail-position or order
   prop, even though the one block the idioms file cites most has been working around it since it was
   written.

### Operator and contract defects

1. **`scripts/validate-response.mjs` cannot validate a branch from its own CLI.** Its exchange
   detection is `path.basename(path.dirname(path.dirname(dir)))` tested against `^step-\d+$`. For a
   branch directory `…/step-N/parallel-M` that expression yields the session folder name, so the
   script concludes the branch is a nested exchange named `parallel-M`. Every branch in this run
   produced the same four spurious errors:

   ```text
   step-N/parallel-1/response/response.json: exchange none does not match the folder parallel-1
   step-N/parallel-1/response/response.json: fields.<kind> is not an Output of <operator> in exchange parallel-1
   step-N/parallel-1/response/response.json: a nested exchange does not route; next must be empty
   ```

   One `dirname` too many; the correct test is on `path.dirname(dir)`. `validate-step.mjs` and every
   operator validator pass `exchange: null` explicitly and are unaffected, which is why the operator
   validators are green. Nothing in `.claude` was edited to work around this.
2. **`route.schema.json` requires at least one write root that no requirement supplies.**
   `writeRoots` has `minItems: 1` and the `workspace-route-binding` contract requires at least one
   row under `## Write roots`, while `declaredWriteRoots` defaults to empty and neither route
   declaration carries write roots. The binding had to derive `src` and say so in the receipt.
3. **The `frontend-refine` workflow never binds the runtime its own last step needs.** The step-1
   preset is `{"role": "fe"}`, so `runtimeNeed` takes its default `none` and the binding carries no
   endpoints, yet step 5 is `frontend.surface.audit`, which cannot run without a served route. No
   file states who is supposed to raise `runtimeNeed` to `consume`.
4. **The routed Git policy and `sourceWrites` contradict each other.** `resources/orchestrator.json`
   says a source-writing operator "writes only on the session branch `session/<sessionId>` … in a git
   worktree the orchestrator prepared". The `starci-academy/fe` route declares
   `worktreeBranches: forbidden` with `mutationBranch: main`, and `workspace.bind`'s validator refuses
   to bind a forbidden-worktree route on any branch but the mutation branch. Under this route, a
   conforming `frontend.source.apply` has nowhere legal to write.
5. **`## Owner map` cannot express a determined owner with an unselected rule.** Its `Rule` cell is
   mandatory and patterned. A branch that blocks with `RULE_MISSING` has, by construction, at least
   one node whose owner it determined and whose rule it could not select, and no row shape for it. The
   two blocked nodes had to be described in prose.
6. **`## Removed` has a three-value closed reason enum that does not cover real removals.** The
   permitted reasons are `reimplements an owned relationship`, `overrides Grammar anatomy`, `off the
   closed scale`. A class removed because the composition decision changed — the status band losing
   `bg-accent-soft` because accent must not carry an outcome — is none of the three.
7. **`## Rules chosen` cannot hold a multi-token class.** The validator checks
   `inventory.classNames.includes(className)` on the whole cell, and `inventory.schema.json` forbids
   spaces in a class name. A rule whose published `Render` is `px-4 py-3` therefore needs two rows
   under two different property names, and a rule whose `Render` is "No class" (`FLOW-1` Case 1,
   `MARGIN-0` Case 3) cannot be chosen at all.
8. **"No published case matches" is ambiguous, and the two readings differ by a whole chain.**
   `operator.md` says the run stops when "no published case matches the observed condition", while
   `knowledge/ui/presentation/INDEX.md` says cases are added "only for materially different
   situations governed by the same value", i.e. they enumerate kinds, not instances. Under the strict
   reading this run would have stopped at the first node; under the looser one, at two nodes. This
   run took the looser reading and says so; nothing in the tree settles it.
9. **`DIRECTION_CHOICE_REQUIRED` cannot express an open sub-question.** `playbook.md` raises it for
   "any point where the reference and an idiom disagree" and for shapes in the seen-once table, but
   its fallback text is a multi-candidate tiebreak ("select the candidate that survived the most
   attacks") and the validator counts candidates. With `candidates: 1` there is no way to record that
   one composition question inside the chosen direction is still the owner's.
10. **`.claude` changed under a running branch.** Between reading `frontend.direction.decide` and
    writing its response, another session added an `## Images` section to
    `frontend-direction-decision.contract.json`, an `imageGeneration: judged` policy to
    `operator.json`, a `direction-image` output, and an owner ruling to `playbook.md` — all uncommitted,
    so the `.claude` head this run froze (`efe38af2`) does not describe the files the branch actually
    read. The response was rewritten against the new contract; nothing in the runtime detected the
    change.

### Orchestrator gaps

1. **Nothing prevents a blocked branch's output from being fed forward.**
   `scripts/validate-request.mjs` checks that an input path exists inside the session. It does not
   read the producing branch's `response.json`. Pointing step 4 at
   `step-3/parallel-1/response/response.md` would have validated cleanly even though that branch is
   blocked. Only routing discipline stopped it here.
2. **No file says how a session is marked stopped.** `resources/orchestrator.json` gives `state.json`
   the fields `id, project, startedAt, status, chain, steps, current, leases, requestHashes` and says
   a blocked session "keeps both" worktree and folder, but there is no place to record which branch
   stopped, with which code, and where the routing table sent it. This run added a `stoppedAt` object
   of its own invention.
3. **Fingerprint derivation is unspecified.** `route.json` requires `routeFingerprint` and
   `identityFingerprint` as `sha256:<64 hex>`, and `alias.json` says routes bind "by fingerprint",
   but no file says what is hashed. This run used the SHA-256 of the hydrated route file and of
   `device-state.json` respectively, and recorded that choice.
4. **The session id convention and the caller's session name disagree.** `orchestrator.json` fixes
   `<yyyymmdd-HHMMss>-<project>-<first operator>`; the caller named the folder
   `20260903-dryrun-frontend-refine`. Nothing validates the id, so both are accepted silently.
5. **A `contexts` head has no meaning for a non-git alias.** `request.schema.json` requires
   `alias` and `head`, `head` being a 40-hex sha or null. `@knowledge/*` resolves inside `.claude`,
   which is a git repository, but `@grammar/core` resolves to a package directory inside the frontend
   checkout and takes that checkout's head; `@workspaces/device-state` would have no meaningful head
   at all. No file says which aliases belong in `contexts`.
6. **Nothing says who probes the runtime before a chain that needs it.** The reachability check above
   was run by the orchestrator on the caller's instruction. `workspace.bind` will not probe unless
   `runtimeNeed` is `consume`, `frontend.surface.audit` "never starts one", and no operator owns
   noticing that a registry claiming `ready` has been dead for two days.

## What a person owns next

`RULE_MISSING` routes to `user`. The knowledge owner publishes a padding case for a route-level block
inset and a surface case for a leading marker's foreground on an unraised band, and the same tree is
resolved again as a new step with `request.json.resume` naming `3/1`. Until then the direction from
step 2 stands as the record of what this surface needs, and no source has been written.

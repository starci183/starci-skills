# quality.verify

## Job

Verify one bounded delivery by running its declared gates against an unchanged predecessor receipt
at one frozen head, and return the exact measured verdict, repairing nothing.

## Done when

Done when the `quality-verification` states one measured verdict, pass or fail, over a delivery
whose predecessor receipts all name the frozen head, with one `gate-result` per declared gate
carrying its command, exit code, evidence and classification, `coverage` preserving every configured
and requested threshold beside its measured value whenever a unit gate ran, every red gate
classified to its owner or covered by a live approved debt, every topic row of the scorecard copied
unchanged from the receipt that computed it, and the admitted `audit-scope` copied unchanged when
the audit carried one.

## One delivery, one head, at least one producer receipt

The three Inputs are the three shapes a delivery arrives in: a backend implementation, a frontend
source application, and the `changes` record that names which paths moved and which gates and
surfaces they touch. Each is optional on its own and at least one must be present, because a
verification with no producer receipt has no head to freeze and no delivery to measure. Every
predecessor receipt must report the same source head, and that head must be the head
`request/request.json` froze; two predecessors on different heads describe two different deliveries,
and gating the union of them measures something nobody built. That is `PREDECESSOR_MIXED`, refused
before a single command runs rather than discovered later as a confusing gate failure. A predecessor
whose fingerprint no longer matches the frozen source is `PREDECESSOR_STALE`. So is a predecessor
produced under `mode: dry`: it carries no commit and describes a plan rather than a delivery, its
change record says `nothing written` and its receipt's `Commit` reads `—`, and it is refused at step 2
before any command runs, because a plan has no head to stand on and gating the base head would
publish a green verdict about code nobody wrote. What a predecessor
decided is consumed unchanged: this operator never re-plans the delivery, re-opens its boundary, or
forms an opinion about whether the change was a good one.

## The head is confirmed inside the gate

There is no separate head-verification step, because a head confirmed anywhere but at the gate is a
head that could drift before the first command. The producer wrote its delivery on the session
branch `session/<sessionId>` of the routed checkout, in a git worktree prepared from the frozen head,
and committed it once. `request/request.json` therefore pins `@workspaces/be` or `@workspaces/fe` at
that exact commit sha in `contexts[].head`, and step 1 confirms the observed head equals it before
anything else happens; a difference is `SOURCE_DRIFT`. The predecessor receipt's own commit must
equal that same head, because a receipt describing a commit the gates are not standing on is
`PREDECESSOR_STALE`. Every gate runs inside that session branch worktree and never on the person's
checked-out branch, so a gate result names one commit somebody can check out again.

## A red gate is a verdict, not a stop

Quality measures. It does not repair, redesign, reclassify, or negotiate. A failing gate produces a
red verdict naming the failure and its classification, and that verdict goes back to the owner who
can fix it; the branch is `done`, not `blocked`, because the operator did exactly what it was asked
to do. Only an inability to reach any verdict at all is a stop. The operator does not touch product
source, does not adjust a gate command or its configuration to change an outcome, and does not
substitute an easier check for a hard one.

## A gate result is measured, never narrated

Every executed gate carries its command reference, its exit code, and its evidence, in its own file
under `response/data/gates/`. One file per gate is what makes a gate result quotable on its own: a
later reader opens `lint.json` and sees one command, one exit code, one classification, without
reading around a bundle. A pass means exit code zero with evidence beside it; a failure means a
non-zero exit code with evidence and a classification. The classification is read from the structured
diagnostics after the command ran, never chosen before it: `in-boundary` when the delivery owner can
fix it, `boundary-drift` when fixing it would change an approved boundary, `flaky` when identical
source and environment produced contradictory outcomes, and `external-blocker` when the environment
or a dependency prevented a verdict at all. A rerun exists to tell those four apart. It never exists
to convert an unexplained failure into a pass. No gate is skipped, suppressed, substituted, or moved
with `passWithNoTests`, and a zero-test run is not a pass. Every gate file records the same source
head, because two gates standing on two heads measured two deliveries.

## Two facts about this codebase

Sonar measures new code only. The pinned gate is scoped to the change, so a green Sonar result is a
statement about the diff and not about the project, and a project may sit red beneath it. Under the
default `sonarScope` of `new-code`, a passing Sonar result is recorded together with a
`SONAR_NEW_CODE_ONLY` finding; without it a later reader takes a green gate for project health, which
is the exact misreading this operator exists to prevent.

End-to-end is never run unless a person asked for it in this invocation, which is why
`explicitE2eRequest` defaults to false. Otherwise the gate is recorded as `skipped-not-requested`
with an `E2E_NOT_REQUESTED` finding: no command, no exit code, no evidence, and no implication that
behaviour was proved. Planning the e2e gate without that request is invalid input.

## A frontend delivery is swept as well as compiled

Format, lint, typecheck and build measure whether the source is well formed. None of them measures
which node a class landed on, so a page that layers `flex-col items-start sm:flex-row` onto a Grammar
object whose CSS already owns the collapse compiles clean, lints clean, and ships. The
`presentation-sweep` gate closes that hole: `node scripts/sweep-presentation.mjs` runs over the
delivered write set and returns `APP_OVERRIDE`, `APP_REIMPLEMENTATION`, `OFF_SCALE` and
`SHELL_GEOMETRY` findings with their file, line and offending token. It is planned whenever the
delivery carries a `frontend-source-application`, and a request that names a frontend delivery without
it is invalid input. `frontend.source.apply` runs the same sweep on the projection before it writes;
this gate runs it on what was actually delivered, because the two are only the same tree when nothing
went wrong between them. A finding here is a red gate and therefore a verdict, not a stop: it goes
back to the frontend owner exactly like a failing test.

## Coverage preserves every configured and requested threshold

Statements, lines, functions and branches retain their measured percentages and separate thresholds.
Each threshold is the strongest configured or requested percentage for that metric. An explicit zero
is a numeric threshold; `null` means neither source declares one and is recorded as `unconfigured`
with `—` in the receipt. An absent threshold supplies no percentage and cannot erase a measured unit
failure. A metric under a numeric threshold makes the unit gate a failure and records
`COVERAGE_BELOW_THRESHOLD`; it is never a note beside a green result.

`coveragePolicy` pins the raw effective-configuration report and its digest to the unit gate's
command, configuration and source head. It is required when any threshold is null or the request
does not explicitly pin numeric bars for all four metrics, and a supplied report is always checked.
The report must use a supported format and preserve all applicable thresholds; an unreadable,
ambiguous or unsupported configuration is not evidence of absence. The report is captured using
the measured gate's configuration-affecting arguments and environment, with only the reporting
option added. Validation reads that artifact without executing configuration. A receipt using this
policy reports all four measured values, thresholds and verdicts exactly as its coverage data does.

## Debt is explicit and owned

A gate stays red only when an owner-approved debt record covers it, naming the debt, the gate, the
approval, the owner and the expiry, and only when that approval is still live at the instant the
gate was measured. An expired approval is not a debt and a debt against a gate that passed is a
record of nothing; both are refused as `DEBT_UNAPPROVED`. A debt covers only an `in-boundary`
failure, the kind the delivery owner can fix; a `boundary-drift` failure belongs to whoever owns the
boundary and cannot be owed away here. `declaredDebts` defaults to the empty list, so carrying a red
gate is always something a person did on purpose.

## The scorecard is copied, never rescored

The gates say whether the delivery is well formed. They say nothing about whether the surface is good,
reachable, truthful or usable, and those questions were already answered by the operators that
observed the running product: `frontend.surface.audit` closed eight proof topics on its captures, and
`uat.verify` closed the experience topic on its run. This operator reads both receipts and writes one
`## Verdict` table: one row per topic, each verdict and route copied from the receipt that computed
it. It may not rescore a topic, may not average across rows, and may not substitute its own judgement
for a measurement it did not take.

The line under that table is the whole answer. Any row missing, or `blocked`, makes it `blocked`,
because a topic nobody observed has earned neither a pass nor a failure. Any row `fail` or
`fix-first` makes it `fix-first`, and the receipt names that row and the route it carries. Only when
every row ships or passes is it `ship`. Two failing rows are both reported with their own routes;
collapsing them into one composite, or reporting only the first, hides the second owner.

## The verdict

`pass` requires every required gate to have passed, or to have failed `in-boundary` under a declared
debt. Every other shape is `fail`, including a required gate the environment blocked: an unmeasurable
gate is not a passed one. A non-required gate that fails is recorded and does not by itself turn the
verdict red, which is the whole reason `required` exists, and it is the gate plan's declaration and
never this operator's judgement.

## Boundary

Context is read-only. The operator writes only `response/` of its own branch: one `gate-result` file
per gate under `response/data/gates/`, `data/coverage.json`, `response.md` and `response.json`. It
does not modify product source, configuration, or a gate command; it does not redesign, repair, or
reclassify a measured failure into a pass; it does not run the end-to-end suite unasked; it does not
add, weaken, skip, suppress, or substitute a declared gate; it does not read a project-level Sonar
verdict out of a new-code quality gate; and it does not carry a debt no owner approved or whose
approval expired.

Gate results retain their actual measured branch in sessionBranch. A non-session value requires the changes input emitted by a completed platform.operate serve at that integration branch and merged head; the producer delta and actual Git diff are checked. Do not relabel integration evidence with a session branch.

## Context

| Alias | Bind | Required |
| --- | --- | --- |
| `@workspaces/<project>/<role>/gates` | the pinned gate commands, their configuration and the thresholds they carry; what "the same gate" means across runs | yes |
| `@workspaces/be` | the routed backend checkout at the pinned commit, the subject every gate measures when the delivery is a backend | no |
| `@workspaces/fe` | the routed frontend checkout at the pinned commit, the subject every gate measures when the delivery is a frontend | no |
| `@worktrees/debts` | owner-approved debt records and their expiry; a red gate is carried only from here | no |

## Inputs

| Kind | From | Required |
| --- | --- | --- |
| `backend-source-application` | `backend.source.apply`, the backend delivery to verify | no |
| `frontend-source-application` | `frontend.source.apply`, the frontend delivery to verify | no |
| `changes` | `backend.source.apply`, `frontend.source.apply`, `library.source.apply`, `dependency.update` or a completed `platform.operate` serve, the paths that moved and the gates and surfaces they name | no |
| `frontend-surface-audit` | `frontend.surface.audit`, the eight proof topics it closed at the same head | no |
| `uat-flow-verification` | `uat.verify`, the experience topic it closed at the same head | no |

## Requirements

| Field | Type | Default | Ask |
| --- | --- | --- | --- |
| `gates` | list of `{gate, commandRef, configRef, required}` | the routed gate plan | Which pinned gates to run, once each, from format, lint, typecheck, build, unit-coverage, integration, e2e, sonar and presentation-sweep |
| `thresholds` | object or list of `{statements, lines, functions, branches}` | [] | Requested percentage bars for the named metrics; the strongest configured or requested bar applies |
| `coveragePolicy` | object `{format, sourceHead, commandRef, configRef, evidenceRef, evidenceSha256}` | null | Frozen effective-configuration evidence for coverage thresholds |
| `explicitE2eRequest` | choice | false | false unless a person asked for the end-to-end suite in this invocation; true only then |
| `sonarScope` | choice | new-code | new-code or overall; it must agree with whether sonar is in the gate plan |
| `declaredDebts` | list of `{debtId, gate, approvalRef, ownerRef, expiresAt}` | [] | Owner-approved debts that let a named gate stay red |
| `resume` | token | null | The blocked branch's token when re-entering after a stop |

## Steps

| # | Step | Params | Reads | Writes | Stops with |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate the gate, confirm the frozen head and the resume | `resume` | `request/request.json`, @workspaces/be or @workspaces/fe at the commit the request pinned, @tools/git | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Consume the predecessors unchanged | — | inputs `backend-source-application`, `frontend-source-application` and `changes` at their fingerprints, and the commit each one recorded | — | `PREDECESSOR_MIXED`, `PREDECESSOR_STALE` |
| 3 | Run the gates in declared order | `gates`, `explicitE2eRequest`, `sonarScope` | @workspaces/<project>/<role>/gates, @workspaces/be or @workspaces/fe as the subject each gate measures, @tools/http | `response/data/gates/<gate>.json`, @tools/shell | `GATE_UNAVAILABLE` |
| 4 | Apply the coverage policy | `thresholds`, `coveragePolicy` | the frozen effective-configuration artifact, `response/data/gates/<gate>.json` of the unit gate | `response/data/coverage.json` | — |
| 5 | Classify each failure from its diagnostics | — | `response/data/gates/<gate>.json` of every red gate | — | — |
| 6 | Apply approved debt | `declaredDebts` | @worktrees/debts, `response/data/gates/<gate>.json` | — | `DEBT_UNAPPROVED` |
| 7 | Copy each topic verdict from the receipt that computed it | — | inputs `frontend-surface-audit` and `uat-flow-verification` at the same pinned head | — | `PREDECESSOR_MIXED` |
| 8 | Compute the gate verdict and the scorecard, write the receipt and emit | — | everything above | `response/response.md`, `response/response.json`, `audit-scope` | — |

A gate that could not be executed at all in this environment is `GATE_UNAVAILABLE` when it was
required; a non-required gate the environment blocked is recorded as `external-blocker` and the
verdict absorbs it. There is no repair code, because repair is not this operator's job: an
`in-boundary` failure returns as a red verdict to the owner who can fix it, and the fixed delivery
comes back as a new head with a new predecessor fingerprint. A resume reuses only unchanged
fingerprinted observations and consumes the exact delta; a resume that adds no predecessor, gate,
debt or source change is `NO_PROGRESS`, because the same fingerprint cannot yield a different answer.


When the admitted audit carries scope, run `node scripts/audit-scope.mjs <branch>` to copy
`verdicts.auditScope` unchanged into `response/data/audit-scope.json` and list the `audit-scope`
output kind. The receipt includes `## Audit scope`, a `Field | Value` table preserving Mode,
Coverage claim and Deferred states. The verdict has only that scope; deferred states do not become
passed because quality gates or UAT pass. Quality thresholds and frozen UAT cases remain unchanged.

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `quality-verification` | `response/response.md` | md | yes |
| `gate-result` | `response/data/gates/<gate>.json` | data | yes |
| `coverage` | `response/data/coverage.json` | data | no |
| `audit-scope` | `response/data/audit-scope.json` | data | no |

## Stops

| Code | Disposition |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `PREDECESSOR_MIXED` | terminate |
| `PREDECESSOR_STALE` | terminate |
| `GATE_UNAVAILABLE` | terminate |
| `DEBT_UNAPPROVED` | terminate |

## Next

| When | Operator |
| --- | --- |
| a backend gate failed in boundary and the backend owner must fix it | `backend.source.apply` |
| a frontend gate failed in boundary and the frontend owner must apply the fix | `frontend.source.apply` |
| the verdict is green and the delivery is ready to publish | `git.publish` |
| the verdict is green and the published head must reach an environment | `release.deploy` |
| the gates are green and the promise must be reconciled against the delivered source | `business.decide` |
| the gates are green and a person asked for the journey to be walked | `uat.verify` |

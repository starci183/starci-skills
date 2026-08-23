---
name: starci-repair
description: Take a routed source that is red, structurally stale, port-conflicted, untrusted, or missing required frontend or backend delivery assurance and return it green through measured, separated passes. Uses the shared stale registry for every finding and never silences a gate or publishes plaintext credentials. Writes product and external enforcement state only after approval.
---

# starci-repair

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/context.md` | context | shared phase, approval and output contract |
| `@staleness` | `readiness/staleness/context.md` | context | the one taxonomy and router for every repair module |
| `@source-quality` | `scripts/check-source-quality.mjs` | script | deterministic whole-Source proof for the ordered delivery fence |
| `@stale-debts` | `readiness/staleness/debts/context.md` | context | identify existing owner-approved debt and preserve truthful verdicts |

## NESTED SKILLS

None. A stale route is returned to the initialization owner; this skill never starts setup.

## PIPELINE

Topology: `reconciliation` with separated repair passes.

| Step | Track | Input | Transform | Required output | Gate |
|---|---|---|---|---|---|
| inventory | shared | verified route, stale registry and current source | measure every applicable category without suppressing gates | repair findings matrix | each finding has evidence, owner and exact clearing gate |
| plan | reconciliation | findings and category-owned law | group non-overlapping fixes into ordered passes and freeze boundaries | repair execution contract | approval covers every proposed product/external mutation |
| repair | execution | approved pass | apply only that pass, then re-measure before advancing | per-pass receipt | no mixed concern, gate weakening or plaintext credential |
| close | proof | all pass receipts and fresh full inventory | run complete delivery assurance and stale checks | green repair receipt | every in-scope finding clears through its real owner gate |

## Run

Read `@skill-shape`, then `@staleness`. Do not restate a category's law here. The registry owns what
is stale and routes to the module that owns list evidence, inventory, apply and proof.

## Module selection

Read only reached modules during repair:

- always read `@stale-source-gates` and `@stale-lint-machine` after the route verifies;
- always read `@stale-port-offset` after the route verifies; its family pass may coordinate both routed
  roles because Source allocation and paired consumers cannot migrate independently;
- read `@stale-strict-fix` when strict-fix was requested or its first-party surface is present;
- read `@stale-why` when the route has a contract;
- read `@stale-assurance` for a backend or frontend, then obey its tracked applicability declaration;
- read `@stale-debts` when `.worktrees/<project>/debts/<role>.md` exists; repair may report it but never create,
  extend or remove it — a separate debt repayment capability owns that work;
- read `@stale-retired-structure` for a frontend component tree;
- read `@stale-remnant` only for nested `.claude/` inside the resolved target.

A module not reached creates no finding, boundary or work.

## Invariants

Green is earned, never bought. No `eslint-disable`, weakened severity, removed rule, skipped test or `any`
added to end a finding. A decision is returned. Formatting is isolated from behavior. The consumer installs
published lint rules and never authors or repairs a private copy.

The delivery fence applies independently to every routed role: format → lint → typecheck → build → unit
coverage → E2E → Sonar. Lint requires 0 errors/0 warnings; unit requires S/L/F ≥80%, branches ≥75% and
patch/new metrics ≥90%; E2E requires an existing declared entrypoint, real tests and all passing. Skip, todo,
passWithNoTests, zero-test and check substitutes are rejects.

One repair record covers one role of one project, except a port-offset pass records the family and every
reached role together. A multi-project request coordinates separate records,
baselines and diffs under one approval batch. Whole-repository gates run once per checkout by the coordinator.

## PROCESS

### 1 — Resolve the route

Read `.workspaces/local/routes/<project>/<role>/config.json`. Verify checkout, git root, branch/head, manifests and the
frontend contract when declared. Stop before target-source reads if the route is absent, invalid or stale;
`@staleness` assigns that finding to the initialization owner.

### 2 — Read manifest and select modules

Read the repository manifest and existing gate scripts. Select modules using the rules above, then read
each selected runtime context record completely before inventory. For every routed role, source proof is
mandatory in this order: format, lint, typecheck, build, unit coverage, E2E, Sonar. Do not omit E2E or Sonar.

### 3 — Establish the baseline state

Refuse an unexplained dirty target tree. Record the pre-change commit. Follow `@stale-lint-machine` before
believing any lint count, then follow `@stale-source-gates` for exact before-counts. Inventory every other
selected module without writing.

### 4 — Classify and review

Every finding uses a category from `@staleness`. Present counts, exact paths, per-module apply action,
what stays untouched and every external mutation. Batch approval once. For assurance, separate repository
paths from provider/GitHub state and show value-free `scripts/publish-secret.mjs --plan` invocations.

`OK` approves only the displayed projects, roles, files, services, secret names and external targets. Take
the baseline after approval and before the first write; if lint-machine installation is the first write,
the baseline precedes it.

### 5 — Apply separated passes

Apply only selected modules, in this order, each as a readable pass and commit:

1. port offset;
2. lint machine;
3. strict fix;
4. source format;
5. source mechanical fixes;
6. source defects;
7. retired structure;
8. why index;
9. delivery assurance;
10. remnant removal.

Skip an unselected or clean pass. An empty-directory removal can have no Git diff but still records its
absolute path and before/after count. An unavailable external credential/check leaves assurance incomplete.

### 6 — Parallel defect repairs

Only source defects may fan out, partitioned by file so two agents never edit the same file. Port allocation, machine,
strict-fix, formatting, autofix, structure, why, assurance and remnant are single-writer passes. Agents may
run file-scoped lint only; the coordinator owns shared-state gates and remeasurement.

### 7 — Prove each module

Run every selected module's `Proof`. Re-run the exact original source gates once, in mandatory order, and
report before/after. A source pass requires lint 0 errors/0 warnings; unit S/L/F ≥80%, branches ≥75% and
patch/new metrics ≥90%; an existing declared E2E entrypoint with real tests and all passing; and final Sonar
pass. Skip/todo/passWithNoTests/zero-test/check substitutes reject.
Use `node @source-quality` for final whole-Source remeasurement; do not replace its failed or unmeasured
facts with narrative inference.
Inspect the complete baseline diff for boundary violations and secret material. External enforcement is
proved by authorized API evidence, never inferred from workflow text.
An active debt produces `debt`, not `pass`; this skill may close delivery as allowed only when the shared
machine says `deliveryAllowed`, while readiness remains false and the debt record stays untouched.

### 8 — Close

State approved revision, baseline and applied commits, paths by pass, before/after counts and unresolved
external authority. Continue while any in-scope executable action remains.

## Stops

- Route absent/invalid/stale → return its evidence and initialization owner.
- Unexplained dirty target → stop; a mixed baseline proves nothing.
- Gate can pass only through suppression → return the finding.
- Module boundary must expand → return one batched `### NEED APPROVALS` item.
- Credential exists only in chat, stdout, command argument or plaintext → return the value-free secure
  publisher plan from `@stale-assurance`; never handle that value.
- Repository declares no meaningful gates → report source stale; do not invent a gate surface during measurement.

## OUTPUT

Use the registry category names. State before/after evidence, material paths, assurance repository/external
proof and remaining owner decisions concisely. Never include secret values.

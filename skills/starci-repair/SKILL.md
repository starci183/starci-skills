---
name: starci-repair
description: Take a routed source that is red, structurally stale, untrusted, or missing required backend delivery assurance and return it green through measured, separated passes. Uses the shared stale registry for every finding and never silences a gate or publishes plaintext credentials. Writes product and external enforcement state only after approval.
---

# starci-repair

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape` | module | shared phase, approval and output contract |
| `@stale-registry` | `stale` | registry | the one taxonomy and router for every repair module |

## NESTED SKILLS

None. A stale route is returned to `starci-init`; this skill never starts setup.

## Run

Read `@skill-shape`, then `@stale-registry`. Do not restate a category's law here. The registry owns what
is stale and routes to the module that owns list evidence, inventory, apply and proof.

## Module selection

Read only reached modules during repair:

- always read `@stale-source-gates` and `@stale-lint-machine` after the route verifies;
- read `@stale-strict-fix` when strict-fix was requested or its first-party surface is present;
- read `@stale-why` when the route has a contract;
- read `@stale-assurance` for a backend, then obey its tracked applicability declaration;
- read `@stale-retired-structure` for a frontend component tree;
- read `@stale-remnant` only for nested `.claude/` inside the resolved target.

A module not reached creates no finding, boundary or work.

## Invariants

Green is earned, never bought. No `eslint-disable`, weakened severity, removed rule, skipped test or `any`
added to end a finding. A decision is returned. Formatting is isolated from behavior. The consumer installs
published lint rules and never authors or repairs a private copy.

One repair record covers one role of one project. A multi-project request coordinates separate records,
baselines and diffs under one approval batch. Whole-repository gates run once per checkout by the coordinator.

## PROCESS

### 1 — Resolve the route

Read `.workspace/<project>/<role>/config.json`. Verify checkout, git root, branch/head, manifests and the
frontend contract when declared. Stop before target-source reads if the route is absent, invalid or stale;
`@stale-registry` assigns that finding to `starci-init`.

### 2 — Read manifest and select modules

Read the repository manifest and existing gate scripts. Select modules using the rules above, then read
each selected English record completely before inventory. Do not run end-to-end suites unless the request
names them.

### 3 — Establish the baseline state

Refuse an unexplained dirty target tree. Record the pre-change commit. Follow `@stale-lint-machine` before
believing any lint count, then follow `@stale-source-gates` for exact before-counts. Inventory every other
selected module without writing.

### 4 — Classify and review

Every finding uses a category from `@stale-registry`. Present counts, exact paths, per-module apply action,
what stays untouched and every external mutation. Batch approval once. For assurance, separate repository
paths from provider/GitHub state and show value-free `scripts/publish-secret.mjs --plan` invocations.

`OK` approves only the displayed projects, roles, files, services, secret names and external targets. Take
the baseline after approval and before the first write; if lint-machine installation is the first write,
the baseline precedes it.

### 5 — Apply separated passes

Apply only selected modules, in this order, each as a readable pass and commit:

1. lint machine;
2. strict fix;
3. source format;
4. source mechanical fixes;
5. source defects;
6. retired structure;
7. why index;
8. delivery assurance;
9. remnant removal.

Skip an unselected or clean pass. An empty-directory removal can have no Git diff but still records its
absolute path and before/after count. An unavailable external credential/check leaves assurance incomplete.

### 6 — Parallel defect repairs

Only source defects may fan out, partitioned by file so two agents never edit the same file. Machine,
strict-fix, formatting, autofix, structure, why, assurance and remnant are single-writer passes. Agents may
run file-scoped lint only; the coordinator owns shared-state gates and remeasurement.

### 7 — Prove each module

Run every selected module's `Proof`. Re-run the exact original source gates once and report before/after.
Inspect the complete baseline diff for boundary violations and secret material. External enforcement is
proved by authorized API evidence, never inferred from workflow text.

### 8 — Close

State approved revision, baseline and applied commits, paths by pass, before/after counts and unresolved
external authority. Continue while any in-scope executable action remains.

## Stops

- Route absent/invalid/stale → return its evidence and `starci-init` owner.
- Unexplained dirty target → stop; a mixed baseline proves nothing.
- Gate can pass only through suppression → return the finding.
- Module boundary must expand → return one batched `### NEED APPROVALS` item.
- Credential exists only in chat, stdout, command argument or plaintext → return the value-free secure
  publisher plan from `@stale-assurance`; never handle that value.
- Repository declares no meaningful gates → report source stale; do not invent a gate surface during measurement.

## OUTPUT

Use the registry category names. State before/after evidence, material paths, assurance repository/external
proof and remaining owner decisions concisely. Never include secret values.

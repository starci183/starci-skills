---
name: starci-debt-repay
description: Repay owner-approved Source debt recorded in project and role Markdown records, prove the owning gates, update progress, and remove only scopes that are genuinely green. Use when the owner asks to pay down, clear, close or work through recorded debt; not for creating or accepting new debt.
---

# starci-debt-repay

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/context.md` | context | execution, approval and reporting contract |
| `@workspaces` | `contexts/workspaces/context.md` | context | verify the project/role route before target reads |
| `@staleness` | `readiness/staleness/context.md` | context | route each namespaced scope to its finding owner |
| `@stale-debts` | `readiness/staleness/debts/context.md` | context | debt authority, expiry and close semantics |
| `@source-quality` | `scripts/check-source-quality.mjs` | script | validate debt and remeasure recognized source-quality scopes |

## NESTED SKILLS

None. Route initialization, new debt acceptance and provider setup remain separate owner capabilities.

## PIPELINE

Topology: `reconciliation`.

| Step | Track | Input | Transform | Required output | Gate |
|---|---|---|---|---|---|
| bind | shared | owner-approved debt record and verified project/role | freeze scope, exit criteria, expiry and owning gates | debt work contract | debt is active, explicit and in scope |
| measure | reconciliation | debt contract and current source/gate state | compare each recorded scope with measured evidence | progress and remaining-delta matrix | no scope is assumed green from prose |
| repay | execution | accepted delta matrix | change only debt-owned source and run its gates | implementation and measured progress receipt | no new debt, extension or unrelated write |
| close | proof | fresh green evidence and debt record | remove only scopes whose exit criteria pass | updated or removed debt receipt | every removed scope has reproducible green proof |

## Boundary

This skill repays existing debt. It never creates debt, extends expiry, adds a scope or treats the debt
record as permission to cross repositories. One run owns one project/role record unless the owner explicitly
names a batch. Route debt is record-only here: a stale route returns to the initialization owner before product reads.

## Process

1. Resolve and verify `.workspaces/local/routes/<project>/<role>/config.json`, then validate
   `.worktrees/<project>/debts/<role>.md` with `node @source-quality --debts --project <project> --role <role>`.
   Missing, invalid or expired debt stops the run; never reconstruct it from chat.
2. Read every scope and its Markdown baseline/exit criteria. Route `<category>:<finding>` through
   `@staleness` and load only the reached owner module. An unknown scope is reported for owner routing; it
   is never guessed.
3. Measure the current gate before writing. Preserve non-debt green gates. For safely independent source
   defects, partition files; one coordinator owns shared gate runs and the debt record.
4. Repair the underlying cause. Coverage debt is paid with real colocated `.spec.` tests and the declared
   unit producer; Sonar debt is paid with hidden credential intake, exact-SHA scan and strict API proof.
   Never lower thresholds, exclude source, skip tests, remove required checks or use debt to buy green.
5. Run the scope's exact exit criteria plus every non-debt gate that the change can affect. A measured
   improvement below the exit criterion is progress, not repayment.
6. Append a dated `## Progress` entry with revision, commands and measurements. Remove a scope from front
   matter only when its exit criterion passes. When the last scope passes, delete the exact debt Markdown
   file with `apply_patch`; do not leave an empty debt record.
7. Commit source repair separately from the debt-progress/closure commit. Push only when the current owner
   request explicitly authorizes it.

## Stops

- Route absent, invalid or stale → return to the initialization owner; do not touch target source.
- Debt missing, invalid, expired or not owner-approved → fail closed.
- Scope has no owning law → report the exact namespace and request an owner route.
- Provider credential missing → use hidden OS-compatible intake; never request or print the value in chat.
- Exit criterion can pass only through suppression or weakened enforcement → keep the debt and report why.

## Output

State the project/role, scopes before/after, source commits, debt-record commit, exact measurements and
whether the record remains or was removed. Use `debt reduced`, `debt repaid`, or `debt still open`; never
say `pass` for a remaining scope.

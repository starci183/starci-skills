---
title: Repay Source debt
---

# Repay Source debt

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/en.md` | en | execution, approval and reporting contract |
| `@workspaces` | `contexts/workspaces/en.md` | en | verify the project/role route before target reads |
| `@staleness` | `readiness/staleness/en.md` | en | route each namespaced scope to its finding owner |
| `@stale-debts` | `readiness/staleness/debts/en.md` | en | debt authority, expiry and close semantics |
| `@source-quality` | `scripts/check-source-quality.mjs` | script | validate debt and remeasure recognized quality scopes |

## NESTED SKILLS

None. Initialization, new debt acceptance and provider setup remain separate owner capabilities.

## Boundary

Repay existing owner-approved debt only. Never create debt, extend expiry, add scopes or cross repositories.
One run owns one project/role record unless the owner explicitly names a batch. Route debt is record-only;
a stale route returns to the initialization owner before product reads.

## Process

1. Verify the route and validate `.worktrees/<project>/debts/<role>.md` with the debt-only quality command.
2. Read every namespaced scope, baseline and exit criterion; route it through the staleness registry.
3. Measure before writing, repair the underlying cause without weakened gates, then prove the exact criterion.
4. Append dated progress for improvement below the bar. Remove a scope only after proof; delete the Markdown
   record after the final scope passes.
5. Keep source and debt-record commits separate. Push only under explicit current authorization.

## Stops

- Route absent, invalid or stale → return to the initialization owner; do not touch target source.
- Debt missing, invalid, expired or not owner-approved → fail closed.
- Unknown scope → report the namespace for owner routing; do not guess.
- Missing credential → use hidden OS-compatible intake; never request or print it in chat.
- Suppression is the only path to green → keep the debt open.

## Output

State project/role, scopes before/after, commits, measurements and whether the record remains. Use `debt
reduced`, `debt repaid` or `debt still open`; never call a remaining scope pass.

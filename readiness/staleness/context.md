# Stale registry

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@stale-source-gates` | `readiness/staleness/source-gates/context.md` | context | declared project gates and source findings |
| `@stale-port-offset` | `readiness/staleness/port-offset/context.md` | context | Source-owned family offsets, application slots and collision proof |
| `@stale-lint-machine` | `readiness/staleness/lint-machine/context.md` | context | canon adoption and vendored-rule detection |
| `@stale-strict-fix` | `readiness/staleness/strict-fix/context.md` | context | first-party Prettier integration |
| `@stale-why` | `readiness/staleness/why/context.md` | context | contract index findability |
| `@stale-assurance` | `readiness/staleness/assurance/context.md` | context | frontend and backend delivery assurance applicability and fence |
| `@stale-debts` | `readiness/staleness/debts/context.md` | context | owner-approved, measured, expiring quality debt |
| `@stale-retired-structure` | `readiness/staleness/retired-structure/context.md` | context | removed component tiers including empty paths |
| `@stale-remnant` | `readiness/staleness/remnant/context.md` | context | nested legacy `.claude/` trees |

## Purpose

The registry routes through `@stale-source-gates`, `@stale-port-offset`, `@stale-lint-machine`, `@stale-strict-fix`,
`@stale-why`, `@stale-assurance`, `@stale-debts`, `@stale-retired-structure` and `@stale-remnant`.

Give `starci-repair` and `starci-stale-list` one vocabulary. The list measures these categories; repair
applies the owner named here. A category copied into either skill becomes a second home and must be removed.

Both skills read this registry first. `starci-stale-list` then reads every module and uses only its
`List evidence`; `starci-repair` reads only modules reached by the routed source and uses inventory, apply
and proof. Route staleness has no repair module here because its owner is `starci-init`.

## Categories

| Category | Stale when | Cleared by |
|---|---|---|
| `route` | checkout, contract, branch or recorded head no longer describes this machine | `starci-init` |
| `port-offset` | Source allocation is absent/invalid, product owns an offset, projection drifts, or local listeners collide | `starci-repair`, port-offset pass |
| `source` | any routed role lacks or fails the ordered format→lint→typecheck→build→unit coverage→E2E→Sonar fence, including lint warnings, coverage below threshold, fake/empty E2E or missing Sonar | `starci-repair`, source-gates pass |
| `index` | a contract `why` describes a shape instead of the need that finds it | `starci-repair`, why pass |
| `machine` | published lint canon is absent or a vendored rule copy is imported | `starci-repair`, lint-machine pass |
| `formatter` | strict-fix scope still has first-party Prettier integration | `starci-repair`, strict-fix pass |
| `assurance` | assurance is required and any reached delivery-fence fact is absent or non-blocking | `starci-repair`, assurance pass |
| `debt` | a valid `.worktrees/<project>/debts/<role>.md` records any owner-approved unresolved finding by namespaced scope; its owning machine decides delivery impact, and malformed/expired debt fails closed | finding owner, then removal after exit criteria pass |
| `structure` | a retired tier still exists, including an empty directory | `starci-repair`, retired-structure pass |
| `remnant` | a routed checkout contains an old nested `.claude/` | `starci-repair`, remnant pass or owner decision |

## Shared rules

- `stale-list` reports; it never repairs. `repair` measures before it writes.
- `ready` requires local execution evidence from the current checkout for every routed role. The source
  fence is format→lint→typecheck→build→unit coverage→E2E→Sonar; lint is 0 errors/0 warnings, unit is
  S/L/F ≥80%, branches ≥75%, patch/new metrics ≥90%, and E2E must use an existing declared entrypoint,
  real tests and all passing. `skip`, `todo`, `passWithNoTests`, zero-test and check substitutes reject.
  A declared gate only discovered, not run, is `unmeasured` and can never support ready.
- Every finding carries category, evidence, applicability and owner.
- Debt never changes a measurement to green. `pass` remains false while debt exists; delivery may continue
  only when every remaining finding is covered by active debt and every non-debt gate is green.
- `absent`, `invalid`, `stale`, `debt`, `not required`, `unmeasured external` and `clean` are distinct verdicts.
- A route finding ends repair before target-source reads. Source repair through a stale route targets an
  unverified checkout.
- A decision is returned; it is never disguised as a defect to keep a run moving.

## Output

Report by project and role, then category. Silence never means a layer ran: say `clean`, `not required`
or `unmeasured external` where omission would mislead.

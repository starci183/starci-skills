---
name: starci-stale-list
description: Read the shared stale registry, inventory every routed workspace role, and execute its declared local check-only readiness gates without repairing tracked source or external state. Reports route, port allocation, measured source gates, why index, lint machine, formatter, frontend or backend delivery assurance, retired structure and remnant evidence with the owner that clears each.
---

# starci-stale-list

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/context.md` | context | shared output and authority contract |
| `@staleness` | `readiness/staleness/context.md` | context | the one taxonomy and router shared with repair |
| `@export-state` | `scripts/export-console-state.mjs` | script | deterministic read-only workspace measurement |
| `@port-offset-check` | `scripts/check-port-offsets.mjs` | script | deterministic Source allocation and collision measurement |
| `@source-quality` | `scripts/check-source-quality.mjs` | script | deterministic routed lint, coverage, E2E and strict Sonar measurement |
| `@stale-debts` | `readiness/staleness/debts/context.md` | context | validate and report current project/role debt without repairing it |

## NESTED SKILLS

None. This skill names owners and never invokes them.

## Run

Read `@skill-shape`, `@staleness`, then every module routed by the registry. Use only each module's
`List evidence`; never apply its inventory, apply or proof steps.

Measurement-only: local check commands may create ignored caches or build output, but the moment a report
repairs tracked source or external state nobody can trust it as a measurement.

## PROCESS

### 1 — Establish the read-only boundary

`Touching` is nothing. Read `.workspace/config.json` and every declared role. If the workspace root is
absent, report that fact and stop.

### 2 — Run the shared scanner

```bash
node @export-state --stale
```

The script measures routes, contracts, manifests, lint adoption, first-party formatter integration, local
assurance wiring, retired structure and remnants. It exits non-zero when stale; that exit is a verdict,
not a reason to reimplement the scan in conversation.

Then run `node @port-offset-check`. Its non-zero exit is the `port-offset` verdict. Name every deliberate
project exclusion explicitly; do not make an excluded family disappear from the report.

Run `node @source-quality --debts` and report every active, invalid or expired Markdown debt separately.

### 3 — Report registry verdicts

Group by project, with roles underneath. Use category and verdict names from `@staleness`. For every
module, emit its `List evidence`, current count/fact and clearing owner. Report clean and `not required`
explicitly where silence would imply an omitted scan.

### 4 — Measure local readiness gates

For the source-gates module, execute every declared entrypoint for every routed role in this order: format,
lint, typecheck, build, unit coverage, E2E, Sonar. Record exact command and exit status, lint 0/0, coverage
metrics, E2E entrypoint/test/pass counts and Sonar verdict. Generated ignored state is allowed; tracked source
changes stop the report. Unit must be S/L/F ≥80%, branches ≥75%, patch/new metrics ≥90%; E2E must have real
tests and all passing. Missing prerequisites or any unmeasured/failed gate means the project is not ready.
Use `node @source-quality`; its non-zero exit is the ordered source-fence verdict, not permission to
reimplement, skip or downgrade a failed fact.
Verdict `debt` and `deliveryAllowed` are reported exactly; neither is renamed `pass` or `ready`.

### 5 — Keep external assurance honest

For the assurance module, read names and local wiring only. Never decrypt a record or read provider values.
Required checks, expected-app binding and secret existence/value remain `unmeasured external` unless an
authorized API supplies evidence.

### 6 — Stop without repair

Return every category, evidence and owner. Do not refresh a route, edit a reason, install a package, remove
Prettier, create assurance state, move a component or delete a remnant. A later fix is a separate repair
or initialization request with its own authority.

## Stops

- `.workspace` absent → report no routes and end.
- Route JSON invalid → report `invalid`, not `absent` or `stale`.
- A category cannot be read safely → report it `unmeasured` with reason; do not guess.
- Reader asks for repair → finish the inventory; another capability owns the write.

## OUTPUT

Concise prose by project and category; no status table. Include clean, `not required` and `unmeasured`
wording where needed. Never include credential values.

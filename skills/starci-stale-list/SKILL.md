---
name: starci-stale-list
description: Read the shared stale registry and inventory every routed workspace role without executing project gates or changing state. Reports route, source surface, why index, lint machine, formatter, backend assurance, retired structure and remnant evidence with the owner that clears each. Read-only.
---

# starci-stale-list

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape` | module | shared output and authority contract |
| `@stale-registry` | `stale` | registry | the one taxonomy and router shared with repair |
| `@export-state` | `scripts/export-console-state.mjs` | script | deterministic read-only workspace measurement |

## NESTED SKILLS

None. This skill names owners and never invokes them.

## Run

Read `@skill-shape`, `@stale-registry`, then every module routed by the registry. Use only each module's
`List evidence`; never apply its inventory, apply or proof steps.

Plan-only: the moment a report repairs something, nobody can trust it as a measurement.

## PROCESS

### 1 — Establish the read-only boundary

`Phase` is `plan`; `Touching` is nothing. Read `.workspace/config.json` and every declared role. If the
workspace root is absent, report that fact and stop.

### 2 — Run the shared scanner

```bash
node @export-state --stale
```

The script measures routes, contracts, manifests, lint adoption, first-party formatter integration, local
assurance wiring, retired structure and remnants. It exits non-zero when stale; that exit is a verdict,
not a reason to reimplement the scan in conversation.

### 3 — Report registry verdicts

Group by project, with roles underneath. Use category and verdict names from `@stale-registry`. For every
module, emit its `List evidence`, current count/fact and clearing owner. Report clean and `not required`
explicitly where silence would imply an omitted scan.

### 4 — Keep project gates unmeasured

For `@stale-source-gates`, list declared format/lint/typecheck/build/unit entrypoints only. Never execute
them. A typecheck/build/test can write state; running lint alone would make the report look broader than it is.

### 5 — Keep external assurance honest

For `@stale-assurance`, read names and local wiring only. Never decrypt a record or read provider values.
Required checks, expected-app binding and secret existence/value remain `unmeasured external` unless an
authorized API supplies evidence.

### 6 — Stop without repair

Return every category, evidence and owner. Do not refresh a route, edit a reason, install a package, remove
Prettier, create assurance state, move a component or delete a remnant. A later fix is a separate
`starci-repair` or `starci-init` request with its own approval.

## Stops

- `.workspace` absent → report no routes and end.
- Route JSON invalid → report `invalid`, not `absent` or `stale`.
- A category cannot be read safely → report it `unmeasured` with reason; do not guess.
- Reader asks for repair → finish the inventory; another capability owns the write.

## OUTPUT

Concise prose by project and category; no status table. Include clean, `not required` and `unmeasured`
wording where needed. Never include credential values.

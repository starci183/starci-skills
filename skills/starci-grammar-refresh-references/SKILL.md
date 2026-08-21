---
name: starci-grammar-refresh-references
description: Audit and immediately refresh stale optional immutable Git references for durable grammar capsules. Use when a reference file moved, disappeared, or no longer demonstrates its capsule. Runs audit, behavior comparison, sidecar update and validation in one bounded workflow; never changes templates, capsules, founder rulings, golden/counterexample cases, rules, profiles, or product source.
---

# grammar reference refresh

Read `../../skill-shape.md`. Templates and capsules remain authority; refs are optional provenance.

## CONTEXT

### CONTEXT

| Field | Value |
|---|---|
| Source | repository containing `.claude` |
| Project | declared project or explicit targets |
| App | selected product profile |
| Trust | `<Source>/.claude` |
| Workflow | `<Source>/.workflows/upgrade/<app>/grammar-reference-refresh.md` |
| Phase | `apply` |
| Touching | optional `<grammar-root>/references.json` and workflow only |

## PROCESS

1. Run `node <trust-root>/skills/starci-grammar-refresh-references/scripts/audit-reference-sidecar.mjs <grammar-root>`.
2. Treat a missing sidecar as `None`; do not create refs without an explicit stale-reference request.
3. Require `git+https://...@<40-char-commit>:<path>`; mutable branch refs are invalid.
4. For each stale ref, compare the candidate only against the capsule invariants and counterexamples.
5. Replace the ref immediately when behavior is faithful. Never edit or regenerate the durable template from source.
6. Run the sidecar audit and grammar validator; fail if any durable grammar hash changed.
7. Append one workflow event with old ref, new ref, reason and validation.

## OUTPUT

### OUTPUTS

| Concept | Result |
|---|---|
| optional provenance | refreshed immutable refs or `None` |

### CHANGES

| Tree | Details |
|---|---|
| `references.json` | stale refs only |
| workflow | audit and validation evidence |

### NEED APPROVALS

| Question | Options |
|---|---|
| None | None |

### WARNINGS

| Warning | Impact |
|---|---|
| remote ref disappears later | durable grammar still runs from capsules/templates/cases |

### REJECTED

| Rejected | Instead | Why |
|---|---|---|
| mutable or behavior-drifted ref | immutable faithful ref | provenance must remain inspectable |

### OWED

| Owed | Cleared by |
|---|---|
| None | None |

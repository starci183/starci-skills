---
name: starci-fe-design-plan
description: Research and brief two to four implementation-feasible directions for net-new or undecided StarCi frontend work. Use when hierarchy, CTA, interaction or disclosure still needs a product choice. Writes only the workflow brief; creates no HTML, JSX, CSS or parallel design code. Not for a bounded fix with a known reference; use starci-fe-fidelity-plan instead.
---

# StarCi FE Design Plan

Read [`../../skill-shape.md`](../../skill-shape.md) first and use
`<backend-repo>/.workflows/designs/<app>/<id>.md`.

Plan exists for a product choice. If a named reference, contract or test already settles the answer,
route the bounded correction to `$starci-fe-fidelity-plan`.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

`Touching` is the workflow file only. Plan writes no production source and creates no proposal
directory. Name the app and database when the screen depends on backend behavior.

## PROCESS

Read the live GraphQL contracts, target components, governing `.claude` canon and named legacy
references before proposing anything. A screen must not promise data the backend cannot serve or
anatomy the target cannot own.

Brief two to four directions that differ in product decisions: reading order, CTA priority,
disclosure, density or composition. Do not manufacture variants that differ only in colour or
spacing. A migration or parity request includes a parity-first direction.

Keep every direction conceptual: decision matrix, contract impact, reuse boundary, owner states and
acceptance evidence. Create no HTML, JSX, CSS, screenshots-as-implementation or parallel design tree.
Review challenges and approves the brief; Apply writes the selected direction directly in source.

Before proposing a new contract entry, composite or row, inventory existing keys and classify the
result as REUSE, EXTEND or NEW because the relationship cannot be expressed by an existing owner.

Append `## plan` after the direction is selected. Record evidence, alternatives, chosen concept,
reason, acceptance states and rejections. Then invite `$starci-fe-design-review` to challenge and
approve that brief before source changes begin.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED`
and `### OWED`.

Print `OUTPUTS`, `CHANGES`, `NEED APPROVALS`, `WARNINGS`, `REJECTED` and `OWED` in that order.

`OUTPUTS` names the brief and candidate concepts. `CHANGES` names only the workflow. Put the direction
choice in `NEED APPROVALS` when evidence cannot settle it. Do not list conceptual proposals as files.

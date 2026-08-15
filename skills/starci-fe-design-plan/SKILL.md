---
name: starci-fe-design-plan
description: Research, render and serve one tabbed HTML preview containing two to four implementation-feasible directions for net-new or undecided StarCi frontend work, then record the user's choice. Use when hierarchy, CTA, interaction or disclosure still needs a product choice. Writes workflow evidence and one disposable index.html only; never production source. Not for a bounded fix with a known reference; use starci-fe-fidelity-start instead.
---

# StarCi FE Design Plan

Read [`../../skill-shape.md`](../../skill-shape.md) first and use
`<Source>/.workflows/designs/<app>/<id>.md`.

Plan exists for a product choice. If a named reference, contract or test already settles the answer,
route the bounded correction to `$starci-fe-fidelity-start`.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

Require a user-declared `Project` or explicit `Frontend` and `Backend`, then resolve `Frontend` for this phase; never infer it from `Source` or `App`.

`Touching` is the workflow file plus
`<Source>/.workflows/.previews/designs/<app>/<id>/<revision>/`. Plan writes no production source. Name
the app and database when the screen depends on backend behavior.

## PROCESS

Read the live GraphQL contracts, target components, governing `.claude` canon and named legacy
references before proposing anything. A screen must not promise data the backend cannot serve or
anatomy the target cannot own.

Brief two to four directions that differ in product decisions: reading order, CTA priority,
disclosure, density or composition. Do not manufacture variants that differ only in colour or
spacing. A migration or parity request includes a parity-first direction.

Create one `index.html` with two to four tabs that make those product decisions visible. Every tab
contains one implementation-feasible direction and enough responsive states for comparison. Tabs
must switch client-side without changing URL or reloading another HTML file. This HTML is disposable
Plan evidence, not production JSX/CSS and not an Apply baseline.

Serve the proposal directory on the first free port from `8080` upward:

```powershell
python <trust-root>/skills/starci-fe-design-plan/scripts/serve_proposals.py <proposal-directory> --start-port 8080
```

Keep the server running while approval is pending. If the process stops, restart it and append the
new PID/port/URLs instead of leaving stale links.

Before proposing a new contract entry, composite or row, inventory existing keys and classify the
result as REUSE, EXTEND or NEW because the relationship cannot be expressed by an existing owner.

Before asking the user to choose, append these tracking tables in Vietnamese prose:

| Preview | URL | HTML | SHA-256 | Status |
|---|---|---|---|---|
| one preview identity | one live localhost URL | absolute `index.html` path | content digest | `đang chờ` or `đã chốt` |

| Direction | Tab | Status |
|---|---|---|
| stable direction ID | visible tab label or selector | `đang chờ`, `đã chọn` or `đã từ chối` |

Record the preview root, PID and selected port. After the user chooses a tab, append the selected
direction, reason, acceptance states and rejections. Then invite `$starci-fe-design-review` to
challenge and approve that brief before source changes begin.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED`
and `### OWED`.

Print `OUTPUTS`, `CHANGES`, `NEED APPROVALS`, `WARNINGS`, `REJECTED` and `OWED` in that order.

`OUTPUTS` names the brief and direction concepts. `CHANGES` details only the workflow and one
`index.html`. Put the tab choice and single live URL in `NEED APPROVALS` until the user selects one.
Write workflow prose and values in Vietnamese.

---
name: starci-fe-design-plan
description: Start or resume one StarCi frontend design journey from business input through layout and block JSON choices, then execute only accepted hashes. Use for new pages, layouts, modals, drawers, overlays or material FE redesign. This is the sole orchestrator; it creates no HTML preview lifecycle.
---

# StarCi FE Design Plan

Read [`../../skill-shape.md`](../../skill-shape.md), [`../../fe/gates/`](../../fe/gates/INDEX.md) and
[`../../fe/intent/`](../../fe/intent/INDEX.md). Require a user-declared `Project` or explicit `Frontend` and `Backend`.
Use one workflow record and one registry session; never infer a target from Source.

Read `context.grammar` from the resolved FE role and load exactly
`../../grammars/<context.grammar>/grammar.json` and `profile.json`. There is no project-name lookup,
fallback grammar or grammar synthesis. A missing exact route stops before Layout.

## CONTEXT

Print the canonical `### CONTEXT` table with Source, Project, Frontend, Backend, Trust, workflow,
branches, session id, registry branch and exact `Touching` boundary.

## PROCESS

1. Open or resume the session by its stable id and verify current object/ref hashes and grammar
   receipt. A changed grammar/profile hash reopens affected Layout units.
2. Extract only source-, contract- or user-backed closed facts, run
   `scripts/resolve-fe-grammar.mjs`, persist its receipt, then convert requested surfaces into Gate 1
   inputs and invoke
   `$starci-fe-design-layout` until the reachable surface graph is accepted.
3. Invoke `$starci-fe-design-block` for every block in every accepted layout until all required
   block hashes are accepted.
4. Display queued/rejected/approved heads and unresolved decisions after every founder prompt.
5. Invoke `$starci-fe-design-execute` only when graph traversal proves the layout and block
   whitelist complete and every accepted unit binds the current grammar receipt.

No tabbed HTML preview, separate Design Review or separate Design Apply exists. The JSON candidates,
their rendered explanation, exact prompt/response objects and founder acceptance events are the
review surface. Layout/Block feedback always opens a new immutable round.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED`
and `### OWED`. Report session id, current unit, candidate/ref hashes, registry receipt and next
worker. Never claim completion while a reachable required unit remains queued.

---
name: starci-frontend-layout-delivery
description: "Use to create or substantially redesign a complete frontend customer journey, page set, page models, layouts, implementation, and proof. Do not use for isolated blocks, approved maintenance, learning resolution, or cross-surface consistency."
---

# starci-frontend-layout-delivery

Use to create or substantially redesign a complete frontend customer journey, page set, page models, layouts, implementation, and proof. Do not use for isolated blocks, approved maintenance, learning resolution, or cross-surface consistency.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `route`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. Stop at waits for the exact displayed revision and finish only at a terminal. Purge all intermediates at every terminal while preserving approved durable mutations.

## CONTEXT CONTRACT

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `route + staleness` | route, commit, revision, receipt and hash metadata | business body, Qdrant bodies, source files |
| `business initialize` | exact evidence and business lifecycle law only after stale decision | frontend knowledge and coding context |
| `preflight` | request, route and fresh-business receipt headers | all semantic bodies |
| `customer journey` | fresh business journey projection + fe.customer-journey | Principles, Grammar, coding context, raw source |
| `page + state` | selected journey + exact business slice + one operator law | other directions and source |
| `context sync` | metadata first; changed generated JSON/knowledge only on hash miss | unchanged bodies and model-visible raw source |
| `source fit + Principles + layout + Grammar` | approved session refs + exact Qdrant records + canonical JSON candidates | whole indexes, unrelated features, raw source |
| `coding scope freeze` | approved refs, canonical candidate records, exact file headers | file bodies and repository scans |
| `implementation + proof` | only frozen exact files, commands, seeds and receipts | undeclared files, broad Qdrant, unrelated business |

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@selection` | global `/analyze-input.md` output | task-session | bind prompt intent directly to this one-flow skill |
| `@machine` | `machine.json` | file | executable state-machine graph |
| `@analysis` | `analyze-input.md` | file | local validation and normalization before operator load |

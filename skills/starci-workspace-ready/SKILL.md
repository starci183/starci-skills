---
name: starci-workspace-ready
description: "Use when a StarCi Source must be initialized or brought to one fully verified workspace-ready state before product work. Do not use for business modeling, implementation, quality repair, or deployment."
---

# starci-workspace-ready

Use when a StarCi Source must be initialized or brought to one fully verified workspace-ready state before product work. Do not use for business modeling, implementation, quality repair, or deployment.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `identity`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. An omitted `selection.mode` is `gated`: stop at waits for the exact displayed revision. With explicit `selection.mode=bypass`, bind the displayed revision to an ephemeral bypass-authorization receipt and continue only to the wait state's declared `approval.bypassTarget`. Finish only at a terminal and purge all intermediates while preserving authorized durable mutations.

## CONTEXT CONTRACT

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `identity + freshness checks` | project id, repository root, commit, config hashes and receipt headers | business bodies, Qdrant bodies, product source bodies |
| `initialize one stale layer` | only that layer manifest and exact initializer contract | later workspace layers and product context |
| `route verification` | compiled route refs and hash metadata | business, design, source and deployment context |

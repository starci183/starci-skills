---
name: starci-business-reconcile
description: "Use when immutable delivery evidence must be reconciled against one published business feature head. Do not use to create a business model or implement source."
---

# starci-business-reconcile

Use when immutable delivery evidence must be reconciled against one published business feature head. Do not use to create a business model or implement source.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `reconcile-route`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. An omitted `selection.mode` is `gated`: stop at waits for the exact displayed revision. With explicit `selection.mode=bypass`, bind the displayed revision to an ephemeral bypass-authorization receipt and continue only to the wait state's declared `approval.bypassTarget`. Finish only at a terminal and purge all intermediates while preserving authorized durable mutations.

## CONTEXT CONTRACT

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `route + freshness` | project route, source commit, business baseline and generator/schema hashes | business body, Qdrant bodies and product source |
| `evidence normalization` | exact declared evidence only | frontend/backend implementation and unrelated feature evidence |
| `model + review` | normalized evidence, lifecycle law and current feature head | repository source and unrelated business heads |
| `publish or reconcile` | approved revision or frozen pre-delivery receipt plus delivery proof | mutable session plans and broad source scans |

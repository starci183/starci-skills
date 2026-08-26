---
name: starci-frontend-implementation
description: "Implement one approved and frozen frontend contract inside its exact source boundary. Do not redesign surfaces, navigation, decoration, state, or responsive behavior."
---

# starci-frontend-implementation

Implement one approved and frozen frontend contract inside its exact source boundary. Do not redesign surfaces, navigation, decoration, state, or responsive behavior.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `implement`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. Stop at waits for the exact displayed revision and finish only at a terminal. Purge all intermediates at every terminal while preserving approved durable mutations.

## CONTEXT CONTRACT

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `route + target verification` | project route, approved target refs, source/contract hashes and receipt headers | business bodies, broad Qdrant and repository scans |
| `audit or reconcile` | exact component/surface contracts, selected Grammar pair and closed consumer refs | other Grammar packages, unrelated consumers and raw business context |
| `approval + mutation` | frozen decision hash, exact files and approval receipt | new discovery, undeclared files and scope expansion |
| `proof + learning` | changed-file receipts, focused checks and one durable learning request | session scratch and unrelated design history |

---
name: starci-backend-contract-critique
description: "Independently challenge one backend contract for wrong-store writes, authority drift, transaction gaps, failure handling, compatibility, and source overfitting. Do not mutate source."
---

# starci-backend-contract-critique

Independently challenge one backend contract for wrong-store writes, authority drift, transaction gaps, failure handling, compatibility, and source overfitting. Do not mutate source.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `critique`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. Stop at waits for the exact displayed revision and finish only at a terminal. Purge all intermediates at every terminal while preserving approved durable mutations.

## CONTEXT CONTRACT

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `route + freshness` | route, source commit, authority and coding-context hash metadata | business bodies, raw source and Qdrant bodies |
| `architecture + boundary planning` | exact business projection, canonical coding-context records and narrow operator knowledge | raw source files, whole indexes and unrelated modules |
| `approval + coding-scope freeze` | plan hash, source HEAD and exact target path/hash headers | file bodies and repository scans |
| `implementation` | approved boundary, exact frozen files and be.implementation knowledge | undeclared files, broad Qdrant and adjacent business |
| `quality + proof + reconcile` | changed-file receipts, declared commands, frozen pre-delivery receipt and immutable proof | new design context and unfrozen source discovery |

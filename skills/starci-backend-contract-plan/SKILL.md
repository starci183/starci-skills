---
name: starci-backend-contract-plan
description: "Freeze one backend state-change contract with exact writer, physical store, database, schema or collection, resource, transaction behavior, migration owner, and proof. Do not implement source."
---

# starci-backend-contract-plan

Freeze one backend state-change contract with exact writer, physical store, database, schema or collection, resource, transaction behavior, migration owner, and proof. Do not implement source.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `contract`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. An omitted `selection.mode` is `gated`: stop at waits for the exact displayed revision. With explicit `selection.mode=bypass`, bind the displayed revision to an ephemeral bypass-authorization receipt and continue only to the wait state's declared `approval.bypassTarget`. Finish only at a terminal and purge all intermediates while preserving authorized durable mutations.

## CONTEXT CONTRACT

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `route + freshness` | route, source commit, authority and coding-context hash metadata | business bodies, raw source and Qdrant bodies |
| `architecture + boundary planning` | exact business projection, canonical coding-context records and narrow operator knowledge | raw source files, whole indexes and unrelated modules |
| `approval + coding-scope freeze` | plan hash, source HEAD and exact target path/hash headers | file bodies and repository scans |
| `implementation` | approved boundary, exact frozen files and be.implementation knowledge | undeclared files, broad Qdrant and adjacent business |
| `quality + proof + reconcile` | changed-file receipts, declared commands, frozen pre-delivery receipt and immutable proof | new design context and unfrozen source discovery |

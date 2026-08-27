---
name: starci-static-quality-gates
description: "Run lint, TypeScript typecheck and Sonar for one exact source revision automatically before commit or when explicitly requested as a standalone gate. Do not mutate or commit source."
---

# starci-static-quality-gates

Run lint, TypeScript typecheck and Sonar for one exact source revision automatically before commit or when explicitly requested as a standalone gate. Do not mutate or commit source.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `lint`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. An omitted `selection.mode` is `gated`: stop at waits for the exact displayed revision. With explicit `selection.mode=bypass`, bind the displayed revision to an ephemeral bypass-authorization receipt and continue only to the wait state's declared `approval.bypassTarget`. Finish only at a terminal and purge all intermediates while preserving authorized durable mutations.

## CONTEXT CONTRACT

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `gate binding` | verified route, exact source revision, pinned commands, toolchain and timeout identities | business bodies, broad repository scans and unrelated source |
| `gate execution` | structured lint, typecheck, coverage and Sonar evidence for the exact revision | source mutation, hidden suppression, commit creation and unbounded retries |

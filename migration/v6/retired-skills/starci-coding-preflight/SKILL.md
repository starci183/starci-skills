---
name: starci-coding-preflight
description: "Bind the nearest implementation template, applicable ESLint rules, TypeScript contracts, and a bounded lint/typecheck/Sonar plan that activates before commit or by explicit standalone request. Do not run static gates or mutate source."
---

# starci-coding-preflight

Bind the nearest implementation template, applicable ESLint rules, TypeScript contracts, and a bounded lint/typecheck/Sonar plan that activates before commit or by explicit standalone request. Do not run static gates or mutate source.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `preflight`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. An omitted `selection.mode` is `gated`: stop at waits for the exact displayed revision. With explicit `selection.mode=bypass`, bind the displayed revision to an ephemeral bypass-authorization receipt and continue only to the wait state's declared `approval.bypassTarget`. Finish only at a terminal and purge all intermediates while preserving authorized durable mutations.

## CONTEXT INTERFACE

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `coding preflight` | exact target hashes, nearest declared templates, governing ESLint rules and TypeScript contracts | whole-repository scans, unrelated references and product-source mutation |
| `commit-triggered quality plan` | exact lint, typecheck and Sonar commands, commit or explicit activation, dependency order, parallel eligibility and time budgets | running gates during ordinary coding, unbounded waits, hidden check suppression and quality-gate weakening |

---
name: starci-frontend-maintenance-apply
description: "Use to apply one already approved source-first product maintenance change across every affected backend/frontend role and prove the mission end to end. Do not use for design exploration, unapproved feedback, or cross-surface authority selection."
---

# starci-frontend-maintenance-apply

Use to apply one already approved source-first product maintenance change across every affected backend/frontend role and prove the mission end to end. Do not use for design exploration, unapproved feedback, or cross-surface authority selection.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `maintenance-feedback-request`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. Stop at waits for the exact displayed revision and finish only at a terminal. Purge all intermediates at every terminal while preserving approved durable mutations.

## CONTEXT CONTRACT

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `route + target verification` | project route, approved target refs, source/contract hashes and receipt headers | business bodies, broad Qdrant and repository scans |
| `audit or reconcile` | exact component/surface contracts, selected Grammar pair and closed consumer refs | other Grammar packages, unrelated consumers and raw business context |
| `approval + mutation` | frozen decision hash, exact files, approval receipt and complete acceptance-plan identity | new discovery, undeclared files and scope expansion |
| `proof + learning` | changed-file receipt, approved proof matrix, deterministic seed, declared unit/E2E commands, UI-quality receipt, browser/account handles, complete state-and-viewport proof and one durable learning request | partial proof, skipped scenarios, raw credentials, session scratch and unrelated design history |

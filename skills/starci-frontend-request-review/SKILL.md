---
name: starci-frontend-request-review
description: "Use only to durably approve or reject one exact `.claude/requests/*.request.json` frontend feedback ledger with bounded priority before learning resolution. Do not use to resolve authority, mutate product source, or bypass evidence because a request is urgent."
---

# starci-frontend-request-review

Use only to durably approve or reject one exact `.claude/requests/*.request.json` frontend feedback ledger with bounded priority before learning resolution. Do not use to resolve authority, mutate product source, or bypass evidence because a request is urgent.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `request-review`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. Stop at waits for the exact displayed revision and finish only at a terminal. Purge all intermediates at every terminal while preserving approved durable mutations.

## CONTEXT CONTRACT

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `request review` | one durable request, its feedback-session ledger, current proof status and explicit review evidence | other requests, raw transcripts and unrelated source |
| `decision persistence` | exact request target, bounded owners, priority, rationale and decision hash | authority mutation, product mutation and owner expansion |

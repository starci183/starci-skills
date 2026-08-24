---
name: starci-conversation-record
description: "Use only to append one provider-neutral redacted conversation-provenance snapshot head. Do not use to query provenance, store raw transcripts, or analyze product work."
---

# starci-conversation-record

Use only to append one provider-neutral redacted conversation-provenance snapshot head. Do not use to query provenance, store raw transcripts, or analyze product work.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `record`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. Stop at waits for the exact displayed revision and finish only at a terminal. Purge all intermediates at every terminal while preserving approved durable mutations.

## CONTEXT CONTRACT

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `record` | redacted snapshot refs, provider-neutral identity and append head metadata | raw transcript, prompts, secrets and product reasoning |
| `query` | bounded conversation identity, authorized index metadata and returned refs | raw transcript bodies and unrelated conversations |

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@selection` | global `/analyze-input.md` output | task-session | bind prompt intent directly to this one-flow skill |
| `@machine` | `machine.json` | file | executable state-machine graph |
| `@analysis` | `analyze-input.md` | file | local validation and normalization before operator load |

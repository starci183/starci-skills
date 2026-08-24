---
name: starci-conversation-query
description: "Use only to query one bounded provider-neutral conversation-provenance identity. Do not use to record a snapshot, retrieve raw transcripts, or analyze product work."
---

# starci-conversation-query

Use only to query one bounded provider-neutral conversation-provenance identity. Do not use to record a snapshot, retrieve raw transcripts, or analyze product work.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `query`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. Stop at waits for the exact displayed revision and finish only at a terminal. Purge all intermediates at every terminal while preserving approved durable mutations.

## CONTEXT CONTRACT

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `record` | redacted snapshot refs, provider-neutral identity and append head metadata | raw transcript, prompts, secrets and product reasoning |
| `query` | bounded conversation identity, authorized index metadata and returned refs | raw transcript bodies and unrelated conversations |

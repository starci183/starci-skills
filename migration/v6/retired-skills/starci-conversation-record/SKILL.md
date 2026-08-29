---
name: starci-conversation-record
description: "Use only to append one provider-neutral redacted conversation-provenance snapshot head. Do not use to query provenance, store raw transcripts, or analyze product work."
---

# starci-conversation-record

Use only to append one provider-neutral redacted conversation-provenance snapshot head. Do not use to query provenance, store raw transcripts, or analyze product work.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `record`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. An omitted `selection.mode` is `gated`: stop at waits for the exact displayed revision. With explicit `selection.mode=bypass`, bind the displayed revision to an ephemeral bypass-authorization receipt and continue only to the wait state's declared `approval.bypassTarget`. Finish only at a terminal and purge all intermediates while preserving authorized durable mutations.

## CONTEXT INTERFACE

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `record` | redacted snapshot refs, provider-neutral identity and append head metadata | raw transcript, prompts, secrets and product reasoning |
| `query` | bounded conversation identity, authorized index metadata and returned refs | raw transcript bodies and unrelated conversations |

---
name: starci-architecture-discover
description: "Discover and classify the observed architecture and deployment model without treating source as target authority. Use before architecture option or data-ownership work."
---

# starci-architecture-discover

Discover and classify the observed architecture and deployment model without treating source as target authority. Use before architecture option or data-ownership work.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `evidence`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. Stop at waits for the exact displayed revision and finish only at a terminal. Purge all intermediates at every terminal while preserving approved durable mutations.

## CONTEXT CONTRACT

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `route + business freshness` | route, commits, hashes and receipt headers | raw source and unrelated business bodies |
| `frame + current state` | exact business projection, canonical coding-context candidates and architecture law | raw source files and whole indexes |
| `alternatives + challenge` | frozen constraints and two-to-four candidate summaries | reloading business, source or unrelated knowledge |
| `selection + handoff` | option-set hash, selected decision and approval receipt | unselected bodies and new discovery |

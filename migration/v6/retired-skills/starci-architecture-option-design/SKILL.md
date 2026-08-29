---
name: starci-architecture-option-design
description: "Produce and approve materially different target architecture options from frozen constraints, observed state, and ownership evidence. Do not implement or silently copy source precedent."
---

# starci-architecture-option-design

Produce and approve materially different target architecture options from frozen constraints, observed state, and ownership evidence. Do not implement or silently copy source precedent.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `options`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. An omitted `selection.mode` is `gated`: stop at waits for the exact displayed revision. With explicit `selection.mode=bypass`, bind the displayed revision to an ephemeral bypass-authorization receipt and continue only to the wait state's declared `approval.bypassTarget`. Finish only at a terminal and purge all intermediates while preserving authorized durable mutations.

## CONTEXT INTERFACE

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `route + business freshness` | route, commits, hashes and receipt headers | raw source and unrelated business bodies |
| `frame + current state` | exact business projection, canonical coding-context candidates and architecture law | raw source files and whole indexes |
| `alternatives + challenge` | frozen constraints and two-to-four candidate summaries | reloading business, source or unrelated knowledge |
| `selection + handoff` | option-set hash, selected decision and approval receipt | unselected bodies and new discovery |

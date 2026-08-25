---
name: starci-architecture-decide
description: "Use only for a genuinely difficult cross-system architecture choice with material alternatives or irreversible tradeoffs. Do not use for ordinary known-shape planning or implementation."
---

# starci-architecture-decide

Use only for a genuinely difficult cross-system architecture choice with material alternatives or irreversible tradeoffs. The recommendation must survive falsification-first review; requester preference and consensus are never decision evidence. Do not use for ordinary known-shape planning or implementation.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `route`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. Before an architecture approval wait, read and apply `../../operators/architecture/review-widget.md`; `architecture/decision-challenge` must emit a validated HTML preview and the host must render it through `visualize` before requesting `OK ARCHITECTURE`. Stop at waits for the exact displayed revision and finish only at a terminal. Purge all intermediates at every terminal while preserving approved durable mutations.

## CONTEXT CONTRACT

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `route + business freshness` | route, commits, hashes and receipt headers | raw source and unrelated business bodies |
| `frame + current state` | exact business projection, canonical coding-context candidates and architecture law | raw source files and whole indexes |
| `alternatives + challenge` | frozen constraints, two-to-four candidate summaries and a structured adversarial record that attacks the provisional recommendation first | reloading business, source or unrelated knowledge, recommendation-preserving critique and consensus scoring |
| `selection + handoff` | option-set hash, selected decision and approval receipt | unselected bodies and new discovery |

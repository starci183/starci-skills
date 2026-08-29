---
name: starci-frontend-maintenance-apply
description: "Use to apply one already approved source-first product maintenance change across every affected backend/frontend role and prove the mission end to end. Do not use for design exploration, unapproved feedback, or cross-surface authority selection."
---

# starci-frontend-maintenance-apply

Use to apply one already approved source-first product maintenance change across every affected backend/frontend role and prove the mission end to end. Do not use for design exploration, unapproved feedback, or cross-surface authority selection.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `maintenance-feedback-request`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. Before an architecture approval wait, read and apply `../../operators/architecture/review-widget.md`; `architecture/decision-challenge` must emit a validated HTML preview and the host must render it through `visualize` before requesting `OK ARCHITECTURE`. An omitted `selection.mode` is `gated`: stop at waits for the exact displayed revision. With explicit `selection.mode=bypass`, bind the displayed revision to an ephemeral bypass-authorization receipt and continue only to the wait state's declared `approval.bypassTarget`. Finish only at a terminal and purge all intermediates while preserving authorized durable mutations.

## CONTEXT INTERFACE

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `route + target verification` | project route, approved target refs, source/interface hashes and receipt headers | business bodies, broad default search and repository scans |
| `audit or reconcile` | exact component/surface capabilities, selected Grammar pair and closed consumer refs | other Grammar packages, unrelated consumers and raw business context |
| `approval + mutation` | frozen decision hash, exact files, approval receipt and complete acceptance-plan identity | new discovery, undeclared files and scope expansion |
| `proof + learning` | changed-file receipt, approved proof matrix, deterministic seed, declared unit/E2E commands, UI-quality receipt, browser/account handles, complete state-and-viewport proof and one durable learning request | partial proof, skipped scenarios, raw credentials, session scratch and unrelated design history |

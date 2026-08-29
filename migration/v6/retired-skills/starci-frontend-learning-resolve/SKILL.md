---
name: starci-frontend-learning-resolve
description: "Use to resolve one durably approved frontend design learning request into its declared authority. Do not use to review requests, apply ordinary feedback, redesign a journey, or reconcile consumers."
---

# starci-frontend-learning-resolve

Use to resolve one durably approved frontend design learning request into its declared authority. Do not use to review requests, apply ordinary feedback, redesign a journey, or reconcile consumers.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `learning-resolve`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. An omitted `selection.mode` is `gated`: stop at waits for the exact displayed revision. With explicit `selection.mode=bypass`, bind the displayed revision to an ephemeral bypass-authorization receipt and continue only to the wait state's declared `approval.bypassTarget`. Finish only at a terminal and purge all intermediates while preserving authorized durable mutations.

## CONTEXT INTERFACE

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `route + target verification` | project route, approved target refs, source/interface hashes and receipt headers | business bodies, broad default search and repository scans |
| `audit or reconcile` | exact component/surface capabilities, selected Grammar pair and closed consumer refs | other Grammar packages, unrelated consumers and raw business context |
| `approval + mutation` | frozen decision hash, exact files and approval receipt | new discovery, undeclared files and scope expansion |
| `proof + learning` | changed-file receipts, focused checks and one durable learning request | session scratch and unrelated design history |

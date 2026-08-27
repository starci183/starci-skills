---
name: starci-frontend-quality-audit
description: "Use to audit one verified frontend surface set against StarCi-owned product-neutral UI quality rules and return evidence-linked findings without changing source. Do not use for journey design, source repair, design-authority reconciliation, or delivery proof."
---

# starci-frontend-quality-audit

Use to audit one verified frontend surface set against StarCi-owned product-neutral UI quality rules and return evidence-linked findings without changing source. Do not use for journey design, source repair, design-authority reconciliation, or delivery proof.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `audit`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. An omitted `selection.mode` is `gated`: stop at waits for the exact displayed revision. With explicit `selection.mode=bypass`, bind the displayed revision to an ephemeral bypass-authorization receipt and continue only to the wait state's declared `approval.bypassTarget`. Finish only at a terminal and purge all intermediates while preserving authorized durable mutations.

## CONTEXT CONTRACT

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `audit` | verified route receipt, closed surface refs, exact browser target, pinned fe.ui-quality-review knowledge and task-session evidence | business bodies, broad source context, external skill runtime and undeclared surfaces |
| `terminal` | quality receipt and evidence-linked rule findings only | screenshots, traces, raw observations and source mutations |

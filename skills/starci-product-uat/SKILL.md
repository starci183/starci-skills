---
name: starci-product-uat
description: "Prove that a running product completes one approved business journey, turn UX/UI failures into a typed repair contract, and close exact feedback requests only after rerun proof passes."
---

# starci-product-uat

Prove that a running product completes one approved business journey, turn UX/UI failures into a typed repair contract, and close exact feedback requests only after rerun proof passes.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `verify`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. An omitted `selection.mode` is `gated`: stop at waits for the exact displayed revision. With explicit `selection.mode=bypass`, bind the displayed revision to an ephemeral bypass-authorization receipt and continue only to the wait state's declared `approval.bypassTarget`. Finish only at a terminal and purge all intermediates while preserving authorized durable mutations.

## CONTEXT CONTRACT

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `diagnosis or inventory` | declared command fingerprints, cached green receipts and exact failing evidence | unrelated source, broad Qdrant and speculative fixes |
| `approval` | one finding/debt identity, baseline, boundary and approval hash | source bodies and other findings |
| `repair` | only approved exact files and narrow repair law | scope expansion, unrelated findings and whole-repository scans |
| `verification + loop` | independent proof, prior fingerprint, loop counter and residual identity | stale observations and reloaded unrelated context |

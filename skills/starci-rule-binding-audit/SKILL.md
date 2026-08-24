---
name: starci-rule-binding-audit
description: "Use to audit whether declared rules have one accountable executable binding. Do not use to repair source, inventory readiness, diagnose a workflow, or repay debt."
---

# starci-rule-binding-audit

Use to audit whether declared rules have one accountable executable binding. Do not use to repair source, inventory readiness, diagnose a workflow, or repay debt.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `bindings`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. Stop at waits for the exact displayed revision and finish only at a terminal. Purge all intermediates at every terminal while preserving approved durable mutations.

## CONTEXT CONTRACT

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `diagnosis or inventory` | declared command fingerprints, cached green receipts and exact failing evidence | unrelated source, broad Qdrant and speculative fixes |
| `approval` | one finding/debt identity, baseline, boundary and approval hash | source bodies and other findings |
| `repair` | only approved exact files and narrow repair law | scope expansion, unrelated findings and whole-repository scans |
| `verification + loop` | independent proof, prior fingerprint, loop counter and residual identity | stale observations and reloaded unrelated context |

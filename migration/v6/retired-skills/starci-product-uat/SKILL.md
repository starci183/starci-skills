---
name: starci-product-uat
description: "Compile the smallest complete product-decision coverage, predeclare each case and fixture, execute one case at a time on the visible Browser with a fresh isolated account when applicable, issue independent Behavior, UX and UI verdicts from frozen evidence, and close only after recovery, read-only verification, root repair, fresh retest, zero SUSPENSE, and user approval."
---

# starci-product-uat

Compile the smallest complete product-decision coverage, predeclare each case and fixture, execute one case at a time on the visible Browser with a fresh isolated account when applicable, issue independent Behavior, UX and UI verdicts from frozen evidence, and close only after recovery, read-only verification, root repair, fresh retest, zero SUSPENSE, and user approval.

## INPUT ANALYSIS

Require the ephemeral global selection, read `input.md`, validate `input.schema.json`, then follow local `analyze-input.md`. This skill owns one flow with fixed first state `coverage`; local analysis only validates and normalizes scope without loading operator knowledge.

## STATE MACHINE

Execute `machine.json` through `execute.md`. Branches and loops are machine-owned; operators never invoke one another. An omitted `selection.mode` is `gated`: stop at waits for the exact displayed revision. With explicit `selection.mode=bypass`, bind the displayed revision to an ephemeral bypass-authorization receipt and continue only to the wait state's declared `approval.bypassTarget`. Finish only at a terminal and purge all intermediates while preserving authorized durable mutations.

## CONTEXT INTERFACE

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| `coverage` | one feature index, its product-level decision branches, the selected approved flow graph, lower-level proof receipts, merge signatures and resource claims | source repair, business invention, component-state case inflation and screenshot verdicts |
| `case execution` | one predeclared case identity at a time, fresh account when applicable, isolated browser/runtime identity, exact fixture namespace and immutable checkpoint evidence | parallel visible-browser cases, undeclared accounts, account reuse, unscoped cleanup and post-journey outcome mutation |
| `verdict` | Behavior, UX or UI evidence owned by the current lens | borrowing another lens verdict or treating absence of failure as proof |
| `retest` | discovering checkpoint, full recovery path, all occurrences and canonical happy smoke | overwriting prior runs or closing user feedback without fresh evidence |

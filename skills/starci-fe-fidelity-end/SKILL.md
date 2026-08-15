---
name: starci-fe-fidelity-end
description: End-pass an open StarCi frontend fidelity session without closing it. Re-run the frozen proof, summarize every correction, scan bounded related bugs, and append the session evidence. Feedback may still resume the same session; starci-fe-fidelity-finality is the only closer.
---

# StarCi FE Fidelity End

Read [`../../skill-shape.md`](../../skill-shape.md) first.

## CONTEXT

Present the context table under the exact heading `### CONTEXT`.

Require a user-declared `Project` or explicit `Frontend` and `Backend`; never infer targets from the
open record alone. Confirm they match the session before continuing.

Require the open fidelity workflow and its `Session id`. Resolve the same Project, Frontend,
Backend, comparison identity and authorized `Touching` recorded by Start. Append `## end` with
`Session status: open`; End never silently re-freezes evidence or expands the write boundary.

## PROCESS

Re-run the before/after comparison for every touched state. Confirm the current diff contains only
the recorded boundary, then run typecheck, lint, focused tests and build required by the correction.
An uncaptured visual state stays owed; green tests do not replace render evidence.

Write a session summary that maps each feedback item to its correction and proof. Do not collapse
multiple feedback entries into a final claim that loses their order or reason.

### Related-bug scan

Search the touched owner, its sibling states and direct call sites for the same defect mechanism.
Append an exact `### RELATED BUGS` table:

| Finding | Evidence | Classification | Route |
|---|---|---|---|
| the related issue or `None` | source/render/test evidence | `same-boundary`, `new-boundary`, or `not-a-bug` | immediate feedback correction, owning capability, or `None` |

A `same-boundary` finding is appended as feedback and corrected immediately before End is rerun. A
`new-boundary` finding is routed and recorded; it is not silently added to production scope.

End does not close the session. New feedback after End appends to the same `Session id`, returns to
`$starci-fe-fidelity-start` for immediate correction, and then runs End again.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`,
`### REJECTED` and `### OWED`, in that order.

`OUTPUTS` names the end-pass result and related-bug verdict. `CHANGES` lists every workflow,
production and evidence path in the session diff. Invite `$starci-fe-fidelity-finality` only when
proof is complete and the user wants the session closed.

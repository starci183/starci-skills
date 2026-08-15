---
name: starci-fe-fidelity-finality
description: Finalize and close one ended StarCi frontend fidelity session. Verify the last End evidence, classify every owed item, append the final closure record, and require later work to open a linked continuation session. Writes no new production correction.
---

# StarCi FE Fidelity Finality

Read [`../../skill-shape.md`](../../skill-shape.md) first.

## CONTEXT

Present the context table under the exact heading `### CONTEXT`.

Require a user-declared `Project` or explicit `Frontend` and `Backend`; never infer targets from the
open record alone. Confirm they match the session before closing it.

Require an open fidelity `Session id` with a completed `## end`, its frozen comparison, complete
diff and related-bug scan. Append `## finality` with the same context and
`Session status: finalized`. `Touching` is the workflow record and final evidence only; Finality
writes no new production correction.

## PROCESS

Verify that the latest End still matches the worktree and runtime state. Every feedback entry must
have a correction/proof, an explicit rejection, or an `OWED` route. Every related bug must be
classified. Do not call a session finalized while an approval is pending or an in-boundary proof is
missing; return to Start or End inside the same open session instead.

Write:

- `Session finalized: <session-id>`;
- the final baseline-to-worktree diff identity;
- accepted, rejected and owed outcomes;
- final proof commands and render evidence;
- continuation rule for later feedback.

After Finality, never append feedback, End or another Finality to that session id. New work opens a
new Start session and records `Continuation of: <finalized-session-id>`.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`,
`### REJECTED` and `### OWED`, in that order.

`OUTPUTS` names the restored result and closure identity. `CHANGES` lists the final session tree.
Nothing is invited after this skill; a later request starts a linked session.

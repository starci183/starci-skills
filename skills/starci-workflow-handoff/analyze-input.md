# Analyze starci-workflow-handoff input

Global `@selection` has already selected this one-flow skill from prompt intent. Before any operator or Qdrant retrieval, validate the invocation and verify `selection.skillId` equals `starci-workflow-handoff`. Then perform these local checks:

1. Resolve the exact mission-owned project-role routes and reject adjacent checkouts.
2. Require explicit authority before creating commits, branches, tags, pushes, checkouts or worktrees.
3. Persist only Git heads, the next capability and durable artifact references; never persist prompts, reasoning, loaded context, credentials or session scratch.
4. On resume, verify the checkpoint tag, every repository identity and exact head before emitting the next capability.

Reject stale or missing authority/evidence, an ambiguous target, a write root outside scope, external mutation without approval, or an option outside the closed schema. Do not reconsider other skills here; return to global analysis if selection is wrong.

The fixed first state is `route`. Emit only normalized scope and facts as task-session data; do not choose a second mode or copy operator knowledge into context.

## Options

| Option | Values | Decision effect |
| --- | --- | --- |
| `mode` | `publish` / `resume` | Publish a portable Git checkpoint or adopt one on the current device. |

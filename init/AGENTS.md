# StarCi agent bootstrap

<!-- starci:prompt-entry -->
Before planning, reading target source, or running a skill, read
[`<Source>/.claude/CONTEXT.md`](.claude/CONTEXT.md) and follow its load order — the runtime tree is canonical source that `node` reads directly.

Project lifecycle entry points are skills: `define-goal` (owner prompt → durable goal + op chain
queued in `.starciwork/runtime.sqlite`) and `start-kernel` (claim a queued goal → boot its
long-lived `[Kernel]` agent).

`<Source>` is the single host repository that owns this bootstrap and the `.claude` runtime. A routed
repository checkout or Git worktree follows that Source; do not rebind `<Source>` to it or expect it to
contain another `.claude/CONTEXT.md`. The sibling `.workspaces/projects/<project>/work.json`
binds target repositories and the project-owned `.starciwork`; use that mapping for both FE and BE.

Carry the resolved host, project binding and project skill path when delegating work or changing
directories. A task opened outside the host must receive that context explicitly.
This file locates the runtime; workflow selection, goal confirmation and evidence rules live there.
<!-- /starci:prompt-entry -->

# StarCi agent bootstrap

<!-- starci:prompt-entry -->
Before planning, reading target source, or running a skill, read
[`<Source>/.claude/CONTEXT.md`](.claude/CONTEXT.md) and follow its load order — the runtime tree is canonical source that `node` reads directly.

The one public StarCi entry is `/starci` (`.claude/skills/starci/SKILL.md`). Explicit invocation loads
the selected runtime procedure; it does not approve queueing or starting a workflow. A plain request
follows ordinary repository instructions and does not enroll into StarCi from workflow keywords.
New StarCi goals require read-only context assessment, the exact draft and derived operation plan,
and the owner's OK before queue or start effects. Unchanged accepted scope proceeds under its
recorded approval. Native jobs and explicitly authorized CLI actions retain their role contracts.

`<Source>` is the single host repository that owns this bootstrap and the `.claude` runtime. A routed
repository checkout or Git worktree follows that Source; do not rebind `<Source>` to it or expect it to
contain another `.claude/CONTEXT.md`. The sibling `.workspaces/projects/<project>/work.json`
binds target repositories and the project-owned `.starciwork`; use that mapping for both FE and BE.

Carry the resolved host, project binding and StarCi entry path when delegating work or changing
directories. A task opened outside the host must receive that context explicitly.
This file locates the runtime; workflow selection, goal confirmation and evidence rules live there.
<!-- /starci:prompt-entry -->

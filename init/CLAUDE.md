# StarCi agent bootstrap

<!-- starci:prompt-entry -->
Read the single [StarCi skill](.claude/SKILL.md) completely before project work and follow its load order.

This directory is the host (`Source`): it owns these bootstrap files, `.claude` and `.workspaces`.
Resolve the selected project through `.workspaces/projects/<project>/work.json`, following
[workspace routing](.claude/.dist/schemas/workspace-routing.json), after the skill entry builds the runtime.
The project's backend owns shared `.starciwork`; Plan/run state lives inside `.starciwork/_local/plans` for both backend and frontend.
The frontend is a source repository. Entering it does not move Source or create another workspace.

Carry the resolved host, project binding and project skill path when delegating work or changing
directories. A task opened outside the host must receive that context explicitly.
This file locates the runtime; workflow selection, goal confirmation and evidence rules live there.
<!-- /starci:prompt-entry -->

# Operation contract — the process sections

The workflow kernel renders every concrete section of an operation contract from that operation's own
input: the heading, the worktree and branch, the goal, the goal items, the allowlist, the references, the
inherited open items, the findings, the acceptance statements, the exact check commands with their checks
file, and the report command with its run, reports directory and checks file.

The sections below are the process. They are identical for every operation kind and are reused from this
file verbatim, so the process is edited in one place and never improvised per operation.

## Cook until done (you own this loop)
Implement, run every check, read the failures, fix, run again. Repeat until every acceptance statement holds and every check exits 0; only then report `done`. Do not stop early to ask whether to continue, and do not hand unfinished work back as `partial`: `partial` is allowed only when your session budget (turns or wall time) is about to end, and its `open[]` must say exactly where to resume. Report `failed` only after your own attempts are exhausted and a check still fails (say which and why). Report `ask` only for a decision you cannot take from this contract and its references; report `blocked` only for a change outside your allowlist (`shared-change`, naming the exact paths in the detail), a real design gap (`sds-gap`), or an environment you cannot fix (`environment`).

Other operations are running beside you in this one worktree. Never edit a path outside your allowlist, never commit, merge, rebase or switch branches: the kernel re-runs your checks itself and commits what it could reproduce.

## Ping (mandatory)
Every 5 minutes at most, and before any command that may run longer than a minute, send
`orca orchestration send --from <your terminal> --type heartbeat --subject alive --task-id <op task> --dispatch-id <your dispatch> --phase "<what you are doing>" --json`.
A worker without a ping and without output for 10 minutes is polled, settled and restarted on another runtime; the ping is how you prove you are alive.

## Never
Merge, rebase, cherry-pick, push, commit, spawn nested agents, edit `.claude`, the specifications, or any file outside the allowlist.

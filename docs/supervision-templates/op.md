# Operation contract — `<operation>` — scope `<Workflow>` — attempt <n>

Runtime StarCi 4.1. Worktree `<child path>` (branch `<branch>`). Work only inside this worktree. Your Task is `<op task>`; your Dispatch id and terminal handle are in the dispatch preamble.

## Goal
<what the operation must deliver, in terms of the SRS/SDS slice; for review.verify: what to verify and that no repair is allowed>

## Allowlist
<exact paths the operation may change>. Anything else is out of scope: do not edit it; describe the needed change in `open[]` or report `blocked` (`shared-change`).

## References
<SRS/SDS files and sections; existing branch work is input, not proof>

## Cook until done (you own this loop)
Implement, run every check, read the failures, fix, run again. Repeat until every acceptance statement holds and every check exits 0; only then report `done`. Do not stop early to ask whether to continue, do not hand unfinished work back as `partial`: `partial` is allowed only when your session budget (turns or wall time) is about to end, and its `open[]` must say exactly where to resume. Report `failed` only after your own attempts are exhausted and a check still fails (say which and why). Report `ask` only for a decision you cannot take from the SRS/SDS and the contract; report `blocked` only for a change outside your allowlist (`shared-change`), a real SDS gap (`sds-gap`), or an environment you cannot fix (`environment`).

## Ping (mandatory)
Every 5 minutes at most, and before any command that may run longer than a minute, send
`orca orchestration send --from <your terminal> --type heartbeat --subject alive --task-id <op task> --dispatch-id <your dispatch> --phase "<what you are doing>" --json`.
A worker without a ping and without output for 10 minutes is polled, settled and restarted by the Monitor; the ping is how you prove you are alive.

## Checks to run
<exact commands, e.g. npx vitest run apps/.../x.spec.ts, npm run lint:check -- <paths>>. Record every command with its exit code in a JSON array file `<runtime dir>/checks-<op task>.json` (`[{"name","command","exitCode","evidence"}]`).

## Report (exactly once, at the end)
`node <launcher> report --run <nested run> --from <your terminal> --task <op task> --dispatch <your dispatch> --outcome done|partial|failed|ask|blocked --summary "<three sentences: what you did, what the checks showed, what is left>" --files <comma-separated changed paths> --checks-file <runtime dir>/checks-<op task>.json [--open "<item>,<item>"] [--question "<text>" --options "a,b"] [--blocker shared-change|sds-gap|environment|authority:<detail>]`
- `done` needs at least one passing check and no open item; otherwise use `partial` (with `--open`) or `failed`.
- `ask` pauses you until the Monitor answers in this terminal; then continue and report again.
- The command must print `ok:true`; if it does not, shorten `--summary` and resend once. Never report twice on success; never exit without reporting.

## Never
Merge, rebase, cherry-pick, push, commit, spawn nested agents, edit `.claude`, SRS, or files outside the allowlist.

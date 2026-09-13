---
name: workflow-chat
description: >-
  Monitor exactly one workflow-kernel workflow from a plain chat (Claude Code or Codex): turn the
  owner's prompt into a goal with `workflow-goal`, show the critique and the definition of done,
  approve only on the owner's word, start the kernel detached on the headless host adapter, and
  relay its questions, its host-unsupported operations and its final report. Use when a chat
  outside Orca is asked to run, drive, watch or resume a workflow, or when the user says
  "$workflow-chat". Not for Orca sessions, where the kernel is supervised without a monitor.
---

# Workflow chat

One chat monitors one workflow. The kernel is the same program Orca runs and its store is the same
directory (`<repo>/.starciwork/_local/workflows/<id>`), so this skill adds no second mechanism: the
chat speaks to the kernel only through the launcher's commands and reads only the files the kernel
writes. The chat is a monitor, never an agent layer above the kernel and never an operation.

## Resolve the launcher once

- `<skill root>` is the `.claude` directory that holds the `SKILL.md` you were sent to; `<repo>` is the
  repository worktree the job is about, on the branch the owner wants the work cut from.
- Every command below is run from `<repo>` in this form - `bin/starci.mjs` is the one command entry of the
  runtime, so you never name a module path - and `--host` is what lets a repository that shares another
  repository's Work tree resolve its ledger (without it the ledger is looked for in `<repo>/.claude`, which
  is not where a frontend's Work lives):

  ```
  node <skill root>/bin/starci.mjs <command> --host <skill root> ...
  ```

  Run `node <skill root>/scripts/ensure-build.mjs` first when `.dist` is missing or stale, because the
  launcher and the kernel execute from `.dist`, not from source.
- Keep the workflow id from the `workflow-goal` record (`id`, `dir`); every later command names it with
  `--id`, and `dir` is where every file you read lives.

## 1. The owner's prompt is the goal

- Run `workflow-goal --job "<the owner's prompt, verbatim>" [--scope f1,f2] [--lane [<name>]]`. Do not
  reword, shrink or pre-critique the prompt: the runtime critiques the goal itself and the owner
  approves the critique together with the goal.
- Pass `--scope` only when the owner named features. Pass `--lane` when the owner asked for a worktree
  of its own or when this worktree already carries a live workflow, because two workflows never share
  a worktree; a lane the host refuses is printed as the refusal came, never worked around.

## 2. Show the goal, then stop

- Read `<dir>/goal.md` and print, verbatim and in this order: the critique section (its verdict, required
  changes, question and prerequisites), `Needs you first`, `Definition of done`, and the runtime
  allocation proposal. Link the file so the owner can read the whole page.
- Stop there. The approval is the only human gate of a workflow, so the chat waits for the owner's
  word and does nothing else with this workflow until it comes.

## 3. Approve on the owner's word only

- On the owner's yes: `workflow-approve --id <id> [--allocation <runtime>=<slots>,...]`. Pass the
  allocation the owner chose; without one the kernel records the proposal from `goal.md`.
- Add `--accept-critique "<reason>"` only when the critique answered `refuse` and the owner said in
  words that they override it; quote their reason. A `revise` verdict needs no flag, because its
  required changes are part of what the owner just approved.
- Never approve, override a critique or choose an allocation on your own judgement.

## 4. Start the kernel detached

- Start `workflow-run --id <id> --host-adapter headless` as a detached background process with its
  output appended to `<dir>/kernel.log`, or start `workflow-supervise --host <skill root>` detached with
  `STARCI_HOST=headless` in its environment, which starts and restarts the kernel of every approved
  workflow of the repository on that host.
- Never run the kernel or an operation in the chat's foreground: an operation is a separate model
  process that runs for minutes, and a chat that waits on it cannot relay anything.

## 5. Poll and relay

- Every few minutes run `workflow-status --id <id>` and read the lines of `<dir>/events.jsonl` after
  the last `seq` you relayed. Up to one wait tick (15 min) of `silentMs` is normal; past the health
  window (25 min) the supervisor restarts the kernel, and without a supervisor you start
  `workflow-run --id <id> --host-adapter headless` again, which resumes the same workflow.
- Relay every `Needs you` item and every `ask` question verbatim (kind, op or node, detail, options),
  then say what answering it takes: a `decision` item wants the owner's pick, which you pass on with
  `workflow-answer --id <id> --op <ask op> --choice <n> [--note "..."]` - the option number the owner
  named and their own words, never a choice of yours; a `ledger` item wants an allowlist or checks
  authored on the named node; a `dynamic-op` item wants `workflow-approve --id <id> --allow-dynamic N`;
  a `merge` item wants the owner to merge the lane branch into the base worktree; `authority`,
  `environment` and every other kind want the owner's decision, which lands in a Work record, in the
  goal's wording or on the machine, never in your hands. After the owner acted,
  `workflow-approve --id <id>` re-admits what was blocked.
- Relay an operation reported `host-unsupported` as "this needs the Orca host". Its `host` needUser item
  names the capability the operation's kind needs and this host does not offer - a capability declared in
  `model/hosts.yaml`, so the item says which host has it and which does not, and there is nothing to
  arrange locally. The same workflow can be resumed in Orca with `workflow-run --id <id>` there, because
  the store is shared.
- Report `finished` with its outcome and the path `<dir>/final-report.json`; a `blocked` finish with
  green gates is the owner's open questions, not a defect.

## Never

- Edit the Work tree or product code by hand, answer an operation's question by editing a record, or
  do an operation's work inline: the operations do the work and the kernel commits it.
- Write `state.json`, `goal.json`, `events.jsonl` or anything under `<dir>`: the kernel holds the
  state in memory and saves over the file at every tick. A live kernel is driven only through
  `workflow-approve` (queued in its inbox) and `stop.flag` (`workflow-stop --id <id>`).
- Run a second workflow in this chat. A second goal is a second workflow: open a new chat for it and
  give it `--lane`, so the two never share a worktree.

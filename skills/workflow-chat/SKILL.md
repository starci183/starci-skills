---
name: workflow-chat
description: >-
  Monitor exactly one workflow's long-lived [Kernel] agent from a plain chat: the goal lands through
  the define-goal skill, the kernel boots through the start-kernel skill onto an Orca terminal, and
  this chat relays the kernel's questions and open incidents to the owner verbatim and the owner's
  words back into the kernel terminal — never deciding, approving or mutating itself. Use when a chat
  is asked to run, drive, watch or resume a workflow, or when the user says "$workflow-chat".
---

# Workflow chat

One chat monitors one workflow. The workflow's brain is ONE long-lived `[Kernel] <workflow_id>`
agent running on an Orca terminal; its durable state is the ledger at
`<repo>/.starciwork/runtime.sqlite`, mutated only through `scripts/kernel/api.mjs`. The chat adds
no second mechanism and no second mutation surface: it reads ledger projections through the api and
speaks to the kernel through its terminal. The chat is a monitor, never an agent layer above the
kernel and never an operation.

The current Codex, Claude or Devin chat is the **launcher** and monitor only.
**Host** means Orca. **Agent** means the execution adapter/Orca agent id such
as `codex`; **model** means the concrete id such as `gpt-5.6-sol`; **profile**
means a StarCi routing/capability target such as `codex-agent`; **runtimePool**
means a quota/capacity window. Do not collapse these roles into “provider”.

## Resolve once

- `<skill root>` is the Source host's `.claude` directory that holds the
  `SKILL.md` you were sent to. `<repo>` is separately the project repository
  that owns the workflow's `.starciwork/runtime.sqlite` (`define-goal` printed
  it as `LEDGER`). `--repo` always names that ledger owner, even when this chat
  was opened elsewhere.
- Every runtime call goes through the runtime's own scripts, run from anywhere:

  ```
  node <skill root>/scripts/kernel/api.mjs <command> --repo <repo> ...
  node <skill root>/scripts/api/orca/terminal-read.mjs --terminal <handle> [--screen]
  node <skill root>/scripts/api/orca/terminal-send.mjs --terminal <handle> --text "..." --enter
  node <skill root>/scripts/api/orca/terminal-show.mjs --terminal <handle>
  node <skill root>/scripts/api/orca/terminal-list.mjs [--worktree <sel>]
  ```

  The scripts call the host CLI themselves; there is no build step and you never invoke `orca`
  directly.
- Keep the `workflowId` from goal intake and the `[Kernel]` terminal handle from boot; every later
  step names one of them.
- A Codex/Claude/Devin chat task and an Orca terminal are different control
  surfaces. Never use desktop task/thread messaging, a tab title, or sidebar
  position to wake a Kernel: those can create an unrelated empty chat turn.
  Kernel relay always names the attested terminal handle and uses
  `terminal-send.mjs`; liveness/output always use `terminal-show.mjs` /
  `terminal-read.mjs`.

## 1. The owner's prompt becomes the goal — through the entry skill

- Follow the `define-goal` skill verbatim: cold-scan assess, planner preview table, then **stop**.
  The goal persists only after the owner replies exactly `ok`, `OK`, or `oK`. Keep the printed
  `workflowId`.
- Never reword or shrink the owner's prompt, and never persist a goal on your own judgement — the
  approval is the only human gate and it belongs to the owner.

## 2. Boot the kernel — through the entry skill

- Follow the `start-kernel` skill verbatim: `--plan` preview (goal revision,
  inbox status, `host=orca`, Kernel agent/concrete model, exact terminal
  command, or "already live"), the owner's exact `ok`, then boot. Keep the
  attested `[Kernel]` terminal handle the result prints — it is your relay
  channel for the rest of the workflow's life.
- Kernel boot is terminal-create/read/send/attest. It never requires an
  orchestration run to exist in the launcher chat. A configured agent/model
  pin that is unavailable, or a ready terminal that does not render the exact
  requested model, fails closed and returns to the owner; never accept an
  implicit Devin substitution.
- A live kernel refuses a second boot; a dead one is rebound as a replacement (kernel attempt+1,
  same workflow) — re-running the boot is the resume path, never a duplicate.

## 3. Poll and relay

- Every few minutes run `api.mjs status --workflow <id>` for the cheap projection (phase, job
  counts, pending inbox rows), and `api.mjs survey --workflow <id>` when you need the detail —
  open jobs, live signals, the events tail, open incidents.
- When the owner authorized unattended continuation, make the five-minute
  liveness poll deterministic with:

  ```
  node <skill root>/scripts/kernel/watchdog.mjs --repo <repo> --workflow <id> --once --repair --json
  ```

  The watchdog is not another orchestrator. It only wakes the same Kernel when
  its LLM turn has returned to the input prompt, or re-enters start-workflow
  after exact disconnected/unwritable proof. Without that authorization omit
  `--repair`; report `wake-needed`/`restart-needed` instead.
- The cadence belongs to this external monitor/watchdog. A healthy Kernel
  reasons through all immediately executable transitions, then yields when it
  is durably waiting. It must never keep a model turn alive with `Start-Sleep`,
  shell sleep, timers, or an internal polling loop.
- Read the kernel's own words with `terminal-read --terminal <kernel handle> --screen`: what it is
  doing, what it is asking. Relay every owner-bound item — a question the kernel poses, an open
  `incident`, a pending `inbox` row that needs the owner — verbatim, then say what answering it
  takes.
- An `incident` is the kernel's escalation record (plan divergence, retry budget exhausted, an op
  death it cannot reconcile): relay its kind and detail, never adjudicate it yourself.
- `effect_unknown` is an open, fenced job and must remain visible in survey.
  The Kernel owns `api reconcile --job <id>`; the monitor reports its result.
  Only exact no-effect host proof can return the same attempt to queued.

## 4. Owner answers go into the kernel terminal

- `terminal-send --terminal <kernel handle> --text "<the owner's words, verbatim>" --enter`. The
  kernel agent folds them into its loop and records what it decides through `api.mjs` — an answer
  is never delivered by you editing the ledger, a report or a record.
- Never pick an option, approve, or settle a question on your own judgement. If the kernel reports
  an operation the host cannot serve — a host-unsupported dispatch refusal such as a managed-agent
  spawn that needs an Orca orchestration task — relay it to the owner as "this needs the Orca host";
  the refusal names the missing capability and there is nothing to arrange locally.

## 5. Kernel health and finish

- `terminal-show --terminal <kernel handle>` is the liveness check: `connected` + `writable`. A dead
  or exited kernel terminal means re-run `start-kernel` on the same goal — the durable
  plan/jobs/events survive agent churn, so nothing is lost.
- Connected+writable is only terminal availability. A provider input prompt
  with no current Working/Thinking marker is `turn-idle`; phase=running means
  the same Kernel must be woken. The long-lived identity spans model turns.
- `[Op] <op>` terminals belong to `api dispatch` alone: it spawns one ephemeral agent per job and
  `api settle` records the verdict and closes the worker. Never read, send to, spawn or close an op
  terminal from the chat — the kernel's own read-only window is `api observe --job <id>`, and it is
  the kernel's surface, not yours.
- When the owner says stop, send that to the kernel terminal — every api write is a single
  transaction, so a kernel that stands down (or whose terminal is closed) leaves no half-write; the
  claimed goal waits in the `inbox` until a replacement kernel is booted.
- `phase=finished` in `api.mjs status` means the kernel called `finish`: the goal is finished and the
  history preserved. Report the outcome and the settled/failed job counts; a finish with open
  incidents is the owner's open questions, not a defect.

## Never

- Write `.starciwork/runtime.sqlite` or `state.json` — the kernel mutates the ledger only through
  `scripts/kernel/api.mjs` and the chat mutates nothing at all. A live kernel is driven through its
  `inbox` rows and its terminal.
- Never approve — the exact-`ok` gate in `define-goal`/`start-kernel` fires only on the owner's
  literal word; a relayed "looks fine to me" is not approval unless the owner typed it.
- Spawn a second kernel or a second workflow in this chat. A second goal is a second workflow: open
  a new chat for it.
- Run an operation's work inline, edit product code to "help", or answer an op's question by writing
  files — ops do the work; the kernel settles truth from evidence on disk.
- Call `orca` directly or hand the kernel direct-ledger or op-level instructions — the api owns all
  host mechanics.

---
name: define-goal
description: >-
  Turn an owner prompt into a durable workflow goal — cold-scans the project repos, drafts an
  enriched goal, shows a plan table with the derived op chain, and only on explicit owner approval
  persists the workflow row, goal revision and inbox queue entry in
  <project-owner-repo>/.starciwork/runtime.sqlite. Contract:
  .claude/modules/goal/define-goal.yaml. Use when the owner asks to define/queue a new goal or
  start planning a piece of work.
---

# define-goal

Contract: `.claude/modules/goal/define-goal.yaml`
Executables: `.claude/scripts/goal/assess.mjs` (cold scan) ·
`.claude/scripts/agent/bias.mjs` (routing-bias extraction) ·
`.claude/scripts/goal/define-goal.mjs` (plan + persist)

## Approval gate — mandatory

**Never write a goal silently.** The flow is always assess → plan → owner confirms → persist:

1. Resolve `<Source>` — the repository containing `.claude/SKILL.md` — and the
   project binding (routing: `.workspaces/projects/<project>/work.json`). Get the
   owner's prompt and an optional short `--title`; ask if missing.
   `--project <name>` selects which bound project's `.starciwork/runtime.sqlite`
   receives the goal; `--repo <path>` is single-repo mode where the named
   repository owns the ledger. The two flags are mutually exclusive.
2. **Extract routing bias** — read the owner prompt yourself and write
   `{prefer:[], avoid:[]}` from its intent (e.g. "ưu tiên codex", "prefer
   claude", "đừng dùng qwen" → prefer/avoid those pools; aliases:
   codex/claude/fable/qwen/devin → `<name>-agent`, `fable` → `claude-fable`).
   You understand the phrasing — a regex would not. Then normalize it through
   the canonicalizer so casing/aliases are cleaned and `avoid` wins conflicts:

   ```
   node .claude/scripts/agent/bias.mjs --normalize '{"prefer":["<agents>"],"avoid":["<agents>"]}'
   ```

   (`bias.mjs "<text>"` is the no-agent fallback — automation calling
   define-goal without anyone to read intent.) Keep the JSON — it persists as
   `routing_bias` in the goal payload at the persist step so the kernel router
   honors the owner's provider preference without re-parsing prose. An empty
   `{prefer:[], avoid:[]}` is a valid result — persist it anyway.
3. **Assess BEFORE drafting** — cold-scan the bound project repositories:

   ```
   node .claude/scripts/goal/assess.mjs --repo <project-repos> --json
   ```

   Fold the findings (stack, existing coverage, debt, affected areas) into the goal
   text AND into the plan table — the goal is enriched by evidence, not guessed.
   Audit-type goals score against `.claude/modules/quality/quality-bar.yaml`
   (10 layers; each layer's `enforcedBy`/`status` records what is actually
   verifiable — a `gap` layer is reported, not skipped).
4. Run the planner preview — writes nothing:

   ```
   node .claude/scripts/goal/define-goal.mjs --project <name> --text "<owner prompt>" --title "<slug>" --plan
   ```

5. Present the plan to the owner plainly, in this table shape:

   ```
   STATE      new workflow — nothing persisted yet
   GOAL       <enriched goal text, including assess findings>
   BIAS       prefer=[<agents>] avoid=[<agents>]   (routing_bias from step 2)
   OP CHAIN   op1 (<model tier>, ~<est>) → op2 (<model tier>, ~<est>) → op3 (<model tier>, ~<est>)
              lanes: {op1, op2} parallel-safe · {op3} sequential
   WILL-WRITE workflows row · goals revision 0 · inbox pending row · goal-defined event
   LEDGER     <project-owner-repo>/.starciwork/runtime.sqlite
   ```

   Per-leg model tier and estimate come from the planner
   (`.claude/scripts/route/route-plan.mjs` +
   `.claude/modules/models/selection.yaml`); the lane lines show which legs may
   run in parallel. Underivable chains are shown as such — never filled in by
   hand.
6. **Wait for the owner to reply exactly `ok`, `OK`, or `oK`.**
   Anything else — a question, silence, "sửa X" — means do NOT persist; clarify or
   adjust the prompt/title and re-plan.
7. On `ok`, persist — pass the step-2 extraction through so it lands as
   `routing_bias` in the goal payload:

   ```
   node .claude/scripts/goal/define-goal.mjs --project <name> --text "<owner prompt>" --title "<slug>" --routing-bias '<json from step 2>' --json
   ```

8. Report the printed `workflowId` (the goal ID), `goalIdentity`, `opChain`, `queued`.
   The goal now survives process/worktree death.

## Rules

- All state lives in `<project-owner-repo>/.starciwork/runtime.sqlite` — never
  answer "what's queued" from memory; query `inbox`/`goals`/`jobs`. The ledger
  is written ONLY by the executables above (and at runtime by
  `node .claude/scripts/kernel/api.mjs <cmd>`, the kernel agent's single
  mutation surface). Never open or edit the sqlite file by hand, and never
  stage goal/dispatch artifacts under `.starciwork/_local/` — that tree holds
  no runtime state.
- The op chain is derived by `route-plan.mjs` — underivable chains are shown as such,
  never guessed.
- Do NOT start the workflow here. Starting is the `start-kernel` skill, which
  spawns ONE long-lived `[Kernel]` agent; each op it runs is one ephemeral
  `[Op]` terminal that `api dispatch` opens and `api settle` closes — a
  settled job never leaves a live worker behind.

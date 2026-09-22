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

You are the owner's chat. This skill is how you turn the owner's prompt into a
durable goal in the ledger, and the owner's exact `ok` is the only thing that
lets you persist it.

Contract: `.claude/modules/goal/define-goal.yaml`
Executables: `.claude/scripts/goal/assess.mjs` (cold scan) ·
`.claude/scripts/agent/bias.mjs` (routing-bias extraction) ·
`.claude/scripts/goal/define-goal.mjs` (plan + persist)

## Approval gate — mandatory

**Never write a goal silently.** The flow is always assess → plan → owner confirms → persist:

1. Resolve `<Source>` — the repository containing `.claude/CONTEXT.md` — and the
   project binding (routing: `.workspaces/projects/<project>/work.json`). Get the
   owner's prompt and an optional short `--title`; ask if missing.
   `--project <name>` selects which bound project's `.starciwork/runtime.sqlite`
   receives the goal; `--repo <path>` is single-repo mode where the named
   repository owns the ledger. The two flags are mutually exclusive.
2. **Extract routing bias** — read the owner prompt yourself and write
   `{prefer:[], avoid:[]}` from its intent (e.g. "prefer codex", "use claude",
   "don't use qwen" → prefer/avoid those pools, in whatever language the owner
   wrote it; aliases: codex/claude/qwen/devin → `<name>-agent`).
   You understand the phrasing — a regex would not. Then normalize it through
   the canonicalizer so casing/aliases are cleaned and `avoid` wins conflicts:

   ```
   node .claude/scripts/agent/bias.mjs --normalize '{"prefer":["<agents>"],"avoid":["<agents>"]}'
   ```

   (`bias.mjs "<text>"` is the no-agent fallback — automation calling
   define-goal without anyone to read intent.) Keep the JSON — it persists as
   `routing_bias` in the goal payload at the persist step so the kernel router
   honors the owner's agent preference without re-parsing prose. An empty
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

5. Show the owner what `--plan` printed, under the labels it prints:

   ```
   PLAN — goal "<title>"
     identity: <goalIdentity>
     scope: <project or repo>
   STATE (cold scan):
     <role>  <path>  — <assess line>
   GOAL:
     <enriched goal text, including assess findings>
   OP CHAIN (estimate is cold: easy=…m medium=…m hard=…m):
     1. <op>  ~<est>m <tier>
     total ~<n>m — estimate is cold
   CONFIG: <config.yaml path> — kernel group <agent>/<model> → … effort=…   (or: kernel pin agent=… model=… effort=…)
   WILL WRITE:
     - <row>
   ledger: <project-owner-repo>/.starciwork/runtime.sqlite
   re-run without --plan to persist
   ```

   Add the step-2 bias (`prefer=[…] avoid=[…]`) in your own words — the planner
   does not print it. Per-leg estimate and tier come from the planner
   (`.claude/scripts/route/route-plan.mjs` +
   `.claude/modules/models/selection.yaml`). An underivable chain prints as
   `underivable (kernel will derive at boot)` — never fill it in by hand.
6. **Wait for the owner to reply exactly `ok`, `OK`, or `oK`.**
   Anything else — a question, silence, an edit request — means do NOT persist;
   clarify or adjust the prompt/title and re-plan.
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
  mutation surface). Never open or edit the sqlite file by hand.
- The op chain is derived by `route-plan.mjs` — underivable chains are shown as such,
  never guessed.
- Do NOT start the workflow here. Starting is the `start-kernel` skill, which
  spawns ONE long-lived `[Kernel]` agent; each op it runs is one ephemeral
  `[Op]` terminal that `api dispatch` opens and `api settle` closes — a
  settled job never leaves a live worker behind.

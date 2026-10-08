# Define a workflow goal

This internal procedure is selected by an explicit `/starci` request, explicit native selection of the
StarCi entry, or an already-authorized native StarCi job contract. An ordinary chat request does not
select it. Selection grants no approval to write a goal or launch a workflow.

Contract: `.claude/modules/goal/define-goal.yaml`
Executables: `.claude/scripts/goal/assess.mjs` (cold scan) ·
`.claude/scripts/agent/bias.mjs` (routing-bias extraction) ·
`.claude/scripts/goal/define-goal.mjs` (plan + persist)

## Approval gate — mandatory

**Never write a goal silently.** Resolve project, goal, scope and expected outcome first. When these
are unclear, assess read-only and ask for the missing context. Do not invent a goal or treat silence
or a generic instruction to handle matters as approval. The flow is assess → plan → owner confirms
the exact goal and intended actions → persist.

Approval binds the goal identity, content, derived plan and authority. Record its source in the native
`--reason` provenance; this is conversation evidence, not authenticated identity. Reuse an unchanged
accepted approval, including an explicitly approved start in the same plan. A material goal or plan
change needs a new approval. Revisions retain their native content-bound token and exact-`ok` gate.

1. Resolve `<Source>` — the repository containing `.claude/CONTEXT.md` — and the
   project binding (routing: `.workspaces/projects/<project>/work.json`). Get the
   owner's prompt and an optional short `--title`; ask if missing. Propose a
   human name for the workflow in Vietnamese, `<Product> · <what it does>`, at
   most 48 characters (e.g. `Nivo · Sign-in & authentication`), and pass it as
   `--display-name`; without one the planner derives it from the goal text and
   the product name (it shows as `name:`). The name is a label only — the
   `workflowId` stays the key, and `starci kernel rename` changes the name later.
   `--project <name>` selects which bound project's runtime ledger
   receives the goal; `--repo <path>` is single-repo mode where the named
   repository owns the ledger. The two flags are mutually exclusive.
2. **Extract routing bias** — read the owner prompt yourself and write the bias JSON from its
   intent, in whatever language the owner wrote it. The fields are exactly these; any other field is
   refused (`invalid-owner-routing-bias`):
   - `prefer` moves the named members first in their tier chain. Owner: "prefer codex".
     `{"prefer":["codex"]}`
   - `avoid` removes the named members from the chain. Owner: "don't use devin".
     `{"avoid":["devin"]}`
   - `only` keeps just the named members of the tier chain and drops every other member; it is the
     way to state a requirement. Owner: "must use Claude Opus".
     `{"only":["claude/claude-opus-5-5"]}`. When no named member is left in a chain the request
     is refused `bias-empties-chain` and the picker never drops the bias itself.
   - `roles` lists the affected actors (`kernel`, `op`, `supervisor`, `worker`, `critic`), e.g.
     `{"prefer":["codex"],"roles":["kernel","op"]}`; without it the bias applies only to `op`.
     A constraint on an Op does not silently pin its Critic.
   - `reserveOverride`, described below.

   A member is written as `<agent>` (codex, claude, devin: the whole provider pool,
   normalized to `<agent>-agent`), `<agent>/<model>` (one member), or a selector object
   `{"pool":…,"provider":…,"model":…}` naming at least one of the three. "Prefer" is a soft
   ranking; "must", "only" and "nothing but" are `only`. Questions or hypothetical examples are
   not routing instructions.

   An `only` does not authorize using the provider reserve. Only an explicit owner
   instruction to exceed the internal reserve for a specific attempt can supply
   `reserveOverride:{authorized:true,scopeId,role,provider,model,reason}` (and optional
   `account`). Never invent that permission, infer it from "must use" or from an `only`, or use a blanket
   future-task scope. Record the exact owner grant in the goal approval provenance; the
   admission adapter must independently verify it. If the task/attempt identity is not
   known at intake, preserve the owner's intent for its later approval rather than
   manufacturing a runnable override. Auth, provider exhaustion and quality restrictions
   remain in force. Then
   normalize it through the canonicalizer (casing/aliases cleaned, `avoid`
   wins conflicts):

   ```
   starci workflow bias --normalize '{"prefer":["<agents>"],"avoid":["<agents>"],"only":["<agent>/<model>"]}'
   ```

   `starci workflow bias "<text>"` is the no-agent fallback for automation. Keep the JSON:
   it lands as `routing_bias` at the persist step. An empty
   `{prefer:[], avoid:[]}` is valid — persist it anyway.
3. **Assess BEFORE drafting** — cold-scan the bound app (its root, `be/` and `fe/`):

   ```
   starci workflow assess --repo <project-repos> --json
   ```

   Fold the findings (stack, existing coverage, debt, affected areas) into the goal
   text AND into the plan table — the goal is enriched by evidence, not guessed.
4. Run the planner preview — writes nothing:

   ```
   starci workflow define --project <name> --text "<owner prompt>" --title "<slug>" --display-name "<Product> · <what>" --plan
   ```

5. Show the owner what `--plan` printed, under the labels it prints:

   ```
   PLAN — goal "<title>"
     name: <display name>
     identity: <goalIdentity>
     scope: <project or repo>
   STATE (cold scan):
     <role>  <path>  — <assess line>
   GOAL:
     <enriched goal text, including assess findings>
   IMPACT (survey of existing Work): <BUILD|EXTEND|REFERENCE> of <features>   (printed when the project has a Work tree)
     reused (done, not re-planned): <n>  open: <n>  backend records: <n>  frontend records: <n>  other features settled (out of scope): <n>
   OP CHAIN (estimate is cold: easy=…m medium=…m hard=…m):
     1. <op>  ~<est>m <tier>
     total ~<n>m — estimate is cold
   CONFIG: <config.yaml path> — kernel group <agent>/<model> → … effort=…   (or: kernel pin agent=… model=… effort=…)
   WILL WRITE:
     - <row>
   ledger: <runtime root>/.runtime/projects/<ledger_id>/runtime.sqlite
   re-run without --plan to persist
   ```

   The IMPACT line is the planner's survey of the project's `.starciwork` (`route-plan --state`, `modules/goal/existing.yaml`): a goal that names an existing feature is an EXTEND, plans only the delta (done records of other features and specs the feature already settled are not re-planned), and keeps the backend lane when the feature holds backend records.

   Add the step-2 bias (`prefer`, `avoid`, `only`, `roles` and
   any exact-scope owner reserve grant) in your own words — the planner
   does not print it. Per-leg estimate and tier come from the planner
   (`.claude/scripts/route/route-plan.mjs` +
   `.claude/modules/models/selection.yaml`). An underivable chain prints as
   `underivable (kernel will derive at boot)` — never fill it in by hand.
6. **Ask for the owner's OK for this exact draft and operation plan before queue or start effects.**
   Show whether the intended actions include persistence only or persistence followed by workflow
   startup. A question, silence or edit request does not approve it. Re-plan any material edit.
   Reuse recorded approval only when identity, content, plan, scope and authority still match.
7. After that approval, persist — pass the step-2 extraction through so it lands as
   `routing_bias` in the goal payload:

   ```
   starci workflow define --project <name> --text "<owner prompt>" --title "<slug>" --display-name "<Product> · <what>" --routing-bias '<json from step 2>' --reason "<exact owner approval reference>" --json
   ```

8. Report the printed `workflowId` (the goal ID), `goalIdentity`, `opChain`, `queued`.

## Rules

- All state lives in the project's runtime ledger (`<runtime root>/.runtime/projects/<ledger_id>/runtime.sqlite`) — never
  answer "what's queued" from memory; query `inbox`/`goals`/`jobs`. The ledger
  is written ONLY by the executables above (and at runtime by
  `starci kernel <cmd>`, the kernel agent's single
  mutation surface). Never open or edit the sqlite file by hand.
- The op chain is derived by `route-plan.mjs` — underivable chains are shown as such,
  never guessed.
- Persistence does not itself start the workflow. If the accepted plan includes startup, continue through
  `start-workflow.md` under that same unchanged approval; otherwise obtain startup approval first. It
  starts ONE long-lived `[Kernel]` worker; each op it runs is one ephemeral
  `[Op]` worker (`orchestration worker-start`, in the workflow's one worktree
  that Orca created at Kernel start) that `starci kernel dispatch` starts and `api
  settle` releases — a settled job never leaves a live worker behind, and the
  worktree is released only after the workflow's finish.

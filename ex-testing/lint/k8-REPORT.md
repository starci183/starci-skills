# k8 — docs/sync report: lifecycle skills + bootstrap docs

Scope owned: `.devin/skills/define-goal/SKILL.md`, `.devin/skills/start-kernel/SKILL.md`,
`.claude/SKILL.md` (goal/kernel entry only), `AGENTS.md`, `CLAUDE.md`.

## Changes

| file | change |
|---|---|
| `.devin/skills/define-goal/SKILL.md` | Rewrote flow to assess → plan → `ok` → persist. Added step 2 cold-scan `node .claude/scripts/goal/assess.mjs --repo <project-repos> --json` (before drafting; findings feed goal text + plan table). Added `--project <name>` on both preview/persist commands (selects bound project's `.starciwork/runtime.sqlite`). Added explicit plan-table shape: STATE / GOAL / OP CHAIN (per-leg model tier + estimate + parallel-lane lines) / WILL-WRITE / LEDGER. Noted audit goals score against `.claude/modules/quality/quality-bar.yaml` (10 layers, `enforcedBy`/`status`; `gap` layers reported not skipped). `ok`\|`OK`\|`oK` gate kept verbatim. |
| `.devin/skills/start-kernel/SKILL.md` | Kernel documented as **routed** via `route-model` kind `model.manageWorkflow` (`modules/models/selection.yaml`); `--provider` reduced to an explicit owner override (removed from the canonical commands). Added rule: spawned kernel is ONE long-lived LLM agent orchestrating only via `node scripts/kernel/api.mjs <cmd>` (`survey\|status\|plan\|enqueue\|dispatch\|settle\|incident\|retire`) — never writes sqlite directly, never spawns op terminals; ops = one ephemeral agent per job via `api.mjs dispatch`. Spawn flags from `.claude/providers/orca/adapters/<provider>.yaml` retained. `ok`-gate kept verbatim. |
| `.claude/SKILL.md` | Surgical single-paragraph edit (line 8, the operating-model paragraph): names `define-goal` + `start-kernel` as the lifecycle entry skills and states the kernel-agent + `api.mjs` orchestration model. No other sections touched. |
| `AGENTS.md` | Verified — skills pointer line already names both skills correctly; no content change needed. |
| `CLAUDE.md` | `cp AGENTS.md CLAUDE.md` — confirmed identical (`diff` clean). |

## Referenced-but-not-yet-present (other lanes own)

- `.claude/scripts/goal/assess.mjs` — does not exist yet (`scripts/goal/` has only `define-goal.mjs`).
- `.claude/scripts/kernel/api.mjs` — does not exist yet (`scripts/kernel/` has only `start-workflow.mjs`).
- `--project` flag on `define-goal.mjs` — current script usage line lacks it.
- Routed `model.manageWorkflow` path — present in `modules/models/selection.yaml:51` (kernelFunctionKinds); `scripts/kernel/start-workflow.mjs` still takes `--provider` directly (expected: it's an override).

Docs were written against the finalized architecture per lane instructions; the gate
verifies implementation at the end.

## Verified present

- `.claude/modules/quality/quality-bar.yaml` (10 layers w/ `enforcedBy`/`status`)
- `.claude/providers/orca/adapters/{claude,codex,devin,qwen}.yaml`
- `.workspaces/projects/{nivo,starci-academy}` bindings

No commits; `modules/` and `scripts/` untouched.

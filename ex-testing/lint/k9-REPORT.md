# k9 REPORT — kernel-prompt.md template + dispatch-op.mjs op-prompt audit

Lane: k9
Scope owned: `scripts/kernel/kernel-prompt.md` (NEW). Read-only check: `scripts/route/dispatch-op.mjs`.

## 1. Built: `scripts/kernel/kernel-prompt.md`

New file, written verbatim per lane spec. 1550 bytes, 26 lines. Plain markdown
text template — no code fences, no yaml, no lint surface beyond text.

Placeholders present in body: `{workflowId}` (x3), `{repo}` (x1),
`{goalRevision}` (x1), `{inboxId}` (x1).

Template asserts:
- Identity: `[Kernel] {workflowId}` — one long-lived orchestrator per workflow.
- Mandatory load order: `.claude/SKILL.md` → `modules/kernel/driver-loop.yaml`
  → `modules/kernel/api.yaml` → `modules/kernel/verdict-contract.yaml`.
- Single tool surface: `node scripts/kernel/api.mjs <cmd> --repo {repo}` with
  verbs `survey | status | plan | enqueue | dispatch | settle | incident | retire`.
- Hard prohibitions: no direct `.starciwork/runtime.sqlite` access; no manual
  op-terminal spawns (api `dispatch` owns that).
- Loop discipline: survey → plan (divergence = incident + STOP) → status →
  enqueue → dispatch (disjoint owned_paths, capacity-bound fan-out) → orca poll
  → settle on evidence BYTES (never the op's last words) → retry/escalate →
  retire.
- Failure rule: op idle >10min = wedged → incident + `dispatch --job <id>` respawn.
- Persistence: goal in inbox row `{inboxId}`; truth = runtime.sqlite + files,
  never kernel memory.

## 2. Checked: `scripts/route/dispatch-op.mjs` op prompt (buildPrompt, lines 118–139)

All required elements PRESENT — no drift:

| Requirement | Status | Location |
|---|---|---|
| Mandatory load order | ✅ | lines 125–128: `MANDATORY LOAD ORDER — read before any action:` → `1. SKILL.md (repo root)` → `2. ${packet.brief}` → `3. ${VERDICT_CONTRACT}` |
| verdict-contract ref | ✅ | line 45: `VERDICT_CONTRACT = 'modules/kernel/verdict-contract.yaml'` — file exists on disk |
| owned_paths boundary | ✅ | lines 131–132: `owned_paths: ...` + `only owned_paths may be modified; anything else is out of scope.` |
| Persistence line | ✅ | line 134: `persistence: state lives in .starciwork/runtime.sqlite and files on disk — never in your memory. Markers and reports are the truth.` |
| Returns contract | ✅ | line 135: `returns: {verdict: pass|fail|blocked, evidence: [...paths], suspicion?: string} — contract: modules/kernel/verdict-contract.yaml` (+line 136 suspicion-not-fix rule) |

## 3. Issues / observations for the parent (not edited — other lanes' surface)

1. **`modules/kernel/api.yaml` + `scripts/kernel/api.mjs` do not exist yet.**
   The new kernel prompt names both as the kernel's only tool surface. Presumably
   owned by another lane; until they land, a booted kernel would load-order-fail
   at step 3 and have no command surface. Flag for the fleet coordinator.
2. **`{provider}` placeholder is declared in the interpolation contract but
   unused in the template body.** `{workflowId}`, `{inboxId}`, `{goalRevision}`,
   `{repo}` all appear; `{provider}` does not (the body only says "up to provider
   capacity"). If interpolation is strict (throws on unused/missing keys) this
   is a no-op; if it iterates the template's keys it is fine too. Written
   verbatim per spec — flagging so the wiring lane decides.
3. **`scripts/kernel/start-workflow.mjs` still sends an inline boot prompt**
   (line 136 at time of report — file is being edited concurrently by another
   lane, was line 123 on first read) — it does not read/interpolate
   `kernel-prompt.md` yet, and its
   inline load order is `modules/kernel/{driver-loop,dispatch,verdict-contract}.yaml`
   (matches `modules/kernel/start-workflow.yaml` spawn.prompt, lines 41–44)
   rather than the new `api.yaml`-centered order. Whoever wires the template
   into start-workflow should reconcile: `dispatch.yaml` exists in
   `modules/kernel/` but the new prompt drops it from the load order in favor
   of `api.yaml`.
4. **Op prompt says `SKILL.md (repo root)`; kernel prompt says `.claude/SKILL.md`.**
   In this tree SKILL.md lives at `.claude/SKILL.md` (skill root). For an op
   spawned into a routed worktree, "repo root" is ambiguous vs the worktree
   root. Minor wording inconsistency — not blocking, reported as drift-adjacent.

## Commands run

- `ls`, `git status` (repo scoping — `.claude` is its own git repo)
- reads: `scripts/kernel/start-workflow.mjs`, `scripts/route/dispatch-op.mjs`,
  `modules/kernel/start-workflow.yaml`, `modules/kernel/driver-loop.yaml`
- `write` → `scripts/kernel/kernel-prompt.md` (new)

No commits. No edits outside owned file + this report + done marker.

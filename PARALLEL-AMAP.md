# PARALLEL-AMAP — kernel mission: examples to standard, in parallel

The mission the coordinator (the Devin session acting as kernel) executes right now:
bring the example set to hand-over standard with the maximum parallelism the work
honestly allows — at most **20 concurrent op agents**, mixed across the three pools
that can actually run on this host:

| pool | agent | strength | used for |
|---|---|---|---|
| `qwen` | Qwen CLI (`qwen -i`) | fast bulk implementation, records, tests | most lanes |
| `codex` | Codex CLI (`codex`) | `image_gen.imagegen` (only pool with it), careful refactors | `interface.draw`, delicate merges |
| `devin` | this session | gates, merge arbitration, live proofs, rulings | coordination + NFR lanes |

There is no allocation layer: an Orca worktree **is** the slot, an `OP-BRIEF.md`
at its root **is** the operation input, the agent in its terminal **is** the worker,
and the example gates (`check-example-yaml`, `check-example-work`, `tsc`, `jest`,
`uat`) **are** the definition of done. `.claude` itself is the constitution on the
table — operators, schemas, checks are read, never edited, until the examples are
standard.

## Hard rules

1. **One lane, one write scope.** Two lanes may never own the same path. Shared
   seams (`app.module.ts`, `package.json`, root configs, `_derived/`) belong to the
   coordinator only; a lane that needs a seam change asks, never edits.
2. **No new dependencies.** If a lane thinks it needs one, it stops and asks —
   `package.json` is a shared seam.
3. **Evidence is produced, never written.** Digests come from
   `node scripts/example-evidence.mjs`; lifecycle states follow the evidence, not
   the wish.
4. **`.claude` runtime is read-only** (`ops/`, `schemas/`, `scripts/checks/`, `scripts/`,
   `kernel/`, `core/`, `model/`). Contradictions found go to
   `docs/examples/grit/ledger.md`, never to a silent workaround.
5. A lane ends in one of three states: `merged` (gate green), `blocked` (real
   blocker named, gap record proposed), or `grit` (runtime contradiction found).
   There is no fourth ending.

## Lane map — wave 1 (spawn now, unblocked)

| # | lane | agent | write scope | mission |
|---|---|---|---|---|
| 1 | `ex-work-settle` | qwen | `.starciwork` evidence records, `todo-app-frontend/uat/**` | settle the 4 refusals honestly (exists, relaunch) |
| 2 | `ex-draw-v4` | codex | `brand/**`, `features/*/ui/**`, FE `globals.css` accent | brand rev 3 (turtle mascot, split-screen auth, real UX) + redraw 7 directions (supersedes ex-draw-v3 — v3 directions failed owner's aesthetic review: generic cards, no brand, no shell) |
| 3 | `ex-e2e` | qwen | `todo-app-frontend/e2e/**`, uat records | real e2e suite for the 12 `fr` records (exists, relaunch) |
| 4 | `ex-auth-fix` | qwen | `src/modules/bussiness/session/**`, `features/login/**` | item 51: Bearer↔x-session-token transport fix + `contract.login.identity-for-task` |
| 5 | `ex-be-task` | qwen | `src/modules/bussiness/task/**`, `src/features/todo/**`, `features/task/**` | finish task impls: complete/delete/list/ownership/reopen/platform-events |
| 6 | `ex-be-notify` | qwen | `src/modules/bussiness/notify/**`, `src/modules/integrations/notify-*/**`, `features/notify/**` | notify module + emitted events (task-completion, new-device) |
| 7 | `ex-be-plan` | qwen | `src/modules/bussiness/plan/**`, `src/modules/integrations/sepay/**`, `features/plan/**` | cap-guard wiring + real SePay sandbox call |
| 8 | `ex-be-audit` | qwen | `src/modules/bussiness/audit/**`, `features/audit/**` | audit module + emitted-events contract subscription |
| 9 | `ex-ms-be` | qwen | `examples/ecommerce-app-be/**` (new) | NestJS monorepo: `apps/identity` + `apps/order`, `.starciwork`, `metadata.json` ports offset 69 |
| 10 | `ex-ms-fe` | qwen | `examples/ecommerce-app-fe/**` (new) | Next.js monorepo: `apps/landing` + `apps/shop` |

## Lane map — wave 2 (after `ex-draw-v3` merges)

FE implementations read the direction image their `ui` record points at; they
cannot start before it exists. One lane per feature dir — `src/app/<feature>/`
is disjoint by construction.

FE lanes go to **Devin** on purpose: implementing against a direction image
means *seeing* it — Devin reads PNGs, Qwen's CLI cannot. This also balances the
fleet to ~50% Devin / ~50% Qwen as the owner requires.

| # | lane | agent | write scope |
|---|---|---|---|
| 11 | `ex-fe-login` | devin | `src/app/sign-in/**`, `features/login/impl/**` |
| 12 | `ex-fe-task` | devin | `src/app/tasks/**`, `features/task/impl/**` |
| 13 | `ex-fe-share` | devin | `src/app/share/**`, `features/share/**` (exists, needs brief) |
| 14 | `ex-fe-notify` | devin | `src/app/notify/**`, `features/notify/impl/**` (exists) |
| 15 | `ex-fe-plan` | devin | `src/app/plan/**`, `features/plan/impl/**` (exists) |
| 16 | `ex-fe-recur` | devin | `src/app/recur/**`, `features/recur/**` (exists) |
| 17 | `ex-fe-audit` | devin | `src/app/audit/**`, `features/audit/impl/**` (exists) |

## Lane map — wave 3 (proof and finish)

| # | lane | agent | write scope | mission |
|---|---|---|---|---|
| 18 | `ex-nfr` | devin | `scripts/`, `features/*/nfr/**` | live proofs: k6 latency, SMTP, SePay sandbox — needs the real stack |
| 19 | `ex-capture` | devin | `scripts/checks/check-example-render.mjs` wiring, `features/*/impl/**` captures | wire `render`/`brand` checks into the gate (item 55) — compares renders against direction PNGs, needs vision |
| 20 | `ex-lint` | qwen | `examples/*/eslint*` | lint profile that the example's own config passes |

**Fleet mix:** Qwen 10 (wave-1 ×9 + lint) · Devin 9 (FE ×7 + nfr + capture) ·
Codex 1 (draw-v4, image_gen only) — ~50/50 Devin/Qwen per owner direction.

Peak concurrency: 10 (wave 1) → 8 (wave 2 overlaps wave-1 stragglers) → 4.
Never above 20; Qwen lanes stagger to respect rate limits.

## Spawn protocol

```powershell
# per lane, from the coordinator:
orca worktree create --name <lane> --base-branch integrate/records
# write OP-BRIEF.md + run-op.ps1 at the worktree root, then:
orca terminal create --worktree name:<lane> --command "powershell -File run-op.ps1"
```

`run-op.ps1` loads `~/.qwen/.env` into the process env first — the user-level
`BAILIAN_TOKEN_PLAN_API_KEY` holds a stale truncated key that shadows the file
and returns 401. Codex lanes launch `codex` directly with the brief path.

## Merge protocol

1. Lane agent commits on `starci183/<lane>` and stops.
2. Coordinator merges `--no-ff` into `integrate/records`, resolves registration
   seams itself (it owns them).
3. Gates on `integrate/records`: `check-example-yaml`, `check-example-work`,
   `example-derive --check`, `tsc --noEmit`, `jest`, `uat` where a run exists.
4. Green → lane done, worktree pruned. Red → fix in the lane or grit, never a
   hand-patched merge.

## Open owner questions (parked, do not block wave 1)

- UAT video: commit recordings into the repo (current direction: yes —
  `ex-work-settle` un-gitignores them).
- `e2e` record family shape: coordinator proposes inside `ex-e2e`, owner
  approves on merge review.
- Item 52 (main's example vs main's checker): ruled separately before the
  final `main` merge.

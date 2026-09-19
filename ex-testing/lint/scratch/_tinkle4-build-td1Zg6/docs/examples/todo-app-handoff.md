# todo-app reference example — handover

Written 2026-09-18 for the next agent to pick this up. Everything below is measured, not remembered:
every number came from running the command named beside it in this checkout.

## What this work is

`.claude` is being rebuilt from an example instead of from doctrine. The example is a complete,
runnable product — `examples/todo-app-backend` (NestJS + GraphQL, port 3001, owner of `.starciwork`
and `.starcistacks`) and `examples/todo-app-frontend` (Next.js, port 3000, real
`@starci/grammar@0.4.13` on HeroUI) — built **against** this runtime's checks, ops, schemas and
kernel. Wherever the runtime lies, blocks legitimate code, or has no home for a real need, that is
**grit** and it goes in `docs/examples/todo-app-grit.md` (55 rows today). The grit ledger, not the
example, is what drives the `.claude` refactor. `.claude` itself is legacy for now and is not edited.

Seven features: login, task, share, notify, plan, audit, recur. The three record states
`done` / `stale` / `todo` are **designed exemplars**, not progress levels — the tree must end with
every feature implemented, exactly one kept breaking change as the stale sample
(`br.task.single-owner` rev 2), and a small curated `todo` set.

## Where the work lives

| | |
|---|---|
| Shared checkout | `D:/Repositories/starci-academy-backend/.claude`, branch `main` |
| Integration branch | `integrate/records` in `D:/starci-ex/integrate` |
| Lane worktrees | `D:/starci-ex/<lane>`, one branch `ex-<lane>` each |
| Orca worktrees | `C:/Users/Hi/orca/workspaces/.claude/<lane>` |

Method: each lane commits on its own branch, the integration worktree merges lane branches with
`--no-ff`, gates run there, then the shared checkout does a single `git merge --ff-only
integrate/records` and pushes. **The shared checkout is dirty with another session's kernel
refactor** (`hosts/*`, `kernel/*`, `model/index.mjs`, `MASTER.md`) — never stash, add or reset there.

## State right now

`main` is at `399fddf4`, pushed. `integrate/records` is at `023dd8d9`, **not** merged to main,
because its gate is red. Six lanes merged since main: share, recur, login, notify, audit, plan.

Backend, from `examples/todo-app-backend`:

| check | result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx jest` | 58 suites, 236 tests, all pass |
| `node cli/main.mjs architecture check examples/todo-app-backend --config architecture.json` | red, ~41 at base plus per-file growth — known, see grit 50/52 |

Work tree, from the repository root:

| check | result |
|---|---|
| `node scripts/checks/check-example-yaml.mjs` | 447 files, all accepted |
| `node scripts/checks/check-example-work.mjs` | **4 refused**, 15 warned |
| `node scripts/example-derive.mjs --work examples/todo-app-backend/.starciwork --write` | 198 records: 117 done, 40 todo, 4 stale, 37 blocked; 33 gaps, 0 open unbuilt-module |

## The four refusals — the immediate job

1. `features/task/br/single-owner/index.yaml` — `blockedBy` cites `gap.task.collaborator-completion`
   with no rev; that gap is now done at rev 2. The share lane built collaborator completion, so the
   blocker is genuinely gone. **This record is the designed `stale` exemplar** — the tree must end
   with exactly one stale evidence, this one, and the derived count currently says 4.
2. `features/task/impl/todo-app-backend/platform-database/evidence.yaml` — `CODE_DIGEST_STALE`. Five
   features registered entities and migrations inside one shared platform module. Either re-capture
   through `node scripts/example-evidence.mjs` by really running its assertions, or mark it stale
   with a reason. Never hand-edit a digest.
3. `features/login/impl/todo-app-frontend/sign-in/evidence.yaml` — the record changed after capture.
   Same two honest endings.
4. `features/login/uat/sign-in/index.yaml` — the gate wants `runs/<id>/videos/` to hold a playable
   recording, and **no run folder in the repository has one**, because the harness at
   `examples/todo-app-frontend/uat/` writes a real video and then gitignores it. A fresh clone can
   never pass this gate. The owner wants the video to be evidence an outsourcer can open, so the
   recording belongs in the repository. This contradiction is not yet in the grit ledger.

## What is left after that

In dependency order — the derived frontier (`.starciwork/_derived/frontier.md`) is the scheduler.

1. **Direction images.** Seven `work/ui-screen` records carry v2 prompts that the owner rejected:
   the anatomy was read off the already-implemented block instead of the design-system package, only
   proof knowledge was cited (composition and presentation knowledge exist and were ignored), and no
   aesthetic or page-frame intent was carried at all. Re-run `interface.draw` in full.
2. **Frontend implementation.** Stopped by owner order until the images land. It must capture each
   rendered state and compare it against the direction; `scripts/checks/render.mjs` and `scripts/checks/brand.mjs`
   exist for exactly that and are wired to nothing.
3. **End-to-end.** Twelve `fr` records demand `npm run test:e2e`; that script and that suite do not
   exist. `ops/e2e.verify` owns authoring it, but the Work tree has no `e2e` record family at all, so
   the op has nowhere of its own to record the result.
4. **Lint profile** for the backend, example config only.
5. **Self-review to 9/10** on the owner's seven criteria, then handoff.

## Who runs what

The owner's standing assignment. Every lane runs **the whole operator file**, not a summarised brief:
the brief names the selected target and the boundaries, the operator is the instruction.

| operation | model |
|---|---|
| `interface.draw`, `interface.asset` | Codex, profile `gpt-5.6-sol` — the only image-capable profile; the tool is `image_gen.imagegen` and nothing else |
| `uat.verify`, `backend.implement`, `frontend.implement`, `e2e.verify`, `work.author`, srs/sds authoring | Qwen Code |

Three op briefs are already written and ready to use:

- `C:/Users/Hi/orca/workspaces/.claude/ex-draw-v3/OP-BRIEF.md` — `interface.draw`, seven screens
- `C:/Users/Hi/orca/workspaces/.claude/ex-work-settle/OP-BRIEF.md` — `work.author`, the four refusals
- `C:/Users/Hi/orca/workspaces/.claude/ex-e2e/OP-BRIEF.md` — `e2e.verify`, the missing suite

## Traps that have already cost time

- **Qwen returns 401 in a terminal although the key is valid.** The user-level environment variable
  `BAILIAN_TOKEN_PLAN_API_KEY` holds a 113-character key; `~/.qwen/.env` holds the correct
  114-character one, and the environment variable wins. A direct HTTPS call with the file's value
  returns 200. Override it per process before launching, or fix the environment variable.
- **Do not union-merge the shared registration files.** Every backend lane appends one line to
  `src/app.module.ts`, the barrels, `primary.module.ts`, `entities/index.ts`,
  `shared/exceptions/index.ts` and `app-config.service.ts`. Taking both sides of those conflicts
  duplicates whole import statements and entity arrays and silently drops closing braces. Merge them
  by hand with the compiler as the judge.
- **`starci validate` cannot run** in a fresh worktree — it needs a built `.dist`, and building the
  kernel is out of scope. The tree's real gates are the `scripts/checks/check-example-*.mjs` family.
- **Every op still speaks the old kernel vocabulary** — `N/index.yaml`, `completion.inputDigest`,
  `E/manifest.yaml` and siblings. This tree uses `schemas/work-layout.yaml`'s flat families and one
  sibling `evidence.yaml` per record. All six backend lanes hit this independently. Do not fabricate
  `N/` or `E/` artifacts to fit; quote the operator line and report the gap.
- **The kernel digests the whole record file**, not statements plus acceptance criteria, so a
  cosmetic edit staleness-flags evidence that is still true.
- **`architecture check` on the frontend needs `--config architecture.json`**; bare inference sees
  `src/features` plus `src/modules` and wrongly adds a backend profile.
- **Secrets** travel as `<name>` plus `<name>.enc` through real SOPS with a DEMO-ONLY age identity at
  `.starcistacks/dev/runtime/env/demo.agekey`. A tracked plaintext secret is a leak.
- **Docker**: `docker stop` only, never `rm`, and only containers named `todo-app-dev-*`. The example
  keeps its original ports, 3000 and 3001.

## Rules that are not negotiable

Never fake evidence, a `done`, a live proof, a capture or a model name. A record that cannot be
proven stays `todo` blocked by a real gap. One agent per worktree, no sub-agents. Agents never push;
the lead pushes. `.starciwork` is the source of truth and the code follows it — a reader must be able
to answer what the product does, and bound how much source to read, from the tree alone.

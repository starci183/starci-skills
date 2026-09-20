# MASTER - refactor plan for `.claude`

> Status 2026-09-20: execution has moved to the consolidated wave2 lanes under
> `ex-testing/briefs/wave2/` toward the distless target in `.experiments/OPENSOURCE-GOAL.md`
> (VERSION `1.0.0-alpha.1`). This file remains the measure; where it says `.dist`, read the
> canonical source path — the distless wave removes the build entirely.

Written 2026-09-18 from a read of the whole tree at `main` c0326fe6. The owner's ruling stands:
**the example is the standard; `.claude` refactors to follow it.** This file is the plan, the
measure and the order. It is not runtime content: nothing loads it, no gate reads it, and it is
deleted when the last workstream below is closed.

## 0. What the tree is today

| Area | Measured on 2026-09-18 |
| --- | --- |
| Entry | `SKILL.md` is 138 lines but 47 KB: paragraph-walls, three generations layered ("StarCi 1.0", "5-plus", "compatibility paragraph above") |
| Kernel | `kernel/` 66 files, 23 809 lines; `kernel/kernel.mjs` alone 5 005 lines |
| Declared data | `model/kinds.yaml` 32 kinds; `ops/` 30 operator dirs; 5 kinds without an operator (`architecture.revise`, `business.revise`, `frontend.implement`, `goal.validate`, `implementation.plan`), 2 operators without a kind (`interface.implement`, `task.execute`) |
| Layout debt | 20 of 30 `ops/*/operator.yaml` still read `<business>/business/**` and write `work/node@2` fields; 4 name `features/` |
| Validator debt | `starci validate examples/todo-app-backend/.starciwork` = 2 916 errors (UNKNOWN_FIELD 1 226, SCHEMA_VALUE 705, SCHEMA 217, NODE_KIND 216, REQUIRED 216, EMPTY_SPEC 201); the example gate `scripts/checks/check-example-work.mjs` passes the same tree (217 records, 723 refs) |
| Layout schema | `schemas/work-layout.yaml` (`starci/work-layout@3`) still describes `business/srs/**`, `architecture/sds/**`, `implementation/{frontend,backend}`; the example uses `br/ fr/ nfr/ data/ journey/ decision/ event/ gap/ sds/ contract/ impl/ ui/ uat/` with 18 `work/*` schema families; `model/records.yaml` knows about a dozen record classes, none named `work/*` |
| Digest | the kernel digests the whole record file (`kernel/reconciliation.mjs`), so hand-authored evidence is digest-stale by construction |
| Docs | `docs/` 78 files; six are dated plans or handovers (`v4-plan`, `v4.1-supervision-plan`, `v5-plan`, `5-plus`, `handover-2026-09-14`, `design-pattern-source-review-20260916`) |
| Root noise | `goal.md`, `FANOUT-NOTES.md`, `PARALLEL-WRITERS-NOTES.md`, `SUITE-FINDINGS.md`, `notes/s0..s9` are session notes at the root of a runtime package |
| Worktrees | 78 registered, 24 live (main, the 22 example lanes, the devin lane); about 54 are stale agent lanes (`agent/*`, `fmt/*`, `srs/*`, `fix/104-*`, `s0..s9`, `.claude-2.0.x`) |
| Tests | 177 spec files, 2 134 tests, green in a private worktree (SUITE-FINDINGS) |
| Example | `examples/todo-app-backend` (Nest, :3001, owns `.starciwork` + `.starcistacks`) and `examples/todo-app-frontend` (Next, :3000); 7 features; 38 done / 131 todo / 4 stale; 11 gap records of which 5 are `unbuilt-module` (share, notify, plan, audit, recur); lanes `ex-live` and `ex-seams` unmerged |

Two facts decide the order of everything below. The example gate accepts the tree the core
validator refuses, so **there are two layouts in one repository** and the runtime runs on the old
one. And the kernel is 24 k lines with a 5 k-line hub, so **no restructure of the runtime is safe
until the example is complete enough to be its regression suite.**

## 1. Principles the plan obeys

1. **One place per concept.** Slim by counting the places a concept is stated, never by line
   count; when two places disagree, keep the one with the gate and move its *why* first.
2. **Gate before rule.** A violated existing rule is an enforcement gap. No new rule, doc or
   Case lands without the check that refuses its violation.
3. **The example is the oracle.** Every layout, schema, operator and validator change is
   accepted only when `examples/todo-app-backend/.starciwork` validates, boots and proves under
   it. The example does not bend to the runtime.
4. **Forward only.** Records and proofs made before a contract existed are left as they are;
   nothing is migrated by assertion. A retired id keeps one clause naming its survivor; history
   stays in git.
5. **Runtime English, prose in roles.** Knowledge names roles, kinds and families, never a
   product, path, port or a number from one run.
6. **Fable reasons, Sonnet edits, one agent per worktree.** The lead verifies scope, gates and
   claims of every lane before merge; a lane's report is never taken at face value.

## 2. Workstreams, in dependency order

Each workstream is one lane (`ex-<name>` or `rf-<name>` branch, worktree under `D:/starci-ex`),
integrated through `integrate/records` with `--no-ff`, gates re-run there, then one
`--ff-only` merge in the shared checkout. The shared checkout carries another session's kernel
edit (`kernel/chains.mjs`, `model/index.mjs`); no lane touches those paths until it lands.

### WS-A  Finish the example (the oracle)

Goal: every feature implemented, every `gap.*.unbuilt-module` closed, the curated end-state
in place: `done` for everything built and proven, exactly one kept breaking change
(`br.task.single-owner` rev 2) as the `stale` exemplar, and a small curated `todo` set (open
decisions such as `decision.task.list.scope`, integrations awaiting live proof).

| Step | Lane | Done when |
| --- | --- | --- |
| A1 merge the two open lanes | `ex-live` (dev stack proven against real Keycloak/Postgres), `ex-seams` (domain-event seam, policy seams, real evidence script) | integrated, suite green, example gate green |
| A2 build the five unbuilt modules | one lane per feature: `ex-share`, `ex-notify`, `ex-plan`, `ex-audit`, `ex-recur` (share/notify/recur already have lanes; rebase or restart them on A1) | Nest module + Next screen per feature, boot test passes, `gap.<f>.unbuilt-module` deleted or `closedBy` resolved |
| A3 close the six non-module gaps | inside the owning A2 lane | `audit/emitted-events`, `audit/operator-role`, `login/device-field`, `login/migration-not-applied`, `notify/new-device-event`, `notify/task-completion-event` resolved |
| A4 real evidence | `scripts/example-evidence.mjs` (from `ex-seams`) run per feature | every `requiresProof` record has an evidence file produced by a run, not by hand |
| A5 curated end-state | one small lane | `todo`/`stale`/`done` counts match the designed exemplar set; the example gate asserts the set |
| A6 UAT walks | `uat/<flow>` per feature on the booted stack | one walk per feature with captures under the flow's assets |

WS-A is also where the answer to "can the student write the examples" is proven: yes, under
the lane rules above, one Sonnet agent per feature worktree, the lead verifying boot, gate and
evidence per lane before merge.

### WS-B  One layout, one record catalog, one validator

Goal: the runtime's declared data describes the example's tree, and the core validator accepts
it with zero errors. This is the pivot; nothing in WS-C..WS-F starts before B3.

| Step | Owner files | Done when |
| --- | --- | --- |
| B1 layout schema | `schemas/work-layout.yaml` → `starci/work-layout@4` naming the example's folder families (`br fr nfr data journey decision event gap sds contract impl ui uat integration`) and `brand/` | the layout lists every folder the example has and nothing it lacks |
| B2 record catalog | `model/records.yaml` → one entry per `work/*` schema family (18), each naming its validator and its `carries` const; `model/kinds.yaml` `reads`/`writes` re-pointed to those classes | `validateGraph` accepts the catalog; no kind reads or writes a class the catalog lacks |
| B3 core validator | `core/` accepts `work/*` records by their own schema; `starci/work-layout@3` shapes stay readable, never authoring authority | `starci validate examples/todo-app-backend/.starciwork` = 0 errors; `scripts/checks/check-example-work.mjs` rules move into `core/` (one validator, the example spec becomes a fixture test) |
| B4 digest | `kernel/reconciliation.mjs` digests `statements` + `acceptanceCriteria` (the designed slice), not the file | a title edit does not stale a proof; a rule edit does; both pinned by spec |
| B5 stale/proven | `stale`/`staleSince`/`proven` semantics as the layout states them | the kept breaking change shows as `stale` with its dependents; ledger summary counts agreed and proven separately |

### WS-C  Operators follow the layout

Goal: every operator reads and writes the example's records; kinds and operators are one closed set.

| Step | Done when |
| --- | --- |
| C1 re-point 20 operators from `<business>/business/**` + `work/node@2` to the `work/*` classes | `ops/validate.mjs` + `IO_DRIFT` refuse a stale path; `tests/ops.spec.mjs` runs each operator's declared IO against the example tree |
| C2 close the kind/operator gap | operator dirs for `architecture.revise`, `business.revise`, `implementation.plan`, `goal.validate`; `frontend.implement` and `interface.implement` become one name (keep the kinds.yaml name); `task.execute` gets a kind or is deleted |
| C3 knowledge/checks/stacks inputs | each kind's declared `knowledge`, `checks`, `stacks` lists resolve to real files; pattern-coverage parity: every `knowledge/patterns/{fe,be}/*` has a `scripts/checks/code-patterns/*` or a `check: manual` with a reason |
| C4 one end-to-end dry run | `workflow-goal` → `workflow-approve` → `workflow-run --host-adapter headless` on the example for one feature; all ops launch with the new IO and the ledger accepts |

### WS-D  Kernel by concept, not by history

Goal: the 5 005-line hub becomes a loop that calls the per-concern files that already exist.
No behaviour change; the 2 134 tests plus the WS-A example are the regression suite.

| Step | Done when |
| --- | --- |
| D1 inventory `kernel/kernel.mjs` by concern | a table: function → the sibling file that owns the concept (`schedule`, `sync`, `owner`, `verify`, `candidates`, `terminals`, `reports`, `view`...) |
| D2 move, one concern per commit | `kernel.mjs` ≤ 800 lines: tick loop, stage order, ctx wiring; every moved function keeps its spec |
| D3 the `inputs-*` and `job-*` clusters fold to one module each | `kernel/inputs.mjs`, `kernel/jobs.mjs` as the only public surface of their cluster |
| D4 `execution/` (4.x Plan route) is either wired into the kernel's route table or retired with one clause naming its survivor | no second control loop |
| D5 `scripts/runtime-modules.txt` regenerated from the import closure | `runtime-import-closure.spec` is the list's only author |

### WS-E  Entry and documentation as one design

Goal: a reader meets one entry, one tree map, one doc per concept, no generations.

| Step | Done when |
| --- | --- |
| E1 `SKILL.md` rewrite | ≤ 200 lines of short paragraphs; one route table (question / flash / standalone / plan / enrolled); every paragraph links its authority (`docs/*`, `modules/*`, `schemas/*`); no "1.0 vs 5-plus", no "compatibility paragraph above", no "lifecycle correction" |
| E2 `INDEX.yaml` folders match disk | `runtime/`, `mcp/`, `notes/`, `fixtures/` either listed with a purpose or removed from the package |
| E3 docs by concept | merge the six dated plans/handovers into the concept doc they describe or into `upgrades/<version>.md`; target one doc per concept: goal, kinds, records, layout, ledger, allocation, hosts, checks, execution contract, chat host, upgrade |
| E4 root notes leave | `goal.md` → `docs/goal.md` (the one goal doc) or `upgrades/`; `FANOUT-NOTES`, `PARALLEL-WRITERS-NOTES`, `SUITE-FINDINGS`, `notes/s*` → their facts into the owning doc or spec, files deleted |
| E5 `UPDATE.yaml` | one section per living rule; the "5-plus" and "Maintaining 3.0" sections fold into present-tense rules |
| E6 `README.md` | quick start runs against the example: install, validate, boot, one workflow |

### WS-F  Hygiene and release

| Step | Done when |
| --- | --- |
| F1 prune worktrees | the stale lanes removed with `git worktree remove`; branches kept; `git worktree list` shows only live lanes |
| F2 `.gitignore` and package `files` agree | `npm pack` contains no example `node_modules`, no `runtime/`, no notes |
| F3 version + upgrade note | `upgrades/<next>.md` says what moved, what an installed runtime must do (restart supervisor, re-seal, `ledger-migrate`) |
| F4 release proof | full suite in a private worktree, `npm run build && npm run build:check`, one live workflow on the example on the sealed pin |

## 3. Measures that decide "done"

| Measure | Now | Target |
| --- | --- | --- |
| `starci validate` errors on the example | 2 916 | 0 |
| operators on the old layout | 20 / 30 | 0 |
| kinds without operator + operators without kind | 5 + 2 | 0 + 0 |
| `gap.*.unbuilt-module` records | 5 | 0 |
| example features with a running module, real evidence and a UAT walk | 2 of 7 (login, task, partial) | 7 of 7 |
| `kernel/kernel.mjs` lines | 5 005 | ≤ 800 |
| `SKILL.md` size | 47 KB | ≤ 12 KB |
| dated plan/handover files in `docs/` | 6 | 0 |
| session notes at package root | 4 files + `notes/` | 0 |
| registered worktrees | 78 | live lanes only |
| full suite | 2 128 pass / 6 skip | same or more, 0 fail |

## 4. Order and gates between workstreams

```
WS-A (example)  ──►  WS-B (layout/catalog/validator)  ──►  WS-C (operators)  ──►  WS-D (kernel)
                                                                              └──►  WS-E (entry/docs)
                                                                                     └──►  WS-F (release)
```

- WS-A runs first and alone; nothing else is merged until A1 is in.
- WS-B starts when A2 has at least one new feature booting (so B3 validates a tree with real
  implementation records, not only the two hand-built ones). B and the rest of A overlap.
- WS-C starts at B3 = 0 errors. Never before: an operator re-pointed at a layout the validator
  refuses cannot be tested.
- WS-D and WS-E start at C4 (one dry run green) and may run in parallel; they touch disjoint files.
- WS-F is last and is the only step that bumps the version.

## 5. Decisions the plan takes, so nobody re-asks

- The example's folder names (`br`, `fr`, `impl`, ...) win over the layout schema's
  (`business/srs`, `implementation/backend`). The schema follows the example.
- `scripts/checks/check-example-work.mjs` is not a second validator; its rules move into `core/` and
  the script becomes a thin caller or is deleted.
- Kinds keep their names from `model/kinds.yaml`; operator directories rename to match.
- Nothing in `execution/` gains new behaviour; it is wired or retired in D4.
- `.dist` is deleted by the distless wave (tinkle-14..23, consolidated into wave2 w3/w4/w5/w7): the runtime reads the source tree directly, so a moved source IS the moved artifact. This clause superseded the original "`.dist` untouched" assumption.
- Dated documents are not deleted from history; they are folded and removed from the package.

## 6. Out of scope

- Live Nivo/AgentOS workflows and their ledgers; a kernel change reaches them only through the
  seal → stop → retry cycle after WS-F, never mid-plan.
- Provider adapters (`providers/`, `hosts/orca`) beyond what C3/D4 require.
- Publishing to npm.

# Run the operation `work.author` — in full

You are the operation agent for **one operation**: `ops/work.author/operator.yaml`, in this worktree.

The operator file is the instruction. Not this brief. Read `ops/work.author/operator.yaml` completely
first, then `ops/common.yaml` and `schemas/work-layout.yaml`, and execute every step it declares, in
the order it declares them. This brief names the selected target and the boundaries.

## Selected target

The Work tree is `examples/todo-app-backend/.starciwork`. Six feature lanes just merged into it and
its own gate now refuses four records. Run this command from the repository root and make it read
`0 refused`, honestly:

```
node scripts/checks/check-example-work.mjs
```

The four refusals, and what an honest settlement means for each:

1. `features/task/br/single-owner/index.yaml` — its `blockedBy` cites `gap.task.collaborator-completion`
   with no rev, and that gap is now `done` at rev 2. The share lane built collaborator completion, so
   the blocker is genuinely gone. Decide what the record should say now and say it.
   **This record is the example's one designed `stale` exemplar** — rev 2 split its statement and its
   evidence re-proves only the unchanged half. Preserve that: the tree must end with exactly one
   stale evidence, this one, carrying `stale`, `staleSince` and a `staleReason` that names which half
   is unproven and why.
2. `features/task/impl/todo-app-backend/platform-database/evidence.yaml` — `CODE_DIGEST_STALE`. Five
   features registered their own entities and migrations inside that one shared platform module. Two
   honest endings exist: re-capture by really running its assertions through
   `node scripts/example-evidence.mjs`, or mark it `stale: true` with a reason that names the cause.
   Pick one and be able to defend it. Do not hand-edit a digest.
3. `features/login/impl/todo-app-frontend/sign-in/evidence.yaml` — the record changed after the
   evidence was captured. Same two honest endings.
4. `features/login/uat/sign-in/index.yaml` — the gate wants `runs/<id>/videos/` to hold a playable
   recording, and no run folder in the repository has one. The harness at
   `examples/todo-app-frontend/uat/` writes a real video and then **gitignores it**, so a fresh clone
   can never satisfy this gate. That is a real contradiction between the harness and the gate, not a
   missing file. Resolve it in the example's favour: the owner wants the video to be evidence an
   outsourcer can open, so the recording belongs in the repository. Un-ignore it, produce a real run
   with a real recording if the stack is reachable, and record its sha256. If the stack cannot be
   reached from this machine, the record is not `done` — say so and leave it blocked on a real gap.
   Either way, write the contradiction up (file, gate rule id, harness line) for the grit ledger.

## Boundaries

- Write under `examples/**` only.
- **Do not edit the runtime**: `ops/`, `schemas/`, `scripts/checks/`, `scripts/`, `kernel/`, `core/`,
  `model/`, `docs/` outside `docs/examples/`. The owner has ruled `.claude` legacy — it is refactored
  later, from what runs like this one find. `examples/todo-app-frontend/uat/**` is example code and
  is yours to change.
- Never fabricate a proof, a `done`, a digest or a pass. A record you cannot prove stays `todo`
  blocked by a real gap.
- The operator's `reads`/`writes` still name `N/index.yaml` and `E/…` from an older kernel
  generation. Where it commands something this tree has no home for, do not improvise: quote the
  operator line, name what this tree has instead, and report it. That report is part of the
  deliverable.
- Do not commit this file. Do not push.

## Finish

`node scripts/checks/check-example-yaml.mjs` (all accepted), `node scripts/checks/check-example-work.mjs`
(**0 refused**; paste the warnings), `node --test tests/example-work-gate.spec.mjs
tests/example-evidence.spec.mjs`, then
`node scripts/example-derive.mjs --work examples/todo-app-backend/.starciwork --write` and
`node scripts/example-critique.mjs --work examples/todo-app-backend/.starciwork --write` and
`node scripts/checks/check-example-derived.mjs`. Commit in slices ending with
`Co-Authored-By: Qwen Code <noreply@alibabacloud.com>`.

Report, structured by the operator's own ids: what each `reads` gave you, what each `writes`
received, each `checks` result, each `blockers` condition you hit — then the four refusals with the
settlement you chose and the command that proves it, and the derived counts
(done / todo / stale / blocked). The tree must end with exactly one stale evidence.

The lead may send follow-up instructions mid-task; they are legitimate. Do the work yourself.

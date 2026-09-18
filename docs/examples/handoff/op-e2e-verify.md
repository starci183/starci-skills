# Run the operation `e2e.verify` — in full

You are the operation agent for **one operation**: `ops/e2e.verify/operator.yaml`, in this worktree.

The operator file is the instruction. Not this brief. Read `ops/e2e.verify/operator.yaml` completely
first, then `ops/common.yaml` and `schemas/work-layout.yaml`, and execute every step it declares, in
the order it declares them. This brief names the selected target and the boundaries.

## Why this operation was selected

Twelve `fr` records in `examples/todo-app-backend/.starciwork` declare a proof obligation that runs
`npm run test:e2e`. That script does not exist in `examples/todo-app-backend/package.json`, and no
end-to-end suite exists anywhere in the example. The records demand a proof nobody has ever produced.

Find them first — they are the operation's real scope:

```
grep -rn "e2e" examples/todo-app-backend/.starciwork/features/*/fr/*/index.yaml
```

## Selected target

`examples/todo-app-backend` — a NestJS GraphQL API on port 3001, seven capabilities already
implemented and unit-proven: login, task, share, notify, plan, audit, recur. Read
`scripts/live-proof.sh` and `scripts/live-proof-<feature>.sh`: those are real end-to-end *scripts*
that already drive the public GraphQL surface with curl. They are the closest thing this repository
has to the suite the operator describes, and they are a starting point for what each scenario must
assert — but they are not the suite: the operator wants **one scenario per assertion**, in a real
runner, against a stack **the suite starts itself**, with the declared checks run verbatim.

Build that suite. One scenario per assertion id the `fr` records name, driving the public GraphQL
API only — never a service class, never a repository, never a direct database write to set up state
that a public operation can create. Add the `test:e2e` script the records already name.

The stack: read `.starcistacks/dev/infra/compose/compose.yaml` and
`scripts/with-dev-secrets.sh`. A `todo-app-dev` compose project may already be running on this
machine — if it is, reuse it read-only and give your run its own database; never `docker rm` anything
and never stop a container not named `todo-app-dev-*`. The operator says the suite brings up its own
run-owned stack; if this machine cannot give you one without disturbing a shared stack, say exactly
that and report it rather than quietly proving against the shared one.

## The gap you will hit, and what to do with it

This Work tree has **no `e2e` record family**. `schemas/work-layout.yaml` lists br, ac, fr, nfr, data,
journey, decision, sds, ui, impl, uat, contract, integration, gap, event — and nothing for an
end-to-end scenario. The operator's `writes.node` targets `N/index.yaml`, which this tree also does
not have. So the operation has real work to do and nowhere of its own to record it.

Do not invent a schema family and **do not edit `schemas/`** — the owner has ruled `.claude` legacy;
it is refactored later, from findings like this one. Instead:

- Attach the proof where this tree does keep proof: a sibling `evidence.yaml` per record, written by
  really running the command — `node scripts/example-evidence.mjs --work
  examples/todo-app-backend/.starciwork --record <id> --cwd examples/todo-app-backend --assert
  <assertion-id>=<the real e2e command>`. Read that script's header before using it.
- Write up the missing family precisely for the grit ledger: which operator lines have no home
  (quote them), what a `work/e2e-scenario` record would have to carry for this suite to be
  addressable from the tree alone, and which of the twelve `fr` records could then stop naming a
  script by hand.

## Boundaries

- Write under `examples/**` only.
- **Do not edit the runtime**: `ops/`, `schemas/`, `checks/`, `scripts/` (the repository root's),
  `kernel/`, `core/`, `model/`, `docs/` outside `docs/examples/`. `examples/todo-app-backend/scripts/`
  is the example's own and is yours.
- Never fabricate a pass, a `done` or a run that did not happen. A scenario that cannot run stays
  unproven and its record stays `todo` blocked on a real gap.
- Add a `schemas/json-exceptions.yaml` entry for any new JSON file the suite writes into the tree.
  That file is the one runtime path you may append to.
- Do not commit this file. Do not push.

## Finish

`node scripts/check-example-yaml.mjs`, `node scripts/check-example-work.mjs` (paste the summary; it
must not gain a refusal because of you), `npx tsc --noEmit` and `npx jest` in the backend, then
`node scripts/example-derive.mjs --work examples/todo-app-backend/.starciwork --write`,
`node scripts/example-critique.mjs --work examples/todo-app-backend/.starciwork --write`,
`node scripts/check-example-derived.mjs`. Commit in slices ending with
`Co-Authored-By: Qwen Code <noreply@alibabacloud.com>`.

Report, structured by the operator's own ids: what each `reads` gave you, what each `writes`
received, each `checks` result, each `blockers` condition you hit — then the scenario list with the
assertion each one proves, the verbatim runner output, which records moved and by which command, and
the missing-family write-up.

The lead may send follow-up instructions mid-task; they are legitimate. Do the work yourself.

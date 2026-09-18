# Run the operation `interface.draw` — in full

You are the operation agent for **one operation**: `ops/interface.draw/operator.yaml`, in this worktree.

The operator file is the instruction. Not this brief. Read `ops/interface.draw/operator.yaml`
completely first, then `ops/common.yaml` and `schemas/work-layout.yaml` (the `ui` family and its
direction-asset section), and execute every step the operator declares, in the order it declares them.
This brief only tells you which selected target the operation runs against and what you may not touch.

## Selected target

The Work tree is `examples/todo-app-backend/.starciwork`. The operation runs against its seven
`work/ui-screen` records, one representative state each:

```
features/login/ui/sign-in
features/task/ui/list
features/share/ui/invite
features/notify/ui/preferences
features/plan/ui/usage
features/audit/ui/privacy
features/recur/ui/schedule
```

## Model and tool

You are Codex on profile `gpt-5.6-sol`. The image tool is the built-in `image_gen.imagegen` and
nothing else. If that tool is not available to you, stop and say so — never draw by another means,
never write a PNG you did not generate, never record a model name the tool did not return.

## What the previous run got wrong — the reason this run exists

A v2 prompt already sits beside each record as `assets/*.prompt.txt`. Do not trust it and do not
reuse it wholesale. The owner rejected it for three named reasons, each of which the operator's own
`reads` block already forbids:

1. Its Grammar anatomy says it was "verified against the real consuming block at
   `examples/todo-app-frontend/src/components/blocks/sign-in-form/component.tsx`". The operator's
   `grammar` read names the installed design system as the anatomy source. A direction composed by
   reading the already-implemented screen inverts the order the Work tree encodes: the `ui` record
   decides the look, the direction image shows it, the implementation follows.
2. It cites only proof knowledge. The operator's `knowledge` read asks for composition, presentation,
   proof and family topics. `knowledge/ui/composition/**` and `knowledge/ui/presentation/**` exist and
   are directly on point for these screens; none was applied.
3. It carries no aesthetic or compositional intent at all — no page frame, no emphasis, no hierarchy.
   The owner's words: a login form drawn like that is not a login form.

Re-author each prompt from the operator's own reads. The installed design system is
`@starci/grammar@0.4.13`, family `common`, on HeroUI v3; run `npm ci` in
`examples/todo-app-frontend` and read `node_modules/@starci/grammar/dist/common*.d.ts` and its
README for the anatomy. Read `examples/todo-app-backend/.starciwork/brand/index.yaml` for the brand.

## Boundaries

- Write only under `examples/todo-app-backend/.starciwork/features/*/ui/**`.
- **Do not edit the runtime**: `ops/`, `schemas/`, `checks/`, `scripts/`, `kernel/`, `core/`,
  `model/`, `docs/` outside `docs/examples/`. The owner has ruled `.claude` legacy — it is refactored
  later, from what this run finds. Where the operator commands something this tree cannot supply
  (its `reads`/`writes` still name `N/index.yaml` and `E/…` from an older kernel generation), do not
  improvise and do not fake those paths: name the operator line verbatim, say what this tree has
  instead, and report it. That report is the deliverable, equal in value to the images.
- Keep every YAML parseable by the strict loader: quote scalars containing a comma or a colon inside
  flow mappings.
- Do not commit this file.

## Finish

Run `node scripts/check-example-yaml.mjs` and `node scripts/check-example-work.mjs` from the
repository root and paste both summaries; confirm no refusal names a `ui.*` record. Commit on the
current branch with `git add examples/todo-app-backend/.starciwork/features/*/ui` only, ending the
message with `Co-Authored-By: Codex gpt-5.6-sol <noreply@openai.com>`. Do not push.

Report, structured by the operator's own ids: what each `reads` gave you, what each `writes` received,
each `checks` result, each `blockers` condition you hit, the seven image paths with byte sizes, and
whether the image tool exposed a model name.

The lead may send follow-up instructions mid-task; they are legitimate. Do the work yourself.

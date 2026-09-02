# Changes — `fe.source.apply` · `invocation-a3-continue-learning-2`

This is the worked example the template is enforced against. It describes what a `fe.source.apply`
step would write after `fe.presentation.resolve` resolved `dashboard/ContinueLearning`: two files in
the frontend checkout, nothing committed, one receipt beside this record.

## Binding

| Field | Value |
| --- | --- |
| Operator | `fe.source.apply` |
| Invocation | `invocation-a3-continue-learning-2` |
| Receipt | `@dynamic/fe-source-application.json` |
| Checkout | `@workspaces/fe` at `14e0c20f` → uncommitted |
| Predecessor | `@dynamic/fe-presentation-resolution.json` |

## Files

| Path | Change | Why | Claims |
| --- | --- | --- | --- |
| `src/components/blocks/dashboard/ContinueLearning/classNames.ts` | modified | the collection grid resolves to GAP-4 Case 2, replacing `gap-2` | GAP-4 |
| `src/components/blocks/dashboard/ContinueLearning/component.tsx` | modified | the identity pair carries its claim on the app-owned column | GAP-1 |
| `src/components/blocks/dashboard/ContinueLearning/component.spec.tsx` | unchanged | no assertion names a class | — |

## What the next step must know

- Gates to run: `lint:check`, `typecheck`, `test:unit` scoped to `blocks/dashboard/ContinueLearning`.
- Surfaces to observe: the dashboard route at `md` and `xl`, the resume card in `ready` and `pending`.
- Not changed on purpose: `index.tsx`, because the block's public export and props did not move.

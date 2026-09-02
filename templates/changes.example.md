# changes — fe.source.apply step-4-1

`fe.source.apply` projected the resolved tree for the subscriptions route onto two declared paths of
the frontend checkout, bound to the direction decided in step 2-1 and the presentation resolved in
step 3-1. Nothing outside the declared write set was touched.

## Binding

| Field | Value |
| --- | --- |
| Operator | `fe.source.apply` |
| Step | `step-4-1` |
| Checkout | `@workspaces/fe` at `14e0c20…` → `uncommitted` |
| Predecessor | `../step-3-1/response.md` |

## Files

| Path | Change | Why | Claims |
| --- | --- | --- | --- |
| `src/blocks/commerce/ProSubscriptionBlock/index.tsx` | modified | resolved tree replaces the app-owned gap and padding classes with the rules the resolution selected | GAP-3, PADDING-4 |
| `src/blocks/commerce/ProSubscriptionBlock/PlanCard.tsx` | created | new leaf the direction introduced for one plan | SURFACE-2, TONE-1 |

## What the next step must know

- Gates to run: `lint`, `typecheck`, `test:unit` for `src/blocks/commerce/**`.
- Surfaces to observe: `/subscriptions` at mobile and desktop, light and dark.
- Not changed on purpose: `src/blocks/commerce/ProSubscriptionBlock/index.stories.tsx` stays until the story audit runs after `fe.surface.audit`.

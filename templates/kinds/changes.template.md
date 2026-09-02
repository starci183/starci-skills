# changes — <operator.id> step-<N>-<M>

One paragraph: what this step changed, in which checkout, at which head. Written by the step that
wrote source (`backend.implement`, `fe.source.apply`) as `changes.md` in its own step folder; read
unchanged by the next steps (`quality.verify`, `fe.surface.audit`, `git.publish`) through their
request.md Inputs table as `../step-N-M/changes.md`.

## Binding

| Field | Value |
| --- | --- |
| Operator | `<operator.id>` |
| Step | `step-<N>-<M>` |
| Checkout | `@workspaces/<role>` at `<sourceHead before>` → `<sourceHead after, or uncommitted>` |
| Predecessor | `../step-<N>-<M>/response.md` of the step whose decision this change applies |

## Files

| Path | Change | Why | Claims |
| --- | --- | --- | --- |
| `<checkout-relative path>` | created | the decision this file carries | rule ids written into it, or — |

## What the next step must know

- Gates to run: the gate names the checkout pins for these paths.
- Surfaces to observe: the routes or blocks whose rendered output changed.
- Not changed on purpose: paths a reader might expect, and why they stayed.

```json template-contract
{
  "kind": "changes",
  "applies": [],
  "example": "templates/changes.example.md",
  "title": "^# changes — [a-z]+(?:\\.[a-z]+)+ step-\\d+-\\d+$",
  "sections": [
    { "en": "^## Binding$", "table": "| Field | Value |", "rows": ["Operator", "Step", "Checkout", "Predecessor"] },
    { "en": "^## Files$", "table": "| Path | Change | Why | Claims |", "minRows": 1, "cell": { "Change": "^(created|modified|deleted|unchanged)$" } },
    { "en": "^## What the next step must know$" }
  ],
  "rules": null
}
```

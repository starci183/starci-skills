# changes — operator.id step-1/parallel-1

One paragraph: what this step changed, in which checkout, at which head. Written by the step that
wrote source (`backend.implement`, `fe.source.apply`) as `response/changes.md`; read unchanged by the
next steps (`quality.verify`, `fe.surface.audit`, `git.publish`) through their `request.json` inputs.

## Binding

| Field | Value |
| --- | --- |
| Operator | `operator.id` |
| Step | `step-1/parallel-1` |
| Checkout | `@workspaces/role` at `head before` → `head after, or uncommitted` |
| Predecessor | `step-1/parallel-1/response/response.md` of the step whose decision this change applies |

## Files

| Path | Change | Why | Claims |
| --- | --- | --- | --- |
| `checkout-relative/path.tsx` | created | the decision this file carries | rule ids written into it, or — |

## What the next step must know

- Gates to run: the gate names the checkout pins for these paths.
- Surfaces to observe: the routes or blocks whose rendered output changed.
- Not changed on purpose: paths a reader might expect, and why they stayed.

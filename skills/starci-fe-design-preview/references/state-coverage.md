# State coverage

State completeness is evaluated by the owner that can change, not by one flat page checklist.

| Owner | Candidate states to classify |
|---|---|
| `block` | loading, empty, populated, recoverable error, terminal/unavailable error, pending action, disabled action, optimistic/stale state, keyboard/focus where interactive |
| `page` | route entry, authenticated/guest redirect, page orchestration loading, partial availability, full content, page-level failure only when the page owns it |
| `layout` | desktop/mobile, guest/authenticated, active navigation, overflow/collapse, light/dark, persistent loading only for layout-owned data |
| `overlay` | trigger/closed context, opening, open, validation error, submitting, success, backend error, dismissal and focus return |

Only classify states that the product and owner can enter. For each candidate use:

```json
{
  "ownerId": "block-daily-quest",
  "state": "loading",
  "coverage": "rendered | covered-by | not-applicable",
  "scenarioId": "case-a-loading",
  "evidence": "query state or reason it cannot occur"
}
```

## Integrated scenarios

Avoid Cartesian explosion. Prefer a small scenario set whose entries name every owner state they
cover—for example, a stable authenticated layout plus a loading dashboard page plus a populated
account-menu trigger. `covered-by` is valid only when the referenced scenario visibly proves the
same owner's behavior.

## Loading truth

- Preserve resting width, height, row count and separators.
- Skeleton only unresolved content; keep static labels and known values visible.
- Do not show a resting value and skeleton for the same slot.
- Repeated contracts use their declared resting count.
- Pending actions show vendor-supported loading, block duplicate actions and keep accessible names.
- If independent queries resolve independently, preview partial availability rather than a fake
  all-page loader.

## Responsive and theme truth

Render desktop/mobile and light/dark only where the target supports them, but never mark them N/A
without source or product evidence. Persistent layouts and overlays usually require both responsive
and focus/keyboard coverage even when a screenshot shows one desktop state.

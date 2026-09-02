# Changes — `<operator.id>` · `<invocationId>`

One paragraph: what this step changed, in which checkout, at which head, under which receipt. Written
by the step that wrote source (`backend.implement`, `fe.source.apply`) into its own `@dynamic` folder;
read unchanged by the next steps (`quality.verify`, `fe.surface.audit`, `git.publish`) as
`@dynamic/changes.md`.

## Binding

| Field | Value |
| --- | --- |
| Operator | `<operator.id>` |
| Invocation | `<invocationId>` |
| Receipt | `@dynamic/<receiptType>.json` |
| Checkout | `@workspaces/<role>` at `<sourceHead before>` → `<sourceHead after, or uncommitted>` |
| Predecessor | `@dynamic/<predecessor receiptType>.json` |

## Files

| Path | Change | Why | Claims |
| --- | --- | --- | --- |
| `<checkout-relative path>` | created / modified / deleted / unchanged | the receipt decision this file carries | rule ids written into it, or — |

## What the next step must know

- Gates to run: the gate names the checkout pins for these paths.
- Surfaces to observe: the routes or blocks whose rendered output changed.
- Not changed on purpose: paths a reader might expect, and why they stayed.

```json template-contract
{
  "kind": "changes",
  "applies": ["templates/changes.example.md"],
  "title": { "en": "^# Changes — `[a-z.]+` · `[A-Za-z0-9._-]+`$", "vi": "^# Thay đổi — `[a-z.]+` · `[A-Za-z0-9._-]+`$" },
  "sections": [
    { "en": "^## Binding$", "vi": "^## Ràng buộc$", "table": { "en": "| Field | Value |", "vi": "| Trường | Giá trị |" } },
    { "en": "^## Files$", "vi": "^## File$", "table": { "en": "| Path | Change | Why | Claims |", "vi": "| Đường dẫn | Thay đổi | Vì sao | Claim |" } },
    { "en": "^## What the next step must know$", "vi": "^## Bước kế tiếp cần biết gì$" }
  ],
  "rules": null
}
```

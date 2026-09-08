# frontend-source-application — target-id

## Binding

| Field | Value |
| --- | --- |
| Target | `target-id` |
| Mode | `apply` |
| Branch | `session/s-2026-09-03-1` |
| Base | `0f1e2d3c4b5a69788796a5b4c3d2e1f009182736` |
| Commit | `9a8b7c6d5e4f30211203344556677889900aabbc` |

## Projection

| Path | Change | Classes | Claims | Why |
| --- | --- | --- | --- | --- |
| `app/target/page.tsx` | modified | `gap-6` | `GAP-5` | the region stack takes the resolved gap |
| `app/target/canvas.tsx` | created | — | — | an application-owned leaf carrying its contract, never its logic |

## Rejections

| Path | Value | Because |
| --- | --- | --- |
| `app/shell/layout.tsx` | `gap-8` | outside the declared write set |

## Fallbacks taken

| Code | Action |
| --- | --- |
| `CODE` | what the fallback did; no rows when none was taken |

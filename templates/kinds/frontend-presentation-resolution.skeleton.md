# frontend-presentation-resolution — target-id

## Owner map

| Node | Property | Owner | Rule |
| --- | --- | --- | --- |
| `body>main>div[0]` | gap | app | `GAP-5` |
| `body>main>div[0]>section` | padding | grammar | `PADDING-4` |

## Rules chosen

| Node | Rule | Class | Condition |
| --- | --- | --- | --- |
| `body>main>div[0]` | `GAP-5` | `gap-6` | the published case the observed condition matched |

## Removed

| Node | Class | Because |
| --- | --- | --- |
| `body>main>div[0]>section` | `p-4` | reimplements an owned relationship |
| `body>main>div[0]>section>span` | `text-accent-soft-foreground` | refused by SURFACE-4 Case 2 |

## Gaps

| Node | Property | Missing path |
| --- | --- | --- |
| `body>aside` | gap | Common exposes no public path for the compact identity pair; no rows when none was found |

## Fallbacks taken

| Code | Action |
| --- | --- |
| `CODE` | what the fallback did; no rows when none was taken |

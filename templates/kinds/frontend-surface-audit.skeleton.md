# frontend-surface-audit — target-id

## Matrix

| Matrix | Viewport | Scheme | State | Screenshot |
| --- | --- | --- | --- | --- |
| `wide-light-loaded` | 1440x900 | light | loaded | `response/artifacts/wide-light-loaded.png` |

## Verdicts by owner

| Matrix | Owner | Node | Rule | Measured | Verdict |
| --- | --- | --- | --- | --- | --- |
| `wide-light-loaded` | app | `body>main` | `GAP-5` | 1.5rem | pass |
| `wide-light-loaded` | grammar | `body>main>section` | `PADDING-4` | 1rem | pass |

## Regressions

| Matrix | Node | Rule | Measured | Routes to |
| --- | --- | --- | --- | --- |
| `narrow-light-loaded` | `body>main` | `GAP-5` | 1rem | resolve |

## Grammar gaps

| Component | Rule | What the family lacks |
| --- | --- | --- |
| `SurfaceCard` | `PADDING-4` | the component renders its own inset one step low; no rows when the family holds |

## Fallbacks taken

| Code | Action |
| --- | --- |
| `CODE` | what the fallback did; no rows when none was taken |

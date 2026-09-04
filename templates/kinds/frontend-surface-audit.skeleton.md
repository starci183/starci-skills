# frontend-surface-audit — target-id

## Served surface

| Field | Value |
| --- | --- |
| Applied commit | `0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c` |
| Served branch | `uat` |
| Served head | `9a8b7c6d5e4f30211203f4e5d6c7b8a99a8b7c6d` |
| Contains applied commit | yes |
| Browser profile | `.worktrees/sessions/<sessionId>/browser` |
| Family version observed | `0.4.7` |
| Family version resolved against | `0.4.7` |

## Audit scope

| Field | Value |
| --- | --- |
| Mode | primary-surfaces |
| Selected surfaces | target-id |
| Coverage claim | selected-surfaces |
| Deferred states | — |

## Surface class

| Class | Declared by |
| --- | --- |
| `console` | `frontend-direction-decision`, whose coverage names the class every banded proof rule reads |

## Matrix

| Matrix | Viewport | Scheme | State | Screenshot |
| --- | --- | --- | --- | --- |
| `wide-light-loaded` | 1440x900 | light | loaded | `response/artifacts/wide-light-loaded.png` |

## Verdicts by owner

| Matrix | Owner | Node | Rule | Measured | Verdict |
| --- | --- | --- | --- | --- | --- |
| `wide-light-loaded` | app | `body>main` | `GAP-5` | 1.5rem | pass |
| `wide-light-loaded` | grammar | `body>main>section` | `PADDING-4` | 1rem | pass |

## Taste

| Rule | Measured | Score | Verdict |
| --- | --- | --- | --- |
| `TASTE-1` | the plan title is the largest and heaviest element; the next candidate is 40% lighter | 5 | pass |
| `TASTE-2` | the tallest content-free band measures 32px and separates two regions | 4 | pass |
| `TASTE-3` | every stacked text block resolves to x=32; both gutters measure 24px | 5 | pass |
| `TASTE-4` | region 48px > section 24px > row 16px, and the order survives at 390px | 4 | pass |
| `TASTE-5` | one accent-filled call to action; four hues, all published palette roles | 4 | pass |
| `TASTE-6` | three rendered sizes and two weights per region; the paragraph measures 62 characters | 4 | pass |
| `TASTE-7` | two radius steps, one family; deepest card nesting is two levels | 4 | pass |
| `TASTE-8` | one image, carrying the promise's subject, lighter than the focal element | 4 | pass |
| `TASTE-9` | content and action rectangles sum to 63% of the captured area | 4 | pass |
| `TASTE-10` | skeleton, empty and error captures hold the same regions at the same ranks | 4 | pass |
| `TASTE-11` | every target measures at least 44x44; hover and focus differ without moving a pixel | 4 | pass |
| `TASTE-12` | sorted into the same class as the references the direction named | 4 | pass |

- Mean: 4.17
- Verdict: ship

## Calibration

| Anchor | Expected | Scored |
| --- | --- | --- |
| `anchor-low` | taste 1–2 | 2 |
| `anchor-mid` | taste 3–3 | 3 |
| `anchor-high` | taste 4–5 | 4 |

## Ranked against

| Sheet | Why |
| --- | --- |
| `other-surface-id` | the other selected surface of this scope, scored in the same round on the same scale; no rows when the scope selects one surface, whose scale is the three anchors alone |

## Verdict

| Topic | Verdict | Route |
| --- | --- | --- |
| `presentation` | pass | none |
| `composition` | pass | none |
| `responsive` | pass | none |
| `motion` | pass | none |
| `accessibility` | pass | none |
| `contrast` | pass | none |
| `render-truth` | pass | none |
| `taste` | ship | none |

## Coverage gaps

| Topic | Missing state |
| --- | --- |
| `composition` | the missing state the matrix left out; no rows when the matrix covers every state the direction's coverage declares |

## Regressions

| Matrix | Node | Rule | Measured | Routes to |
| --- | --- | --- | --- | --- |
| `narrow-light-loaded` | `body>main` | `GAP-5` | 1rem | resolve |

## Grammar gaps

| Component | Rule | What the family lacks |
| --- | --- | --- |
| `SurfaceCard` | `PADDING-4` | the component renders its own inset one step low; no rows when the family holds |

## Printed

| Artifact | Why |
| --- | --- |
| http://127.0.0.1:60000/ | the served sheet: every matrix entry beside its verdicts, handed over at the moment the verdict was recorded |
| `response/artifacts/narrow-light-loaded.png` | the worst-scoring capture of the taste topic, so the person sees what the score was taken from |

## Fallbacks taken

| Code | Action |
| --- | --- |
| `CODE` | what the fallback did; no rows when none was taken |

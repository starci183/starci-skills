# StarCi Core — Media

This file maps the `MEDIA-n` rules to the live Core family: the one media frame, its ratios, fit,
treatment, caption, and what it cannot yet represent. `gap` in the last column means Common
publishes no owner for the case. Asset selection, generation, rights, and alt words stay with the
feature workflow; Grammar only presents the approved outcome.

The one renderer is `MediaFrame { children, caption?, aspect?: "landscape" | "portrait" | "square" |
"auto", fit?: "cover" | "contain", treatment?: "framed" | "plain", className? }`, defaults
`landscape`, `cover`, `framed`. It renders a `<figure class="starci-core-media-frame">` carrying
`data-grammar-media-aspect`, `data-grammar-media-fit`, and `data-grammar-media-treatment`, a viewport
`div[data-grammar-media="true"]`, and an optional `figcaption.starci-core-media-caption`.

## MEDIA-1 — Choose one explicit user job

Media exists for one named job and is presented through the one Common frame.

| Case | Rule | Common owner | Core realization |
| --- | --- | --- | --- |
| Case 1 | The job is named before the asset | No Common owner by design: the job, the asset, and its rights are feature-workflow decisions | Nothing to paint |
| Case 2 | The approved asset is presented | `MediaFrame` with `aspect`, `fit`, and `treatment` chosen from that job; the asset is the app-supplied child | Viewport border `--starci-core-border`, radius `--starci-core-surface-radius`, background `--starci-core-surface-secondary` |
| Case 3 | A parallel frame is tempting | `className` is the only published hook and it lands on the `<figure>`, not on the viewport or the child | Core publishes no second frame |

Source: packages/grammar/src/common/renderers.ts → packages/grammar/src/core/primitive/MediaFrame/index.tsx

## MEDIA-2 — Aspect and crop preserve the subject

A crop-safe asset may use `cover` inside a published ratio; a declared focal region must stay fully
visible at every width.

| Case | Rule | Common owner | Core realization |
| --- | --- | --- | --- |
| Case 1 | Published ratios | `aspect` → `aspect-ratio: 16 / 10` (`landscape`), `4 / 5` (`portrait`), `1` (`square`); `auto` sets no ratio | Inherited unchanged |
| Case 2 | Cover only when crop-safe | `fit` (default `cover`) → `object-fit: cover` on a direct `img`, `picture`, `video`, or `svg` child at `width: 100%; height: 100%` | Inherited unchanged |
| Case 3 | A non-centred focal point | `gap` — no `object-position` or focal prop, and `className` reaches the figure rather than the viewport child, so a required off-centre crop has no owner | Nothing to paint |

Source: packages/grammar/src/core/primitive/MediaFrame/index.tsx; packages/grammar/src/common/styles.css

## MEDIA-3 — Diagrams and marks use contain

When every pixel carries meaning the frame contains, and it draws a boundary only where no other
material already owns the edge.

| Case | Rule | Common owner | Core realization |
| --- | --- | --- | --- |
| Case 1 | Nothing may be cropped | `fit="contain"` → `object-fit: contain` on the same child selector | Inherited unchanged |
| Case 2 | An independent region | `treatment="framed"` (default) → viewport with `1px` border, radius, and the secondary surface | Border and surface tokens resolve to `--starci-core-border` and `--starci-core-surface-secondary`; the border becomes `CanvasText` under forced colours |
| Case 3 | Surrounding material owns the edge | `treatment="plain"` → `border-color: transparent; background: transparent` on the viewport | Inherited unchanged |

Source: packages/grammar/src/core/primitive/MediaFrame/index.tsx; packages/grammar/src/common/styles.css

## MEDIA-4 — Accessibility intent and caption are explicit

The alternative text lives on the asset, the caption on the figure, and neither repeats the other.

| Case | Rule | Common owner | Core realization |
| --- | --- | --- | --- |
| Case 1 | Informative or decorative alternative | Owned by the app-supplied child (`alt` on `img`); `MediaFrame` publishes no `alt` prop | Nothing to paint |
| Case 2 | Visible context, credit, or instruction | `caption?: ReactNode` → `figcaption.starci-core-media-caption` inside the `<figure>`; the figure carries no `aria-labelledby`, so the relationship is the native figure/figcaption one | Caption typography inherits the Core foreground token |
| Case 3 | One identity, not three | No Common enforcement; the app owns the alt, caption, and nearby heading words | Nothing to paint |

Source: packages/grammar/src/core/primitive/MediaFrame/index.tsx

## MEDIA-5 — Loading and failure preserve the task

A slow or failed asset keeps the frame's geometry and an honest representation.

| Case | Rule | Common owner | Core realization |
| --- | --- | --- | --- |
| Case 1 | Reserved geometry | The viewport's `aspect-ratio` holds whether or not the child painted, so the frame does not collapse | Inherited unchanged |
| Case 2 | Loading or error representation | `gap` — `MediaFrame` publishes no loading or error prop and renders no state; the same gap is recorded in [Family and DNA](family.md) | Nothing to paint |

Source: packages/grammar/src/core/primitive/MediaFrame/index.tsx; packages/grammar/src/common/styles.css

## MEDIA-6 — Provenance and generated-media truth

Source, rights, and generation decisions are feature evidence; the frame proves nothing about them.

| Case | Rule | Common owner | Core realization |
| --- | --- | --- | --- |
| Case 1 | Rights and source retained | No Common owner by design; `MediaFrame` presents only | Nothing to paint |
| Case 2 | The frame is cited as approval | `MediaFrame` has no provenance, brief, or generation input, so its presence carries no such claim | Nothing to paint |

Source: packages/grammar/src/core/primitive/MediaFrame/index.tsx

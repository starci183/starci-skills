# Font presentation

This file answers one question: given a line of copy the application has already ranked, which public
typography prop renders it?

Composition has already chosen the DOM tree and the Grammar objects. The application decides the
information rank. Grammar renders that rank. The application never writes a size, weight, line height,
or tracking class, and never overrides typography inside another Grammar component.

## Scale

The type scale is closed and shared by `Text` and `Heading`. The rule ID is the ordinal position on
that scale, smallest first. It is not a Tailwind step and not a heading level.

| Rule | Rendered | `Text` | `Heading` |
| --- | --- | --- | --- |
| FONT-1 | `text-xs` / `leading-4` | `size="xs"` | `level={4}` |
| FONT-2 | `text-sm` / `leading-5` | `size="sm"` | `level={3}` |
| FONT-3 | `text-base` / `leading-6` | `size="md"`, the default | `level={2}` |
| FONT-4 | `text-xl` | none | `level={1}` |
| FONT-5 | `text-3xl` / `leading-9` | `size="metric-lead"` | none |
| FONT-6 | `text-4xl` / `leading-tight` | none | `scale="display"` |

`Text` and `Heading` are not interchangeable at the same size. A heading declares document structure;
a text line does not. Choosing `Heading` to obtain a size, or `Text` to avoid an outline entry, is a
structure error rather than a typography one.

Tracking is not an application decision. `Heading` applies `tracking-tight` at FONT-4 and FONT-6 only.

## Owner

Typography belongs to Grammar. The owner cell names which component renders the rank.

| Owner | Meaning | Application writes |
| --- | --- | --- |
| A component name | `Text` or `Heading` renders this rank | The prop only |
| `—` | The rank has no public prop | Nothing. Report the gap |

There is no `App` owner in this file. An application typography class is `APP_OVERRIDE`, and a raw
`font-size` or `font-weight` that changes semantic rank is rejected even when the pixels match.

## FONT-1 — `text-xs` / `leading-4`

The smallest public size, for the lowest rank of supporting information.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Brief metadata that stays understandable at the smallest size | `Text` | `<Text size="xs">Optional</Text>` |
| Case 2 | The label of a nested region inside an already-titled section | `Heading` | `<Heading level={4}>Card details</Heading>` |

`Text size="xs"` always resolves to muted and cannot be promoted to another tone. `Heading level={4}`
carries the same muted treatment.

Not this rule: ordinary sentences, or any fact the reader must not miss. Use FONT-2 or FONT-3.

## FONT-2 — `text-sm` / `leading-5`

A compact reading size for supporting copy that still forms complete lines.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A complete line ranked below normal body copy, such as a timestamp or short fact | `Text` | `<Text size="sm">Updated 2 minutes ago</Text>` |
| Case 2 | A third-level region heading inside a section | `Heading` | `<Heading level={3}>Payment method</Heading>` |

Not this rule: shrinking body copy so it fits a container that is too small. Fix the container.

## FONT-3 — `text-base` / `leading-6`

The normal reading size, and the resolved default when no size is given.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Ordinary explanatory copy with normal reading priority | `Text` | `<Text>Your subscription renews on 12 March.</Text>` |
| Case 2 | The heading of a section inside a page | `Heading` | `<Heading level={2}>Billing</Heading>` |

## FONT-4 — `text-xl`

The page-level heading size, carrying tight tracking.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | The single heading that names the whole page or route | `Heading` | `<Heading level={1}>Account</Heading>` |

Not this rule: a second `level={1}` on the same page. One document, one top-level heading.

## FONT-5 — `text-3xl` / `leading-9`

A large numeric treatment for one already-important value.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | The single leading metric or short value that is the main fact of its region | `Text` | `<Text size="metric-lead" weight="semibold">84%</Text>` |

Not this rule: sentences, decoration, or imitating a heading. It creates no heading semantics.

## FONT-6 — `text-4xl` / `leading-tight`

Display emphasis applied to a heading that keeps its semantic level.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A page-root heading that must carry marketing or landing weight | `Heading` | `<Heading level={1} scale="display">Learn without limits</Heading>` |

Not this rule: raising the visual size of a nested heading. `scale` changes the recipe, never the
outline position.

## Weight

Weight is a second axis, not a position on the size scale. Its public set is closed.

| Prop | Rendered | Use for |
| --- | --- | --- |
| `weight="normal"` | `font-normal`, the default | Reading copy and ordinary facts |
| `weight="medium"` | `font-medium` | A compact label, or a title above its own description |
| `weight="semibold"` | `font-semibold` | A fact that must be found first within its region |

Weight refines a rank the application has already chosen. It never manufactures a new hierarchy
level, and it never substitutes for a heading. `Heading` applies its own weight per level and takes
no weight prop.

Bold beyond `semibold` has no public prop. Treat an intent that needs it as a gap rather than writing
a class.

## What this file does not decide

Which colour expresses the rank is [Tone](tone.md). How the line wraps, aligns, or truncates is
[Text flow](text-flow.md). How much room the text region gets is [Measure](measure.md).

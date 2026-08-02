# The REGION model — a shared vocabulary for the parts of a layout

> Placing a new component starts by NAMING THE REGION it belongs to, and only then styling it. A
> region is the building block of a layout, and each region owns its own padding, sticky behaviour
> and width ([Calcite
> Shell](https://developers.arcgis.com/calcite-design-system/foundations/layouts/) · [Fluent 2
> layout](https://fluent2.microsoft.design/layout)). Every design system that scales past a handful
> of pages ends up with a list like this one, because without shared names for the parts, two
> developers describing the same screen cannot tell whether they disagree.

## The shells, and the regions each one owns

| Shell | Regions |
|---|---|
| **Global layout** (wraps EVERY page) | navbar, fixed height and sticky · ambient background · content · footer, on public pages only · overlay containers for modals and drawers · route-progress indicator |
| **Documentation shell** (three or four columns) | icon rail · content-tree rail · reading column, which owns the measure and the padding · on-this-page rail · a full-bleed opt-out |
| **Two-pane manage shell** | collapsible rail, sticky · centered content column |
| **Page container** | one centered column at a capped width plus a gutter |

A shell is a contract about who owns what. The value of writing it down is that a feature can then
be told, in one sentence, which regions it may fill and which it must not touch.

## The vocabulary — put the component in the right region

- **navbar** (top, fixed height) and **navbar bottom layer** (a tab strip attached below the navbar,
  used by hub surfaces).
- **icon-rail** (surface-to-surface navigation, narrow, large breakpoints only) · **content-rail**
  (a tree or list of content, on the left) · **reading-col** (the main content, and it owns the
  measure) · **on-this-page** (the orientation rail on the right).
- **CTA-anchor** (the primary action, whether in a hero or a sticky bar) · **bottom-bar** (the
  mobile sticky action bar) · **workspace-pane** (the second pane of a full-bleed work surface —
  [`full-bleed-work-surface.md`](full-bleed-work-surface.md)).

## The rules

- **A new component starts with the question "which region?"** Global nav goes to the navbar or its
  bottom layer; browsing a list goes to the content rail; the main content goes to the reading
  column; something contextual and secondary goes to the on-this-page rail; the main action goes to
  the CTA anchor; a tool used while working goes to the workspace pane. A component that fits no
  region is a signal about the layout, not a licence to invent a region inline.
- **A region owns its own chrome.** The reading column owns its padding and its measure; a rail owns
  its sticky behaviour and its width. A feature never declares the column's padding itself, because
  the shell already does, and padding declared twice is padding nobody can predict.
- **Measure belongs to the COLUMN, not to the renderer.** The maximum width is the reading column's
  job, never the markdown or rich-text renderer's. Put it in the renderer and every other consumer
  of that renderer — a card, a tooltip, a drawer — inherits a width it did not ask for. This is the
  same separation Every Layout argues for: layout primitives compose because each one does exactly
  one thing to its children.

## Related

[`page-shell-selection.md`](page-shell-selection.md) ·
[`surface-job-drives-layout.md`](surface-job-drives-layout.md) ·
[`responsive-regions.md`](responsive-regions.md).

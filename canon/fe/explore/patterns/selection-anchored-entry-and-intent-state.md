# A selection-anchored entry point, and intent state that survives the surface mounting — STRICT

> The interaction is the text-selection toolbar every operating system and document editor has taught
> people to expect: select a passage, act on it in place. Applied to an assistant panel it becomes a
> source-anchored question, the pattern popularised by document-grounded research tools. Part two is
> not an interaction pattern at all — it is the lifecycle bug that kills part one silently.

## Part 1 — the selection-anchored entry point

Worked example: a documentation reader with an assistant panel. Highlighting a passage in the article
raises a floating button that opens the assistant scoped to that passage.

**Listen to the selection within the reading scope only** — the article container, not the whole
document. On pointer release, show the button only when the selection's common ancestor is inside
that scope and the selected text is long enough to be a real passage rather than a stray click-drag.
Without the scope check the button appears over the navigation, the footer and the reader's own
accidental double-click.

**The floating button is portalled to the document body and positioned fixed**, placed from the
selection's bounding rectangle, above the text, at a z-index above any floating action button but
below the panel it opens. Its wrapper needs a pointer-down handler that prevents the default,
because pointer-down normally collapses the selection before the click fires — the button would open
an assistant scoped to nothing. Hide it when the selection collapses, and on scroll or resize, when
the rectangle has drifted away from the text it was measured against.

**Pass the selected passage through a store as a plain string**, not by lifting component state or
attaching data to the portal. The button sets it and opens the panel; the panel reads it. The panel
remounts on every open, so the value has to live outside the panel's component tree.

**Getting the passage to the model is a prepended quote**, capped at roughly two hundred characters,
on the front of the question. The retrieval context already carries the full document; the quote only
has to point at the right place in it.

**A locked region gets the correct behaviour for free.** A region behind a paywall renders with text
selection disabled, so nothing can be selected, so the button never appears over content the reader
has not unlocked. That matches the access rule without a second check to keep in step.

## Part 2 — intent state set before a surface opens must not be reset on mount

This is the general form of the trap above, and it reaches well past assistant panels.

**The trap.** A panel — popover or drawer — **remounts every time it opens**, so an effect written to
reset state "when the source changes" also runs on mount. Put the reset inside that effect and the
value set *immediately before opening* is wiped during mount. The feature then dies silently: no
error, no warning, it simply stops having any effect, and it reads as if the value was never set.

**The fix: a separate effect keyed on a previous-value reference.** Hold the previous source in a
ref and reset only when the previous value exists and differs from the current one — a real change of
source, never a mount.

**The general rule.** Intent state — a selection, a draft, a pending action — set **before** a
surface opens must not be reset by that surface in an on-mount effect. Reset only on a genuine source
change, tracked through a ref. This holds for every surface that remounts per open and expects to
receive a value someone just set from outside it.

The same family of bug, one step along: reset a conversation only in the explicit switch and create
handlers, never in an effect keyed on the conversation id. Creating a conversation mid-send also
changes that id, and an effect-based reset would delete the message that was just appended.

## Related

`overlay-from-popover-render-in-panel.md` — a secondary overlay opened from inside this panel ·
`when-drawer.md` — choosing the panel container.

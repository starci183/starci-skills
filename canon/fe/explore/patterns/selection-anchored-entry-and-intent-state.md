# A selection-anchored entry point, and intent state that survives the surface mounting — STRICT

> Read from the Content-AI tutor: highlighting a passage in a lesson raises a floating button that
> opens the chat scoped to that passage, in the style of NotebookLM's source-anchored questions.

## Part 1 — the selection-anchored entry point

**Listen to `window.getSelection()` within the reading scope only** — `#lesson-article`, not the
whole document. On `mouseup` and `touchend`, show the button only when
`range.commonAncestorContainer` is inside that scope and the selected text is long enough to be a
real passage rather than a stray click-drag.

**The floating button is `createPortal(document.body)` with `position: fixed`**, placed from
`range.getBoundingClientRect()` above the selection, at a z-index above the FAB but below the panel
it opens. Its wrapper needs **`onMouseDown` with `preventDefault`**, because mousedown normally
collapses the selection before the click fires and the button would open a chat about nothing. Hide
the button when the selection collapses (`selectionchange`) and on scroll or resize, when the rect
has drifted away from the text.

**Pass the selected passage through the overlay store as a plain string**, not by lifting React
state or attaching data to the portal. The button sets it and opens the panel; the panel reads it.
The panel remounts on every open — popover or drawer — so the value has to live outside the panel's
component tree.

**Getting the passage to the model is a prepended quote**, capped at about 200 characters, on the
front of the question. The grounding already carries the full body, so the quote only has to point
at the right place.

**The premium lock falls out for free.** A locked reading area is `select-none`, so nothing can be
selected, so the button never appears over unopened premium content. That matches the AI gate
without a second check.

## Part 2 — intent state set before a surface opens must not be reset on mount

This is the general form of the trap above, and it applies well beyond the chat panel.

**The trap.** A panel — popover or drawer — **remounts every time it opens**, so an effect that
resets state "when the source changes" runs again on mount. Put `setIntent(null)` inside the
reset-on-content effect and the value set *immediately before opening* is wiped during mount. The
feature then dies silently: no error, it simply stops having any effect.

**The fix: a separate effect keyed on a previous-value ref.** A `useEffect` holding
`prevSourceRef`, resetting only when `prev !== undefined && prev !== source` — a real change of
source, never a mount.

**The general rule.** Intent state — a selection, a draft, a pending action — set **before** a
surface opens must not be reset by that surface in an on-mount effect. Reset only on a genuine
source change, tracked through a ref. This holds for every panel that remounts per open and expects
to receive a value someone just set from outside.

The same family of bug: reset the chat thread only in the explicit switch or create handlers
(`onSwitch`, `onNew`), never in an effect on `[sessionId]`. Creating a session mid-send also changes
the id, and an effect-based reset would delete the turn that was just appended.

## Related

`overlay-from-popover-render-in-panel.md` — a secondary overlay opened from inside this panel ·
`when-drawer.md` — choosing the panel container.

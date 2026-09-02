# Focus proof

This file answers one question: for a reader working without a pointer, where is focus, where can it
go, and where does it come back to?

Focus is only ever proved at runtime. A `:focus-visible` rule in a stylesheet does not establish a
visible indicator, and a correct DOM order does not establish that traversal reached every stop.
Each rule below names the observation that would falsify it.

## FOCUS-1 — The visible indicator sits on the actual target

Governs whether a focused thing looks focused.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | Keyboard focus lands on an interactive or scrollable published owner | An indicator appears on that exact target, identifying it unambiguously. A focused element with no perceivable change falsifies it |
| Case 2 | The indicator sits against adjacent paint or a coloured surface | It remains distinguishable there, in the current computed styles rather than in the intended ones |
| Case 3 | The viewport narrows, the page zooms, or the target sits at a scroll edge | The indicator is not clipped by any ancestor's overflow |
| Case 4 | The application or a family styled over the published owner | The indicator survives. An `outline: none` with no equivalent replacement falsifies it, and hover feedback is not a substitute |
| Case 5 | Focus arrives by pointer rather than by keyboard | The indicator appears only where the published treatment intends it, so its presence still means something |

## FOCUS-2 — Sequential order equals task order

Governs the path focus takes through a composite.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | Tabs, disclosures, navigation peers, or scroll regions create several stops | Visible order, DOM order, and sequential focus order agree with the task dependency. A visual reorder that leaves focus behind falsifies it |
| Case 2 | The composite publishes arrow-key behaviour | Traversal reaches every enabled peer and skips what is disabled or hidden. Arrow focus landing on a disabled peer falsifies it |
| Case 3 | Traversal is run backwards | Reverse order mirrors forward order, and no stop is reachable in only one direction |
| Case 4 | Peers overflow their container, or the layout reflows at a narrower width | Every peer is still reachable, and focusing one brings it into view |
| Case 5 | The application set an explicit tab order | A positive tab index that jumps a later action ahead of earlier required fields falsifies the order; the source order is what should have changed |

## FOCUS-3 — Containment follows modality

Governs how far focus may travel while a region is open.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | A modal region opens above the current task | Focus enters the dialog, stays inside it, reaches an explicit close path, and responds to Escape. Focus escaping to the page behind it falsifies containment |
| Case 2 | The modal closes | Focus returns to the exact control that opened it. A return to the document body falsifies restoration |
| Case 3 | The compact conversation rail is the modal in question | `ChatWorkspace` owns that lifecycle through `isRailOpen` and `onRailOpenChange`; the runtime focus sequence is observed rather than inferred from the vendor name behind it |
| Case 4 | A non-modal region appears beside the task | Focus moves in and out of it freely. A non-modal region that traps focus falsifies it |
| Case 5 | A different reusable modal is needed and no published owner fits | The gap is recorded. Application-local focus machinery is a tracked workaround, never presented as the contract |

## FOCUS-4 — Focus evidence and falsifiers

Governs what closes a focus claim.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | Any focus claim is being closed | The active element, the visible indicator, the computed style, the DOM order, the target rectangle, and the accessibility tree are captured together. A screenshot without an active-element trace closes nothing |
| Case 2 | A branch is conditionally absent | It contributes no focus stop. A visually hidden control still in the sequence falsifies its absence |
| Case 3 | A control is disabled or unavailable | Focus behaves as the published owner intends, and activation produces no effect |
| Case 4 | The page is zoomed or reflowed | Every path above is rerun there, because a ring that fits at one width may be clipped at another |
| Case 5 | A family or the application adds a delta | The isolated published output, the family delta, and the application delta are separated, so the failing layer is named |

## FOCUS-5 — Pointer and keyboard reach the same outcome

Governs parity between input methods across every interactive owner.

| Case | When | Observe |
| --- | --- | --- |
| Case 1 | A whole-surface action, a tab, or a disclosure is exercised | Pointer and keyboard produce the same product outcome. An action available only by pointer falsifies parity |
| Case 2 | One activation is delivered by either route | It produces at most one accepted effect. Two callbacks for one key press falsifies the owner |
| Case 3 | Targets sit near or over one another | Their rectangles do not collide, and no independent control hides behind a whole-surface overlay |
| Case 4 | A required action is revealed by hovering | That falsifies it. A required action is never hover-only |
| Case 5 | The paths are run across default, selected, expanded, disabled, pending, and absent states | Each state is exercised by both routes, and a desktop pointer pass alone closes nothing |

## What this file does not decide

Which reading order the task requires is [Hierarchy](../composition/hierarchy.md), which surfaces are
interactive and which values persist is [State](../composition/state.md), and which effect an
activation may reach is [Action](../composition/action.md). Names, relationships, and target sizes
are [Accessibility](accessibility.md); movement and reduced-motion equivalence are
[Motion](motion.md).

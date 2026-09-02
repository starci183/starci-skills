# Every reachable state remains understandable and operable

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.ui.states-affordance` |
| Operators | frontend decision, implementation, review, and proof |
| Search tags | `loading, empty, error, recovery, label, hover, focus, active, selected, expanded, keyboard, link, href, control, interaction scope` |
| Dependencies | `fe.ui`; approved Behavior and UX authority; routed Grammar |

Render every approved reachable presentation state, including populated, empty, skeleton/loading,
pending, validation, disabled/denied, error, recovery, refresh/resume, and material responsive
branches. State changes preserve context and expose a next action when authority provides one.

Controls expose an understandable label, focus, keyboard path, pending treatment, disabled reason,
validation, and recovery. A destination-bearing row preserves native link semantics and a real non-null `href`; hover, focus, keyboard activation, and click must expose the same route. Native
semantics and platform behavior are preserved unless an approved interaction contract requires a
stronger equivalent.

Interaction feedback is selected by the action's hit-target ownership, never by whether content happens
to contain a title. An inline action inside an otherwise static surface changes only its named text or
CTA: underline may identify the text and a trailing directional glyph may move without recoloring the
surface. A whole-surface action, including a pressable card or disclosure trigger, changes the complete
hit-target material and does not also underline one child title. A non-interactive surface has no hover
answer. Pointer hover, keyboard `focus-visible`, pressed/active, selected, expanded, disabled, and
pending states remain distinguishable; selected or expanded persists after pointer exit, while active
is transient. Motion is supplementary, respects reduced-motion preference, and never carries the sole
state signal.

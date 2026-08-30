# Every reachable state remains understandable and operable

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.ui.states-affordance` |
| Operators | frontend decision, implementation, review, and proof |
| Search tags | `loading, empty, error, recovery, label, focus, keyboard, link, href, control` |
| Dependencies | `fe.ui`; approved Behavior and UX authority; routed Grammar |

Render every approved reachable presentation state, including populated, empty, skeleton/loading,
pending, validation, disabled/denied, error, recovery, refresh/resume, and material responsive
branches. State changes preserve context and expose a next action when authority provides one.

Controls expose an understandable label, focus, keyboard path, pending treatment, disabled reason,
validation, and recovery. A destination-bearing row preserves native link semantics and a real non-null `href`; hover, focus, keyboard activation, and click must expose the same route. Native
semantics and platform behavior are preserved unless an approved interaction contract requires a
stronger equivalent.

# Frontend UX journey review

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.ux-quality-review` |
| Operators | `test/ux-audit, fe/customer-journey` |
| Search tags | `ux, journey, recovery, navigation, refresh, resume, async, realtime, validation` |
| Dependencies | `fe.customer-journey, fe.uat-flow-coverage` |

## Boundary

UX owns task order, interaction containers, navigation, orientation, prevention, feedback timing, recovery, refresh/resume, async/realtime continuity, and the adaptation of backend states into an understandable user path. UX does not choose visual styling, spacing, component tokens, API semantics, or business policy.

Audit every selected case from recognizable entry to terminal. A user must understand current state, consequence, available next action, and how to recover. Invalid input must identify the correction without erasing valid work. Pending work must prevent harmful duplication and explain whether the user may leave, retry, or resume. Refresh/back/close must produce the approved destination and preserve or deliberately discard state.

An unhappy case passes only when the user recognizes failure, performs the documented recovery, avoids stale-state corruption, and reaches success or an authority-backed safe terminal. UX has `PASS`, `FAIL`, and `BLOCKED`; it never uses UI `SUSPENSE`.

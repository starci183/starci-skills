# Product state modeling

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.state-modeling` |
| Operators | `state` |
| Search tags | `business state, block state, unknown, presentation state, safety` |
| Dependencies | `fe.page-model` |

## Record

State comes from business evidence or from a mechanically necessary Block operation. Visual treatment never creates business truth.

## Provenance

Every state has exactly one provenance:

- `business`: directly evidenced by an authoritative contract, endpoint, rule, or supplied requirement;
- `derived-block`: mechanically required by one real Block operation and names that operation;
- `unknown`: material evidence is absent or conflicting.

Unknown state is not a renderable fallback when it affects money, access, entitlement, data loss, legal meaning, identity, security, or terminal outcome. It blocks downstream implementation with an exact evidence request.

## Mapping boundary

The Product Block maps a domain or operation state to a closed neutral presentation state such as `neutral`, `affirmative`, `negative`, `pending`, `selected`, or `disabled`. Grammar sees only that neutral state and applies generic treatment. It must never infer that a check mark means paid, verified, completed, entitled, or successful.

Model default, loading, empty, partial, success, failure, validation, disabled, and recovery only when the owning operation can actually produce them. Record reachability and transition triggers. Reject impossible or decorative states, contradictory simultaneous states, and success treatments without a verified successful outcome.

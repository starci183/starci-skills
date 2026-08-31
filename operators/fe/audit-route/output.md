# `fe/audit-route` output

Scores `7-8` route to one batched repair. A score below `7` routes to reconstruction only when the
evidence contains a structural finding owned by the direct UI boundary. Shared, business, backend,
and runtime-auth findings route to their exact owners. The default reconstruction mode is one
dominant direction; comparison mode is legal only when explicitly requested.

- `output.outcome`: Typed route consumed only by the parent Skill machine.
- `output.result`: Exact selected route, or null when authority/evidence is unavailable.
- `output.gaps`: Exact unresolved authority or evidence gaps.
- `output.evidenceRefs`: Exact review and ownership evidence consumed.

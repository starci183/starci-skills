# Frontend implementation boundaries

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.implementation-boundaries` |
| Contract revision | `7.6.0` |
| Operators | `fe/request-compile, fe/source-apply` |
| Search tags | `implementation, source boundary, block upward, repair, grammar lock` |
| Dependencies | `fe.source-fit, fe.request-lifecycle` |

## Internal apply guidance

Implementation realizes the compiled/generated contract without reopening product design or
reconstructing package-owned lower tiers. It guides `apply`; it is not an implementation stage or
repair route of its own.

Application code normally starts at Blocks and continues through layouts, pages, product data, and state connections. Leaves, branches, or composites may be local only when a resolved effective contract explicitly permits the named extension axis and the request records it. Otherwise use the exact locked export or stop on a Grammar gap.

Preserve selected flow and layout hashes, semantic order, block ownership, responsive transformations, neutral state mapping, package paths, and `global.css` color-token-only policy. Focused checks run after each bounded change.

A repair is in-boundary only when it fixes frontend code, accessibility, data wiring, or rendering
while preserving the compiled contract and source ownership. Page boundaries, Block responsibility,
responsive strategy, persistent behavior, business semantics, package anatomy, or extension policy
changes are typed boundary drift. They do not open a layout checkpoint or a private design loop; the
canonical frontend machine owns its single FE-local repair cycle and typed exit.

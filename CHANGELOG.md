# Changelog

All notable changes are documented here. This project follows Semantic Versioning.

## 6.0.0 - 2026-08-24

### Added

- Twenty-six one-flow `starci-*` skills expressed as validated state machines.
- Global prompt analysis with a generated metadata catalog and schema-validated ephemeral skill selection.
- Eighty-five atomic operators across frontend, backend, business, architecture, quality, deployment, platform, source, test, and workspace domains.
- Closed input and output schemas plus fail-closed validators for every skill and operator.
- Seventy recursively discovered knowledge records, including independent Grammar Common, Core, and Offset Pop contracts and complex cases.
- Deterministic frontend contract export to project-scoped plain JSON with hash reuse and atomic publication.
- Project-scoped Qdrant Edge indexing for operator knowledge and frontend component contracts.
- Business-staleness, frontend-context synchronization, and coding-scope freeze operators.
- Backend repair prerequisite and coding-scope freeze operators that forbid raw source before an approved exact-file boundary.
- Release validation and continuous integration.

### Changed

- Promoted the release tree to the repository root for direct skill discovery.
- Split unrelated entry modes into narrowly discoverable skills; each skill now has one fixed first state while retaining explicit choices, approvals, loops, and terminals inside its flow.
- Made Qdrant a candidate cache rather than authority: selected frontend records are rebound to canonical JSON before source access.
- Restricted Grammar runtime context to Common plus exactly one selected grammar and prohibited business semantics from Grammar.
- Added per-domain context matrices to every materialized skill so each phase declares allowed and forbidden context.
- Made quality debt closure independently proved, finding repair one-finding scoped, and deployment monitoring bounded by attempt/deadline/backoff metadata.
- Preserved rollback as a distinct `rolled-back` terminal that bypasses successful-release business reconciliation.

### Removed

- The V5 context/compiler/facade tree, bilingual mirrors, and monolithic preload route.

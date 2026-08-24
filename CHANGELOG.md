# Changelog

All notable changes are documented here. This project follows Semantic Versioning.

## 6.0.0 - 2026-08-24

### Added

- Twenty-six one-flow `starci-*` skills expressed as validated state machines.
- Global prompt analysis with a generated metadata catalog and schema-validated ephemeral skill selection.
- Eighty atomic operators across frontend, backend, business, architecture, quality, deployment, platform, source, test, and workspace domains.
- Closed input and output schemas plus fail-closed validators for every skill and operator.
- Lazy Qdrant Edge retrieval for operator knowledge.
- Release validation and continuous integration.

### Changed

- Promoted the release tree to the repository root for direct skill discovery.
- Split unrelated entry modes into narrowly discoverable skills; each skill now has one fixed first state while retaining explicit choices, approvals, loops, and terminals inside its flow.

### Removed

- The V5 context/compiler/facade tree, bilingual mirrors, and monolithic preload route.

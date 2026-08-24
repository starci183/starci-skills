# Changelog

All notable changes are documented here. This project follows Semantic Versioning.

## 6.0.0 - 2026-08-24

### Added

- Nine `starci-*` skills expressed as validated state machines.
- Eighty atomic operators across frontend, backend, business, architecture, quality, deployment, platform, source, test, and workspace domains.
- Closed input and output schemas plus fail-closed validators for every skill and operator.
- Lazy Qdrant Edge retrieval for operator knowledge.
- Release validation and continuous integration.

### Changed

- Promoted the release tree to the repository root for direct skill discovery.
- Consolidated overlapping capabilities into analysis-driven machine branches with explicit choices, approvals, loops, and terminal states.

### Removed

- The V5 context/compiler/facade tree, bilingual mirrors, and monolithic preload route.

# Changelog

## 1.2.3 — 2026-09-29

- `starciBeConfig({ sources, plugin, recommended })`, `linterOptions` and `RETIRED` are exported. The factory returns the one flat-config block a repository needs: the canon owns the retired-rule list (checked against the code-pattern manifest) and the warn-to-error lift, so a repository no longer hand-copies `replacedByChecks`.
- `harness-calls-provider-directly` applies only to model harnesses, identified by an LLM provider SDK import, a house model helper or gateway symbol, or a `@harness-kind model` comment - never by the `src/tests/e2e/live/` folder. A live e2e for an identity provider (Keycloak) or any other third party is no longer reported as a model harness with no LLM SDK.

## 1.2.2 — 2026-09-29

- Align module aliases and explicit public `index.ts` exports with HFS capability boundaries. Keep self-aliases, tier-only aliases, folder re-exports, and export-star public entries invalid.
- Accept concrete exceptions in their owning module or feature `errors/` directory, and accept the shared `AbstractException` declaration at its capability root.
- Classify a `.spec.ts` beside its subject in an HFS `src/tests` category as a colocated structural spec. Ordinary unit specs without an adjacent subject remain invalid in test buckets; model-quality harness checks remain in force.

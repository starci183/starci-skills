# Changelog

## 1.5.0 - 2026-09-30

- New: `no-query-in-loop` (R77 `BE_QUERY_IN_LOOP`): a repository, entity-manager or query-builder read (`find`, `findOne`, `count`, `getOne`, a raw `SELECT`) inside a `for`, `for...of`, `for...in` or an array `map`, `forEach`, `flatMap`, `filter`, `reduce`, `some` or `every` callback is one round trip per element (N+1). A polling `while` loop and a write per element are not reported.

## 1.4.0 - 2026-09-30

Round 2 back-end rules (catalog R42, R68 to R76). Every rule below has RuleTester specs and a why code in `modules/kernel/failure-codes.yaml`; each was measured against nivo-backend, starci-next and mia-mia-backend before it shipped and is on at `error`.

- New: `no-interpolated-sql` (R68: SQL text carries no runtime substitution; a constant column list, a `${n}` placeholder, `quoteIdent(...)`, `sqlSetClause(...)` and a ternary of fixed strings are the only substitutions), `query-needs-limit` (R69: `getMany`, `getRawMany`, `find`, `findBy` and a raw `SELECT` state a bound; a lookup by `id` and an aggregate are exempt), `http-needs-timeout` (R70: `fetch` carries a `signal`, axios and HttpService calls carry `timeout` or `signal`, `axios.create` a `timeout`), `no-secret-in-log` (R71: a logger call names no credential and no personal identifier), `no-never-cast` and `no-non-null-assertion` (R72), `async-needs-await` (R73: an `async` function that never awaits; a class that extends or implements, a decorated method and a generator are exempt), `migration-down-reversible` (R74: `down()` exists, is not empty and is not a bare throw), `explicit-handler-return-type` (R75), `json-parse-needs-guard` (R76), and `dto-needs-validator` (R42: every property of an input class carries a `class-validator` decorator).
- New laws: `query-safety`, `resilience`, `log-safety`, `async-discipline`, `input-bounds`; `type-safety` and `schema-authority` gain rules.

## 1.3.0 - 2026-09-29

HFS back-end rules (catalog R18, R20, R34, R36-R38, R40-R45, R48). Every rule below has RuleTester specs and a why code in `modules/kernel/failure-codes.yaml`.

- New: `catch-must-account` (R40), `error-home` (R38), `no-runtime-schema` (R34), `sql-only-in-repository` (R36), `no-entity-in-contract` (R37), `no-untyped-body` and `public-needs-reason` (R41), `no-direct-env-read` (R43), `no-secret-default` (R44), `secret-compare-timing-safe` (R41), `global-module-allowlist`, `typed-module-definition`, `static-module-register`, `no-new-injectable`, `no-module-let`, `one-module-per-file` (R45), `no-inline-suppression` (R18), `file-size-growth` (R20 ratchet; the soft budget is a hfs check report item, not a lint warning), `spec-no-source-read` and `spec-typed-doubles` (R48).
- Fixed: `must-deep-module-import` now holds the HFS owner surface. An aliased import names the owner and stops (`@modules/domain/plan`, `@features/plan`, or the explicit `/index`); a path into a file of another owner is refused, and a tier-only or root alias still is. The retired `lib` tier no longer counts as a tier. `no-folder-reexport` accepts a named `index.ts` surface (`export { X } from "./x"`, `export type { T } from "./contracts"`), and refuses `export *`, a `*_STORE` token, a whole `types` folder and an entry wider than the manifest's `indexExports` (60). Both are on again in `starciBeConfig`.
- Removed: no rule is off. The retired-rule list (`RETIRED`) and its export are gone, and so are the rules it switched off: `exception-name-ends-in-exception`, `exception-code-matches-class-name`, `exception-metadata-type-named-for-class`, `exception-extends-abstract`, `exception-in-errors-folder`, `require-exception-object-arg`, `throw-abstract-exception` (the Academy `AbstractException` family, replaced by `error-home`), `no-handler-encoded-failure` (expected refusals are typed unions), `handler-has-twin-spec`, `no-self-global-module` (replaced by `global-module-allowlist`), `no-line-suppression` and `require-vn-ok-reason` (replaced by `no-inline-suppression`), and the `vn-ok` exemption of `no-non-ascii-source`.
- `starciBeConfig` refuses a recommendation that carries an `off`.
- Slot parameters (the `@Global()` allowlist, the file line budget, the `index.ts` width) are read through `lib/slots.mjs` from `knowledge/hfs/slots.yaml` (`ruleParams.be.globalModules`, `ruleParams.be.fileLines.{soft,hardGrowth}`, and the `indexExports` budget of a `be.*` slot), with the rule catalog's values as the fallback.

## 1.2.3 — 2026-09-29

- `starciBeConfig({ sources, plugin, recommended })`, `linterOptions` and `RETIRED` are exported. The factory returns the one flat-config block a repository needs: the canon owns the retired-rule list (checked against the code-pattern manifest) and the warn-to-error lift, so a repository no longer hand-copies `replacedByChecks`.
- `harness-calls-provider-directly` applies only to model harnesses, identified by an LLM provider SDK import, a house model helper or gateway symbol, or a `@harness-kind model` comment - never by the `src/tests/e2e/live/` folder. A live e2e for an identity provider (Keycloak) or any other third party is no longer reported as a model harness with no LLM SDK.

## 1.2.2 — 2026-09-29

- Align module aliases and explicit public `index.ts` exports with HFS capability boundaries. Keep self-aliases, tier-only aliases, folder re-exports, and export-star public entries invalid.
- Accept concrete exceptions in their owning module or feature `errors/` directory, and accept the shared `AbstractException` declaration at its capability root.
- Classify a `.spec.ts` beside its subject in an HFS `src/tests` category as a colocated structural spec. Ordinary unit specs without an adjacent subject remain invalid in test buckets; model-quality harness checks remain in force.

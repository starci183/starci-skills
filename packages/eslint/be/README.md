# @starci/eslint-canon-be

**78 ESLint rules, from 26 laws, that hold a NestJS-shaped back end to one way of being written.**

Not a style pack. These rules enforce *architecture*: which layer may import which, whether a
failure carries its own identity, where a query is allowed to be built, what an end-to-end test is
permitted to assume. Prettier decides how code looks; this decides what it is allowed to be.

```bash
npm i -D @starci/eslint-canon-be
```

## Use it

```js
import starciBe, { recommended } from "@starci/eslint-canon-be"

export default [
    // …your own ignores, language options and other plugins…
    {
        files: ["src/**/*.ts"],
        plugins: { "starci-be": starciBe },
        rules: recommended,
    },
]
```

Which globs the law applies to is your repository's fact. What the law says is not — so there is no
option to switch a rule off or lower it to a warning.

Prefer the factory, which owns the levels for you:

```js
import starciBe, { recommended, starciBeConfig } from "@starci/eslint-canon-be"

export default [
    // …your own ignores, language options and other plugins…
    starciBeConfig({ sources: ["apps/**/*.ts", "src/**/*.ts"], plugin: starciBe, recommended }),
]
```

It states `warn` as `error` for a zero-warning gate, applies
`noInlineConfig` and unused-disable reporting, and refuses a recommendation that carries a rule switched `off`. HFS
keeps no retired-rule list: a rule the standard no longer holds is deleted from the plugin, and every rule that ships is on.
The parameters a rule takes from the slot manifest (the `@Global()` allowlist, the file line budget, the width of an
`index.ts`) come through `lib/slots.mjs`, which reads `knowledge/hfs/slots.yaml` and falls back to the rule catalog's values.

Also exported: `rules`, `ruleOwners`, `lawOwners`, `starciBeConfig`, `linterOptions`.

## What it actually catches

A sample, not the list:

| Area | What the rules hold |
|---|---|
| **Errors** | A `catch` rethrows, logs through the logger port or returns an outcome carrying its cause; an error lives in its capability's `errors/`, extends `DomainError`, and no bare `Error` or framework exception escapes (`catch-must-account`, `error-home`) |
| **Schema authority** | Migrations only: no `synchronize`, no `migrationsRun`, no runtime DDL, no entity glob; raw SQL only in a persistence repository; no ORM entity in a contract (`no-runtime-schema`, `sql-only-in-repository`, `no-entity-in-contract`) |
| **Config and secrets** | `process.env` only in `platform/config`; no literal default for a secret, password, token, key or URL; secrets compare with `timingSafeEqual` (`no-direct-env-read`, `no-secret-default`, `secret-compare-timing-safe`) |
| **Default deny** | Typed bodies and arguments, no `GraphQLJSON` tunnel, no `switch (operation)`, and `@Public` carries a reason (`no-untyped-body`, `public-needs-reason`) |
| **Module shape** | `@Global()` only on the manifest allowlist; typed `ConfigurableModuleBuilder`; static `register`; one module per file; no `new` of a provider; no module-level `let` |
| **Suppression** | No `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck` or `vn-ok` comment, anywhere (`no-inline-suppression`) |
| **Size** | A file over its line budget is not new and does not grow past its size at the parent commit (`file-size-growth`) |
| **Query safety** | SQL text carries no runtime substitution; a read states `take`, `limit` or `LIMIT` (`no-interpolated-sql`, `query-needs-limit`, `no-query-in-loop`) |
| **Resilience** | An outbound HTTP call states a timeout or signal; `JSON.parse` of outside text sits in a `try` (`http-needs-timeout`, `json-parse-needs-guard`) |
| **Log safety** | A logger call names no credential and no personal identifier (`no-secret-in-log`) |
| **Async and types** | An `async` function awaits; no `as never`, no `x!`; handlers and public methods declare a return type (`async-needs-await`, `no-never-cast`, `no-non-null-assertion`, `explicit-handler-return-type`) |
| **Migrations and input** | A migration's `down()` reverses its `up()`; every property of an input class has a `class-validator` decorator (`migration-down-reversible`, `dto-needs-validator`) |
| **Spec quality** | A spec does not read repository source with `fs`, and doubles are `mock<T>()`, not `as never` (`spec-no-source-read`, `spec-typed-doubles`) |
| **CQRS** | A handler does not assemble an aggregate inline; reads and writes do not share one path |
| **Module layering** | Another owner is imported through its public `index.ts` (`@modules/domain/plan`, `@features/plan`), never through a path into it; an `index.ts` lists a bounded set of named exports, with no `export *`, storage token or types folder; self-aliases and tier-only aliases are refused. |
| **Data access** | Queries stay where the layer says they may be built |
| **Transport** | The wire shape is declared, not inferred from whatever a handler happened to return |
| **Observability** | A failure is logged through the logger port with a typed identity, so a log line can be traced to the law that names it |
| **Testing** | Unit specs sit beside their subjects, including structural specs in HFS `src/tests` categories; a model-quality harness (one that imports an LLM SDK, reaches a house model helper or declares `@harness-kind model`) calls its provider directly; other live e2e specs, such as an identity provider, are not judged as model harnesses. |
| **End-to-end flows** | One file, one flow, named steps, and **never sleep** — poll until the state settles, with a deadline |
| **CDC · event delivery** | Projections and events follow the declared delivery contract |
| **Comments · naming · type safety** | Comments say why; no double cast through `unknown` |

Every rule names the law that declares it — `ruleOwners` maps rule name to law, so a failing build
line leads straight to the document that explains why.

## Companion

- **[@starci/eslint-canon-fe](https://www.npmjs.com/package/@starci/eslint-canon-fe)** — the
  front-end half: 58 rules from 16 laws covering component tiers, structure contracts, the
  fetch/draw split, vendor boundaries and the design-token scale.

## Where the laws live

Each rule is the enforceable half of a written law. The prose — why the rule exists, what it
refuses, which cases sit just outside it — is published openly at
[starci183/starci-claude-skills](https://github.com/starci183/starci-claude-skills).

A rule that cannot be pointed at in real code is a proposal, not a law. Everything here is
pointed at.

## Requirements

ESLint 9+ (flat config), Node 20.9+.

## HFS rules and their why codes

Each rule below reports through the code-pattern gate with a catalogued Vietnamese reason (`modules/kernel/failure-codes.yaml`,
mapped by `scripts/checks/lint-why.mjs`). The catalog id is the rule number in `knowledge/hfs/rules.yaml`.

| Rule | Catalog | Why code |
|---|---|---|
| `catch-must-account` | R40 | `BE_LOGGER_REQUIRED` |
| `error-home` | R38 | `BE_ERROR_HOME` |
| `no-runtime-schema` | R34 | `BE_SCHEMA_AUTHORITY` |
| `sql-only-in-repository` | R36 | `BE_SQL_OUTSIDE_REPOSITORY` |
| `no-entity-in-contract` | R37 | `BE_ENTITY_IN_CONTRACT` |
| `no-untyped-body`, `public-needs-reason`, `secret-compare-timing-safe` | R41 | `BE_DEFAULT_DENY` |
| `no-direct-env-read` | R43 | `BE_CONFIG_OWNER` |
| `no-secret-default` | R44 | `BE_SECRET_DEFAULT` |
| `global-module-allowlist`, `typed-module-definition`, `static-module-register`, `no-new-injectable`, `no-module-let`, `one-module-per-file` | R45 | `BE_MODULE_SHAPE` |
| `no-inline-suppression` | R18 | `HFS_INLINE_SUPPRESSION` |
| `file-size-growth` | R20 | `HFS_SIZE_GROWTH` |
| `spec-no-source-read`, `spec-typed-doubles` | R48 | `BE_SPEC_QUALITY` |
| `must-deep-module-import`, `no-folder-reexport` | R30 | `BE_PUBLIC_SURFACE` |
| `dto-needs-validator` | R42 | `BE_INPUT_BOUNDED` |
| `no-interpolated-sql` | R68 | `BE_SQL_INTERPOLATED` |
| `query-needs-limit` | R69 | `BE_QUERY_UNBOUNDED` |
| `no-query-in-loop` | R77 | `BE_QUERY_IN_LOOP` |
| `http-needs-timeout` | R70 | `BE_HTTP_TIMEOUT` |
| `no-secret-in-log` | R71 | `BE_LOG_SECRET` |
| `no-never-cast`, `no-non-null-assertion` | R72 | `BE_TYPE_ESCAPE` |
| `async-needs-await` | R73 | `BE_ASYNC_NO_AWAIT` |
| `migration-down-reversible` | R74 | `BE_MIGRATION_REVERSIBLE` |
| `explicit-handler-return-type` | R75 | `BE_RETURN_TYPE` |
| `json-parse-needs-guard` | R76 | `BE_JSON_PARSE_UNGUARDED` |

There is no soft size-limit lint rule: a warning under a zero-warning gate is an exception in disguise. Listing files over the soft budget (`ruleParams.be.fileLines.soft`) is a report item of the hfs check or the architecture machine, as migration backlog, and never blocks.

The tier direction matrix and the feature-imports-feature ban (R26, R28) are owned by the architecture machine
(`@starci/hfs`), not by a lint rule: they need the whole import graph.

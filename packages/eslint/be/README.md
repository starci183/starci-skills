# @starci/eslint-canon-be

**ESLint rules, grouped by law (the count is `Object.keys(rules)`; knowledge/hfs/rules.yaml names the HFS rule each one enforces), that hold a NestJS-shaped back end to one way of being written.**

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
| **Resilience** | An outbound HTTP call states a timeout or signal; `JSON.parse` of outside text sits in a `try`; a loop that catches and waits goes through `platform/retry` (`http-needs-timeout`, `json-parse-needs-guard`, `no-hand-rolled-retry`) |
| **Log safety** | A logger call names no credential and no personal identifier (`no-secret-in-log`) |
| **Async and types** | An `async` function awaits; no `as never`, no `x!`; handlers and public methods declare a return type (`async-needs-await`, `no-never-cast`, `no-non-null-assertion`, `explicit-handler-return-type`) |
| **Migrations and input** | A migration's `down()` reverses its `up()`; every property of an input class has a `class-validator` decorator (`migration-down-reversible`, `dto-needs-validator`) |
| **Spec quality** | A spec does not read repository source with `fs`, and doubles are `mock<T>()`, not `as never` (`spec-no-source-read`, `spec-typed-doubles`) |
| **CQRS** | A handler does not assemble an aggregate inline; reads and writes do not share one path |
| **Module layering** | Another owner is imported through its public `index.ts` (`@modules/domain/plan`, `@features/plan`), never through a path into it; an `index.ts` lists a bounded set of named exports, with no `export *`, storage token or types folder; self-aliases and tier-only aliases are refused. |
| **Data access** | Queries stay where the layer says they may be built; no transaction spans an external call (`no-external-call-in-transaction`); the database is reached through the named shared `EntityManager` only (`named-entity-manager-only`) |
| **Transport** | The wire shape is declared, not inferred from whatever a handler happened to return |
| **Observability** | A failure is logged through the logger port with a typed identity, so a log line can be traced to the law that names it |
| **Testing** | Unit specs sit beside their subjects, including structural specs in HFS `src/tests` categories; a model-quality harness (one that imports an LLM SDK, reaches a house model helper or declares `@harness-kind model`) calls its provider directly; other live e2e specs, such as an identity provider, are not judged as model harnesses. |
| **End-to-end flows** | One file, one flow, named steps, and **never sleep** — poll until the state settles, with a deadline |
| **CDC · event delivery** | Projections and events follow the declared delivery contract |
| **Comments · naming · type safety** | Comments say why; no double cast through `unknown` |
| **User copy** | A literal exception message, notification text or response copy comes from the per-capability messages catalog through the typed `MessageCatalog` port (`user-copy-through-catalog`) |
| **Temporal** | `Date.now()`, a bare `new Date()` and `performance.now()` are read only inside `platform/clock` (`no-ambient-clock`) |
| **Idempotency** | A `@Public()` webhook handler and an outbox/queue consumer claim the event through the shared inbox before they act (`inbox-dedupe-required`) |

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

Every rule of this plugin is an enforcer of one HFS rule. The relation (rule id -> HFS rule -> catalogued Vietnamese why code)
lives in exactly one place, `knowledge/hfs/rules.yaml` (`enforcers`), and `scripts/checks/check-hfs-rules.mjs` refuses a
rule of this plugin that no catalog entry names. There is no second table here.


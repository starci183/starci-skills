# Nest test source form

`scripts/checks/code-patterns/nest-tests.mjs` checks the source form of selected colocated
unit specs. It never executes test bodies and never establishes assertion
quality, dependency-injection behavior, database integration or crash recovery.
The aggregate owns adoption, source discovery and before/after input binding.
An adapter result alone is not complete code-pattern conformance.

## Adopted rules

- `NEST_TEST_NAME_FORM`: an outer suite names the actual named export under test,
  either with its exported name or a resolved `Subject.name`. Nested suites may
  name scenarios. Tests have nonempty static titles; `.each` placeholders are
  allowed, and configuring `.each(table)` is not itself a test title. Callbacks
  start on a line after their preceding argument. The first word must belong to
  the shared `NEST_TEST_TITLE_ACTIONS` vocabulary exported by this checker (for
  example `accepts`, `rejects`, `returns`, `preserves`, `should`). This is an
  explicit lexical style rule, not English grammar inference. Extending that
  vocabulary is a versioned profile change. Whether the rest of the title
  accurately describes the asserted behavior remains agent review.
- `NEST_TEST_SUBJECT_FORM`: an enabled test callback inside the selected suite contains a call to the real public
  subject. A handler/use-case invokes `execute`, including an inherited public
  entry; a spec cannot bypass a protected/private hook through a cast. Class
  receivers trace to a real constructor or a resolved Nest `get`/`resolve` call.
  A Nest module lookup must trace back to an awaited real
  `Test.createTestingModule({ providers: [Subject, ...otherDependencies] }).compile()`
  with an explicit class provider. A cast-only or ambient module reference cannot
  establish construction. Spread provider lists, overriding the subject token,
  imported module registrations and opaque module-builder helpers require a
  further bounded adapter; they cannot be certified from type annotations.
  Local bindings and assignments retain that value identity. A type assertion,
  unused constructor elsewhere, or call outside the suite cannot substitute
  for the selected receiver. Disabled suites/tests cannot contribute, each
  suite must call its own named subject, and inherited language builtins do not
  count as a subject API. A call in suite-registration code or a hook alone cannot
  replace the test's public call. Ordinary service APIs inherited only from
  external packages need an explicit owned contract. Opaque factories remain
  unavailable, rather than being accepted from their declared return type.
  Transparent local zero-argument helpers are followed only from a resolved
  call inside the selected enabled test. An uncalled function contributes no
  subject proof. Parameterized helpers and arbitrary nested callbacks remain
  unavailable until a bounded value-binding adapter supports them; that is a
  checker limitation, not a declaration that the source is invalid.

The checker uses the consuming repository's TypeScript and canonical project
configuration. Specs must be actual project root files; conflicting compiler
ownership, missing subjects or unresolved construction block proof. Exact
colocated subject paths must belong to the aggregate's bound context. Selected
`.spec.ts`, `.spec.mts`, `.spec.cts` and `.spec.tsx` forms are supported when the
target compiler owns them. Declaration files are not subjects.

Jest ambient APIs and imported aliases from `@jest/globals` or `vitest` must
resolve to the installed test package's declarations; an unrelated project
ambient declaration or local helper named `describe` is not a suite. Supporting
API syntax does not select or migrate the project's runner. The separate
metadata check verifies the adopted Jest runner's actual discovery/configuration.

## Construction and evidence

Use direct construction for isolated behavior and the actual Nest testing
module when the claim concerns registration, injection, tokens or lifecycle.
No rule requires `as never`, a double cast, a DI container for every service,
or a test file for every class. Behavior and failure risk determine the tests
needed. A selected unit spec is colocated; file counts are historical evidence.

Mocked repositories do not prove real database transactions. Source calls do
not prove execution, assertions or unmocked subject behavior. Relevant tests
must run for a behavior claim, and the reviewer must inspect their actual
boundaries. Unsupported static constructions are reported as unavailable and
need a bounded adapter improvement; agent prose cannot waive them.

## Basis

This is StarCi's adopted source profile, not a universal Nest or Jest mandate.
Academy backend commit `1731b15ba4ed526477e3c572b9d82c31ab64f1d5` supplies both
direct handler construction (`add-to-cart.handler.spec.ts`) and testing-module
service construction (`ai-entitlement.service.spec.ts`). Its `ICQRSHandler`
exposes `execute` while retaining `process` as a protected hook. Historical
fixture casts and filename totals do not become new-project requirements.

Official references read on 2026-09-16:
[Nest testing](https://docs.nestjs.com/fundamentals/testing) documents both
isolated construction and testing modules;
[Jest API](https://jestjs.io/docs/api) defines suites, tests and parameterized
`.each` registrations. The current target's installed runner remains authoritative.

The checker's isolated fixtures use real lockfile-pinned TypeScript, Jest API
declarations and Nest testing/core declarations through links in a disposable
temporary project. They do not rewrite a product's `node_modules`, load a live
application or execute the selected product tests. This verifies static API
compatibility with those pinned versions, not all past or future versions.

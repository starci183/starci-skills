# Nest service spec title form

`scripts/checks/code-patterns/nest-tests.mjs` checks the title form of colocated service specs. It applies to
`*.service.spec.ts` files only, because under the unit standard (`knowledge/patterns/be/test.yaml`, BE-TEST-1 to BE-TEST-15)
only `*.service.ts` files are unit-tested. It never executes test bodies and never establishes assertion quality,
dependency-injection behavior, database integration or crash recovery. The aggregate owns adoption and source discovery.
An adapter result alone is not complete code-pattern conformance.

## Adopted rule

- `NEST_TEST_NAME_FORM`: the spec has an outer `describe` suite (nested suites may name scenarios). Every test has a
  nonempty static title; `.each` placeholders are allowed, and configuring `.each(table)` is not itself a test title.
  The first word of a test title must belong to the shared `NEST_TEST_TITLE_ACTIONS` vocabulary exported by this checker
  (for example `accepts`, `rejects`, `returns`, `preserves` and the other verbs listed there). This is an explicit
  lexical style rule, not English grammar inference. Extending the vocabulary is a versioned profile change. Every enabled
  suite or test has a runnable callback that starts on a line after its preceding argument. Whether a title accurately
  describes the asserted behavior remains agent review.

## What this checker does not judge

How the subject is built is not decided here. The unit standard requires the service to be built with
`Test.createTestingModule({ providers })` and `moduleRef.get(...)` (no `new`, no `imports`, no `overrideProvider`), with
doubles from `@starci/jest-preset`. That construction form, the providers list and the doubles are enforced by the spec
lint rules (`spec-builds-with-testing-module`, `unit-spec-providers`), which are the single rule system for them.

## Tooling

The checker uses the consuming repository's TypeScript and canonical project configuration. Specs must be actual project
root files; conflicting compiler ownership blocks proof. Jest ambient APIs and imported aliases from `@jest/globals` or
`vitest` must resolve to the installed test package's declarations; an unrelated project ambient declaration or a local
helper named `describe` is not a suite. Supporting API syntax does not select or change the project's runner. The separate
metadata check verifies the adopted Jest runner's actual discovery and configuration. Unsupported static constructions
are reported as unavailable and need a bounded adapter improvement; agent prose cannot waive them.

The checker's isolated fixtures use real lockfile-pinned TypeScript, Jest API declarations and Nest testing declarations
through links in a disposable temporary project. They do not rewrite a product's `node_modules`, load a live application or
execute the selected product tests.

# Test

This file answers one question: given a backend unit, where does its spec live, how is the subject
built, what does it assert, and what does it leave alone?

Sources: `jest.config.ts`, `features/api/core/graphql/mutations/courses/add-to-cart/add-to-cart.handler.spec.ts`,
`modules/ai/ai-entitlement.service.spec.ts`,
`modules/ai/ping/classes/abstract-provider-ping.service.spec.ts`, `src/tests/**`, `eslint.config.mjs`.

## BE-TEST-1 — Placement and lanes

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Unit | `<name>.spec.ts` beside `<name>.ts` (875; lint `unit-test-colocated`) |
| Case 2 | Handler twin | `add-to-cart.handler.spec.ts` beside the handler (118 of 149 handlers; lint `handler-has-twin-spec`) |
| Case 3 | Service twin | 271 of 396 services under `src/modules` |
| Case 4 | Integration | `*.int-spec.ts` (7), Testcontainers, `globalSetup: src/tests/helpers/e2e-setup.ts`, `testTimeout: 120_000` |
| Case 5 | E2E and harness | `*.e2e-spec.ts`, `*.harness-spec.ts` under `src/tests/<lane>`, excluded from `unit` by suffix |
| Case 6 | Projects | `projects: [{ displayName: "unit", testMatch: ["**/*.spec.ts"], testPathIgnorePatterns: ["\\.int-spec\\.ts$", "\\.e2e-spec\\.ts$", "\\.harness-spec\\.ts$"] }, { displayName: "integration", testMatch: ["**/*.int-spec.ts"], … }]` |
| Case 7 | Runner | `jest` with `ts-jest` (`diagnostics: false`), `testEnvironment: "node"` |

## BE-TEST-2 — Handler spec: construct directly, cast the mocks

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Subject | `const handler = new AddToCartHandler({ exists } as never)` — the entity manager is a bare object of `jest.fn()`; `as never` appears in 496 of 875 specs, `as unknown as` in 323 |
| Case 2 | Message factory | `const command = (courseId: string) => new AddToCartCommand({ request: { courseId }, user: { id: "u1" } } as never)` |
| Case 3 | Ordered mock answers | `const exists = jest.fn().mockResolvedValueOnce(false)`; later `exists.mockResolvedValueOnce(true).mockResolvedValueOnce(true)` |
| Case 4 | Call through the public door | `handler.execute(command("missing"))`, never `process` |

## BE-TEST-3 — Service spec: a testing module with shared mocks

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Module | `Test.createTestingModule({ … })` (274 specs) with `getEntityManagerToken(POSTGRESQL_PRIMARY)` |
| Case 2 | Entity manager | `import { makeEntityManagerMock } from "@tests/mocks/entity-manager.mock"` with `EntityManagerMock`, `QueryBuilderMock` types |
| Case 3 | Config | `jest.mock("@modules/platform/env/config", () => ({ envConfig: () => ({ ai: { ping: mockPingConfig } }) }))` |
| Case 4 | Abstract class | a local subclass: `class TestPingService extends AbstractProviderPingService { protected readonly provider = ModelProvider.OpenAI; execute = jest.fn()…; protected executePing(key: string) { return this.execute(key) } }` |
| Case 5 | Fixture constants | documented UPPER_SNAKE: `/** Free base credit caps the mocked quota config hands back (credits per window). */ const BASE_CREDITS_5H = 30` |

## BE-TEST-4 — What is asserted

| Case | When | Write |
| --- | --- | --- |
| Case 1 | The exception type | `await expect(handler.execute(command("missing"))).rejects.toBeInstanceOf(CourseNotFoundException)` (262 specs use `rejects.toBeInstanceOf` / `toThrow(`; 49 match a message string) |
| Case 2 | Ordering of side effects | `await expect(handler.execute(…)).rejects.toBeInstanceOf(UserNotFoundException); expect(exists).not.toHaveBeenCalled()` |
| Case 3 | The returned row | `await expect(handler.execute(command("one"))).resolves.toBe(existing)`; `.resolves.toEqual({ id: "cart-2" })` |
| Case 4 | Persisted argument | `expect(save).toHaveBeenCalledWith({ id: "draft" })` |
| Case 5 | `it` phrasing | verb first: `throws` (83), `rejects` (65), `returns` (50), `refuses` (25), `maps`, `creates` — e.g. `it("rejects anonymous callers before querying course state", …)` |

## BE-TEST-5 — What is not asserted

| Case | When | Write |
| --- | --- | --- |
| Case 1 | A call alone | a spec that only proves a mock was invoked (lint `no-call-only-spec`) |
| Case 2 | Envelope instead of state, in e2e | an e2e step asserts the persisted row, not `success: true` (lint `e2e-asserts-persisted-state`) |
| Case 3 | Elapsed time | no `sleep` in a flow; poll for state (lint `no-sleep-in-flow`) |
| Case 4 | Live model output, in e2e | no provider call in e2e (`no-model-call-in-e2e`); the harness lane owns it (`harness-calls-provider-directly`) |
| Case 5 | A branch inside one step | one step proves one outcome (lint `no-branch-in-flow-step`) |

## BE-TEST-6 — Names and layout

| Case | When | Write |
| --- | --- | --- |
| Case 1 | `describe` | the class: `describe("AddToCartHandler", () => { … })`, `describe("AbstractProviderPingService", …)` (367 `…Service`, 121 `…Handler`, 58 `…Resolver`) |
| Case 2 | Formatting | callbacks on a new line: `describe("AddToCartHandler",\n    () => {` and `it("…",\n        async () => {` — the repo's `function-call-argument-newline: always` rule |
| Case 3 | Imports | same multi-line brace style as source; subject first, then exceptions, then mocks |

## BE-TEST-7 — Coverage and lint carve-outs

| Case | When | Write |
| --- | --- | --- |
| Case 1 | Coverage denominator | `collectCoverageFrom: ["src/**/*.ts", "apps/**/*.ts", "!src/tests/**", "!**/*.spec.ts", "!**/*.int-spec.ts", "!**/*.e2e-spec.ts", "!**/*.harness-spec.ts", "!**/*.d.ts", "!**/main.ts"]` |
| Case 2 | Allowed only in specs | `as unknown as X`, `process.env` (under `src/tests/**`), `new Error(…)` in `src/tests/**` and `apps/*/test/**` |

## Open question

31 of 149 handlers and 125 of 396 services have no colocated spec today. The twin is the pattern
(lint rule exists); the gap is recorded, not excused.

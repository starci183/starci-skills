// proves: BE_SPEC_FORM_ALL_ROLES@lite
// proves: BE_SPEC_FORM_ALL_ROLES@full
/**
 * Twin tests for the unit-spec form rules (R48 `BE_SPEC_QUALITY`, R281 `BE_SPEC_FORM_ALL_ROLES`).
 *
 *   node --test unit-spec.spec.mjs
 *
 * A case's file path decides its slot (`at(...)` under the typed fixture repository); the types come from the stubs of
 * `@nestjs/testing`, `@starci/jest-preset` and `typeorm` in `fixtures/typed/node_modules`.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { BE_DECLARATION, TYPED_ROOT, at, fixtureHfs, typedTester } from "./fixtures/typed/tester.mjs"
import { appDeclaration } from "./fixtures/app.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import {
    noReturnOnlyGeneric,
    rules,
    specBehaviorAssertion,
    specBuildsWithTestingModule,
    specExactValues,
    specInfraDoubleFromKit,
    specModuleDefinitionOnlyProviders,
    specNoModuleMock,
    specNoNewSubject,
} from "./unit-spec.mjs"

const tester = typedTester()
const SPEC = at("src/modules/domain/order/order.service.spec.ts")
const HANDLER_SPEC = at("src/features/api/checkout/application/start-checkout.handler.spec.ts")
const SERVICE = at("src/modules/domain/order/order.service.ts")
const FIXTURE = at("src/tests/fixtures/orders.ts")
const E2E = at("src/tests/e2e/checkout/course-enroll.e2e-spec.ts")

const NEST = 'import { Test } from "@nestjs/testing"\nimport { OrderService } from "./order.service"\n'

test("every rule this law declares is exported under its published name", () => {
    for (const [name, rule] of Object.entries(rules)) assert.ok(rule?.meta && rule.create, `${name} is not a rule`)
})

test("spec-builds-with-testing-module: the subject comes out of a compiled Nest testing module", () => {
    tester.run("spec-builds-with-testing-module", specBuildsWithTestingModule, {
        valid: [
            { filename: SPEC, code: `${NEST}it("x", async () => {\n  const moduleRef = await Test.createTestingModule({ providers: [OrderService] }).compile()\n  const service = moduleRef.get(OrderService)\n  expect(service).toBeDefined()\n})` },
            // a builder held in a variable is still the testing module
            { filename: SPEC, code: `${NEST}it("x", async () => {\n  const builder = Test.createTestingModule({ providers: [OrderService] })\n  const moduleRef = await builder.compile()\n  moduleRef.get(OrderService)\n})` },
            // feature handlers and other spec kinds are not unit-tested logic-role specs
            { filename: HANDLER_SPEC, code: "export const a = 1" },
            { filename: E2E, code: "export const a = 1" },
            { filename: SERVICE, code: "export const a = 1" },
        ],
        invalid: [
            { filename: SPEC, code: `import { OrderService } from "./order.service"\nconst service = new OrderService()\nexport { service }`, errors: [{ messageId: "noModule" }] },
            // a `Test` that is not the one of @nestjs/testing
            { filename: SPEC, code: "const Test = { createTestingModule: (x: object) => x }\nTest.createTestingModule({})", errors: [{ messageId: "noModule" }] },
            { filename: SPEC, code: `${NEST}Test.createTestingModule({ providers: [OrderService] })`, errors: [{ messageId: "noCompile" }] },
            { filename: SPEC, code: `${NEST}it("x", async () => {\n  await Test.createTestingModule({ providers: [OrderService] }).compile()\n})`, errors: [{ messageId: "noGet" }] },
            // `get` on something that is not the compiled module
            { filename: SPEC, code: `${NEST}declare const bag: { get(key: unknown): unknown }\nit("x", async () => {\n  await Test.createTestingModule({ providers: [OrderService] }).compile()\n  bag.get(OrderService)\n})`, errors: [{ messageId: "noGet" }] },
        ],
    })
})

test("spec-no-new-subject: the service under test is never built with new", () => {
    tester.run("spec-no-new-subject", specNoNewSubject, {
        valid: [
            { filename: SPEC, code: `${NEST}it("x", async () => {\n  const moduleRef = await Test.createTestingModule({ providers: [OrderService] }).compile()\n  moduleRef.get(OrderService)\n})` },
            // a class of another module may be built: a value object, an error, a plain fixture
            { filename: SPEC, code: 'import { OrderService } from "./order.service"\nclass Row {}\nexport const row = new Row()\nexport { OrderService }' },
            { filename: SPEC, code: 'import { OtherService } from "./other.service"\nexport const other = new OtherService()' },
            // a feature handler is not a unit-tested logic-role spec
            { filename: HANDLER_SPEC, code: 'import { OrderService } from "./order.service"\nexport const s = new OrderService()' },
        ],
        invalid: [
            { filename: SPEC, code: 'import { OrderService } from "./order.service"\nexport const s = new OrderService()', errors: [{ messageId: "construct" }] },
            { filename: SPEC, code: 'import { OrderService as Subject } from "./order.service.js"\nexport const s = new Subject()', errors: [{ messageId: "construct" }] },
            { filename: SPEC, code: 'import * as order from "./order.service"\nexport const s = new order.OrderService()', errors: [{ messageId: "construct" }] },
        ],
    })
})

test("spec-module-definition-only-providers: no imports key and no override in the testing module", () => {
    tester.run("spec-module-definition-only-providers", specModuleDefinitionOnlyProviders, {
        valid: [
            { filename: SPEC, code: `${NEST}Test.createTestingModule({ providers: [OrderService, { provide: "X", useValue: 1 }] })` },
            // feature handler specs and e2e modules are other rules' business
            { filename: HANDLER_SPEC, code: `${NEST}Test.createTestingModule({ imports: [OrderService] }).overrideProvider(1)` },
            { filename: E2E, code: `${NEST}Test.createTestingModule({ imports: [OrderService] })` },
        ],
        invalid: [
            { filename: SPEC, code: `${NEST}Test.createTestingModule({ imports: [OrderService], providers: [] })`, errors: [{ messageId: "imports" }] },
            { filename: SPEC, code: `${NEST}Test.createTestingModule({ providers: [OrderService] }).overrideProvider("X").useValue(1)`, errors: [{ messageId: "override" }] },
            { filename: SPEC, code: `${NEST}Test.createTestingModule({ providers: [] }).overrideGuard("X").useValue(1)`, errors: [{ messageId: "override" }] },
            { filename: SPEC, code: "declare const b: { overrideModule(x: unknown): void; overrideFilter(x: unknown): void; overridePipe(x: unknown): void; overrideInterceptor(x: unknown): void }\nb.overrideModule(1)\nb.overrideFilter(1)\nb.overridePipe(1)\nb.overrideInterceptor(1)", errors: [{ messageId: "override" }, { messageId: "override" }, { messageId: "override" }, { messageId: "override" }] },
        ],
    })
})

test("spec-no-module-mock: a unit spec replaces no module, its own or a library's", () => {
    const JEST = "declare const jest: { mock(m: string): void; doMock(m: string): void; unstable_mockModule(m: string): void; requireMock(m: string): unknown; setMock(m: string, v: unknown): void; fn(): void }\n"
    tester.run("spec-no-module-mock", specNoModuleMock, {
        valid: [
            { filename: SPEC, code: `${JEST}jest.fn()` },
            // a local object that merely has that name is not the jest object
            { filename: SPEC, code: "function run() {\n  const jest = { mock: (m: string) => m }\n  return jest.mock('x')\n}\nexport { run }" },
            // the other spec kinds are judged by their own rules
            { filename: E2E, code: `${JEST}jest.mock("./a")` },
            { filename: SERVICE, code: `${JEST}jest.mock("./a")` },
        ],
        invalid: [
            { filename: SPEC, code: `${JEST}jest.mock("./order.repository")`, errors: [{ messageId: "moduleMock" }] },
            { filename: SPEC, code: `${JEST}jest.mock("keycloak-admin-client")`, errors: [{ messageId: "moduleMock" }] },
            { filename: SPEC, code: `${JEST}jest.doMock("axios")`, errors: [{ messageId: "moduleMock" }] },
            { filename: SPEC, code: `${JEST}jest.unstable_mockModule("ioredis")`, errors: [{ messageId: "moduleMock" }] },
            { filename: SPEC, code: `${JEST}jest.requireMock("@aws-sdk/client-s3")`, errors: [{ messageId: "moduleMock" }] },
            { filename: SPEC, code: `${JEST}jest.setMock("./a", {})`, errors: [{ messageId: "moduleMock" }] },
            { filename: SPEC, code: 'import { jest } from "@jest/globals"\njest.mock("./a")', errors: [{ messageId: "moduleMock" }] },
            // a handler spec is a finding elsewhere, and here too if it mocks a module
            { filename: HANDLER_SPEC, code: `${JEST}jest.mock("./a")`, errors: [{ messageId: "moduleMock" }] },
        ],
    })
})

test("no-return-only-generic: a helper of a spec or a fixture is not a cast with a name", () => {
    tester.run("no-return-only-generic", noReturnOnlyGeneric, {
        valid: [
            // the parameter drives the type argument
            { filename: SPEC, code: "export const first = <T>(items: ReadonlyArray<T>): T => items[0]" },
            { filename: SPEC, code: "export function wrap<T extends object>(overrides: Partial<T>): T { return overrides as never }" },
            { filename: FIXTURE, code: "export function pick<K extends string, V>(key: K, bag: Record<K, V>): V { return bag[key] }" },
            // a generic with no return type annotation says nothing about its return
            { filename: SPEC, code: "export const id = <T>(value: T) => value" },
            // an unknown parameter that is checked is not handed back as another type
            { filename: SPEC, code: "export function text(value: unknown): string { return typeof value === 'string' ? value : '' }" },
            { filename: SPEC, code: "export function same(value: unknown): unknown { return value }" },
            // an entity builder returns the class it builds
            { filename: FIXTURE, code: "class Order { id = 0 }\nexport const order = (id: number): Order => Object.assign(new Order(), { id })" },
            // structuredClone is the honest clone; a plain JSON.parse of text is a parse
            { filename: SPEC, code: "export const copy = <T extends object>(value: T): T => structuredClone(value)\nexport const parsed = JSON.parse('{}')" },
            // production code and other slots are not judged
            { filename: SERVICE, code: "export const read = <T>(value: unknown): T => value as T" },
        ],
        invalid: [
            { filename: SPEC, code: "export const cast = <T>(value: unknown): T => value as T", errors: [{ messageId: "returnOnly" }] },
            { filename: SPEC, code: "export function make<T>(): T { throw new Error('x') }", errors: [{ messageId: "returnOnly" }] },
            { filename: FIXTURE, code: "export function fake<T extends object, U>(seed: U): T { return seed as never }", errors: [{ messageId: "returnOnly" }] },
            { filename: E2E, code: "export const read = <T>(value: unknown): Promise<T> => Promise.resolve(value as T)", errors: [{ messageId: "returnOnly" }] },
            { filename: SPEC, code: "declare function coerce<T>(value: unknown): T", errors: [{ messageId: "returnOnly" }] },
            // an unknown or any parameter handed back as a concrete type
            { filename: SPEC, code: "export const asManager = (fake: any): Manager => fake\ninterface Manager { find(): void }", errors: [{ messageId: "launder" }] },
            { filename: SPEC, code: "export function asRow(fake: unknown): Row { return fake as Row }\ninterface Row { id: number }", errors: [{ messageId: "launder" }] },
            // a JSON round trip typed by the receiver
            { filename: SPEC, code: "interface Row { id: number }\nexport const row: Row = JSON.parse(JSON.stringify({ id: 1 }))", errors: [{ messageId: "json" }] },
            // an object of one class returned as another
            { filename: FIXTURE, code: "class Order { id = 0 }\nclass Invoice { total = 0 }\nexport const invoice = (): Invoice => Object.assign(new Order(), { total: 1 })", errors: [{ messageId: "assign" }] },
        ],
    })
})

/** A service spec that provides one token with one value. */
const provide = (token, value, head = "") => `import { mock, mockEntityManager, fakeTransaction, FakeClock, fakeIds, fakeCache, fakeLock, recordingEventBus, recordingQueueOutbox, fakeInbox, builder } from "@starci/jest-preset"\n${head}\nexport const provider = { provide: ${token}, useValue: ${value} }`

test("spec-infra-double-from-kit: a provider takes its value from the kit double the token calls for", () => {
    tester.run("spec-infra-double-from-kit", specInfraDoubleFromKit, {
        valid: [
            { filename: SPEC, code: provide("PRIMARY_ENTITY_MANAGER", "mockEntityManager()") },
            { filename: SPEC, code: provide("InjectBillingEntityManager", "mockEntityManager({ findOne: [Order, null] })", "class Order {}") },
            { filename: SPEC, code: provide("Tokens.CLOCK", "new FakeClock(0)") },
            { filename: SPEC, code: provide("CLOCK", "clock", "const clock = new FakeClock(0)") },
            { filename: SPEC, code: provide("EVENT_BUS", "recordingEventBus()") },
            { filename: SPEC, code: provide("EVENT_BUS", "recordingEventBus<Placed>()", "interface Placed { eventId: string }") },
            { filename: SPEC, code: provide("INBOX", "fakeInbox()") },
            { filename: SPEC, code: provide("QUEUE_OUTBOX", "recordingQueueOutbox()") },
            { filename: SPEC, code: provide("REDIS_CACHE_MANAGER", "fakeCache(new FakeClock(0))") },
            { filename: SPEC, code: provide("CACHE", "cache", "const cache = fakeCache(new FakeClock(0))") },
            { filename: SPEC, code: provide("INSTANCE_WRITER_FENCE", "fakeLock(new FakeClock(0))") },
            { filename: SPEC, code: provide("CHALLENGE_GRADING_HOLD", "fakeLock(new FakeClock(0))") },
            { filename: SPEC, code: provide("IDS", "fakeIds()") },
            { filename: SPEC, code: provide("PAYMENT_OPTIONS", "builder({ retries: 3 })({ retries: 1 })") },
            { filename: SPEC, code: provide("PAYMENT_OPTIONS", "{ retries: 3, region: 'eu' }") },
            { filename: SPEC, code: provide("KEYCLOAK_ADMIN", "mock<KeycloakAdmin>()", "interface KeycloakAdmin { users(): void }") },
            { filename: SPEC, code: provide("BucketName", "'uploads'") },
            { filename: SPEC, code: provide("REGISTRY", "[mock<Step>()]", "interface Step { run(): void }") },
            // a helper parameter typed with the kit type, or its ReturnType, is the kit double\n            { filename: SPEC, code: provide("PRIMARY_ENTITY_MANAGER", "em", "import type { MockEntityManager } from '@starci/jest-preset'"+"\nexport const build = (em: MockEntityManager) => ({ em })") },\n            { filename: SPEC, code: provide("PRIMARY_ENTITY_MANAGER", "em", "export const build = async (em: ReturnType<typeof mockEntityManager>) => em") },\n            { filename: SPEC, code: provide("CLOCK", "clock", "import type { FakeClock as Clk } from '@starci/jest-preset'\nexport const build = (clock: Clk) => clock") },\n            // the manager of a fakeTransaction, bound or inline\n            { filename: SPEC, code: provide("PRIMARY_ENTITY_MANAGER", "tx.em", "const tx = fakeTransaction(mockEntityManager())") },\n            { filename: SPEC, code: provide("PRIMARY_ENTITY_MANAGER", "fakeTransaction(mockEntityManager()).em") },\n            // the transaction runner takes fakeTransaction
            { filename: SPEC, code: provide("TRANSACTION_RUNNER", "fakeTransaction()") },
            // a provider without useValue, and a value with no token, are not judged
            { filename: SPEC, code: 'export const p = { provide: "CLOCK", useFactory: () => 1 }' },
            // a feature handler is not a unit-tested logic-role spec
            { filename: HANDLER_SPEC, code: provide("CLOCK", "{}") },
            { filename: SERVICE, code: provide("CLOCK", "{}") },
        ],
        invalid: [
            // entity manager: the kit double only
            { filename: SPEC, code: provide("PRIMARY_ENTITY_MANAGER", "mock<Manager>()", "interface Manager { find(): void }"), errors: [{ messageId: "wrong" }] },
            { filename: SPEC, code: provide("PRIMARY_ENTITY_MANAGER", "{ find: () => [] }"), errors: [{ messageId: "wrong" }] },
            { filename: SPEC, code: provide("EntityManager", "makeManager()", "declare function makeManager(): object"), errors: [{ messageId: "wrong" }] },
            // the right name from the wrong module is a lookalike
            { filename: SPEC, code: 'import { mockEntityManager } from "../../../tests/fixtures/database"\nexport const p = { provide: "PRIMARY_ENTITY_MANAGER", useValue: mockEntityManager() }', errors: [{ messageId: "notKit" }] },
            // clock, outbox, cache, lock, ids
            { filename: SPEC, code: provide("CLOCK", "{ now: () => new Date(0) }"), errors: [{ messageId: "wrong" }] },
            { filename: SPEC, code: provide("CLOCK", "mock<Clock>()", "interface Clock { now(): Date }"), errors: [{ messageId: "wrong" }] },
            { filename: SPEC, code: provide("EVENT_BUS", "mock<EventBus>()", "interface EventBus { publish(): void }"), errors: [{ messageId: "wrong" }] },
            { filename: SPEC, code: provide("QUEUE_OUTBOX", "{ write: () => undefined }"), errors: [{ messageId: "wrong" }] },
            { filename: SPEC, code: provide("INBOX", "mock<Inbox>()", "interface Inbox { claim(): void }"), errors: [{ messageId: "wrong" }] },
            { filename: SPEC, code: provide("REDIS_CACHE_MANAGER", "new Map()"), errors: [{ messageId: "wrong" }] },
            { filename: SPEC, code: provide("CACHE", "mock<Cache>()", "interface Cache { get(): void }"), errors: [{ messageId: "wrong" }] },
            { filename: SPEC, code: provide("INSTANCE_WRITER_FENCE", "mock<Fence>()", "interface Fence { take(): void }"), errors: [{ messageId: "wrong" }] },
            { filename: SPEC, code: provide("IDS", "{ next: () => 'a' }"), errors: [{ messageId: "wrong" }] },
            // options tokens are REAL values, never a mock
            { filename: SPEC, code: provide("PAYMENT_OPTIONS", "mock<PaymentOptions>()", "interface PaymentOptions { retries: number }"), errors: [{ messageId: "wrong" }] },
            // anything else is mock<T>()
            { filename: SPEC, code: provide("KEYCLOAK_ADMIN", "{ users: () => [] }"), errors: [{ messageId: "wrong" }] },
            { filename: SPEC, code: provide("KEYCLOAK_ADMIN", "mockEntityManager()"), errors: [{ messageId: "wrong" }] },
            // a typed parameter is judged by its type: the wrong kit type for the token, or no kit type at all\n            { filename: SPEC, code: provide("CLOCK", "em", "export const build = (em: ReturnType<typeof mockEntityManager>) => em"), errors: [{ messageId: "wrong" }] },\n            { filename: SPEC, code: provide("PRIMARY_ENTITY_MANAGER", "em", "interface Loose { find(): void }\nexport const build = (em: Loose) => em"), errors: [{ messageId: "unknown" }] },\n            // a value that cannot be traced to a double
            { filename: SPEC, code: provide("CLOCK", "harness.clock", "declare const harness: { clock: object }"), errors: [{ messageId: "unknown" }] },
        ],
    })
})

test("the token table is the manifest's, not the rule's", () => {
    const table = fixtureHfs().ruleParams.specDoubles
    assert.equal(table.kit, "@starci/jest-preset")
    assert.deepEqual(table.doubles.map((entry) => entry.double).sort((left, right) => left < right ? -1 : Number(left > right)), ["FakeClock", "builder", "fakeCache", "fakeIds", "fakeInbox", "fakeLock", "fakeTransaction", "mockEntityManager", "recordingEventBus", "recordingQueueOutbox"])
    assert.equal(table.fallback.double, "mock")
})

test("spec-exact-values: a unit spec asserts the exact id and the exact date, never expect.any(String|Number|Date)", () => {
    const kit = 'import { FakeClock, fakeIds } from "@starci/jest-preset"\n'
    tester.run("spec-exact-values", specExactValues, {
        valid: [
            // the exact id from fakeIds and the exact date from FakeClock
            { filename: SPEC, code: `${kit}const ids = fakeIds("order")\nconst clock = new FakeClock("2026-01-01T00:00:00Z")\nexpect({ id: ids.next(), at: clock.now() }).toEqual({ id: "order-1", at: new Date("2026-01-01T00:00:00Z") })` },
            // other asymmetric matchers are not a "some value of a kind"
            { filename: SPEC, code: "expect({ a: 1 }).toEqual({ a: expect.anything() })\nexpect([1]).toEqual(expect.arrayContaining([1]))" },
            // a locally declared `expect` or `Date` is not the jest global or the global constructor
            { filename: SPEC, code: "const expect = { any: (kind: unknown) => kind }\nexpect.any(String)" },
            { filename: SPEC, code: "class Date {}\nexpect({}).toEqual({ at: expect.any(Date) })" },
            // feature handlers and e2e specs retain their separate rules
            { filename: HANDLER_SPEC, code: "expect({}).toEqual({ id: expect.any(String) })" },
            { filename: E2E, code: "expect({}).toEqual({ id: expect.any(String) })" },
        ],
        invalid: [
            { filename: SPEC, code: "expect(saved).toEqual({ id: expect.any(String) })", errors: [{ messageId: "loose" }] },
            { filename: SPEC, code: "expect(saved).toEqual({ total: expect.any(Number) })", errors: [{ messageId: "loose" }] },
            { filename: SPEC, code: "expect(saved).toEqual({ createdAt: expect.any(Date) })", errors: [{ messageId: "loose" }] },
            // through the @jest/globals import
            { filename: SPEC, code: 'import { expect } from "@jest/globals"\nexpect(saved).toEqual({ id: expect.any(String) })', errors: [{ messageId: "loose" }] },
            // nested in a matcher
            { filename: SPEC, code: "expect(rows).toEqual([expect.objectContaining({ id: expect.any(String) })])", errors: [{ messageId: "loose" }] },
        ],
    })
})

const LOGIC_SPECS = [
    { role: "policy", path: "src/modules/domain/order/order.policy.spec.ts", stem: "order.policy" },
    { role: "mapper", path: "src/modules/domain/order/order.mapper.spec.ts", stem: "order.mapper" },
    { role: "guard", path: "src/modules/platform/auth/session.guard.spec.ts", stem: "session.guard" },
    { role: "client", path: "src/modules/integrations/mail/mail.client.spec.ts", stem: "mail.client" },
]

for (const edition of ["lite", "full"]) {
    const hfs = hfsFromDeclaration({ ...appDeclaration("be", BE_DECLARATION), edition }, TYPED_ROOT)
    const settings = { starci: { hfs } }
    for (const { role, path, stem } of LOGIC_SPECS) {
        test(`R281 ${edition}: ${role} specs use the same Nest construction, provider and double rules`, () => {
            const filename = at(path)
            const head = `import { Test } from "@nestjs/testing"\nimport { Subject } from "./${stem}"\n`
            const built = `${head}it("returns the exact result", async () => {\nconst moduleRef = await Test.createTestingModule({ providers: [Subject] }).compile()\nconst subject = moduleRef.get(Subject)\nexpect(subject.run()).toEqual({ accepted: true })\n})`
            tester.run("spec-builds-with-testing-module", specBuildsWithTestingModule, {
                valid: [{ filename, settings, code: built }],
                invalid: [
                    { filename, settings, code: `${head}const subject = new Subject()`, errors: [{ messageId: "noModule" }] },
                    { filename, settings, code: `${head}Test.createTestingModule({ providers: [Subject] })`, errors: [{ messageId: "noCompile" }] },
                    { filename, settings, code: `${head}await Test.createTestingModule({ providers: [Subject] }).compile()`, errors: [{ messageId: "noGet" }] },
                ],
            })
            tester.run("spec-no-new-subject", specNoNewSubject, {
                valid: [
                    { filename, settings, code: built },
                    { filename, settings, code: `${head}class Row {}\nexport const row = new Row()` },
                ],
                invalid: [
                    { filename, settings, code: `${head}export const subject = new Subject()`, errors: [{ messageId: "construct" }] },
                    { filename, settings, code: `import * as subject from "./${stem}.js"\nnew subject.Subject()`, errors: [{ messageId: "construct" }] },
                ],
            })
            tester.run("spec-module-definition-only-providers", specModuleDefinitionOnlyProviders, {
                valid: [{ filename, settings, code: built }],
                invalid: [
                    { filename, settings, code: `${head}Test.createTestingModule({ imports: [Subject], providers: [] })`, errors: [{ messageId: "imports" }] },
                    { filename, settings, code: `${head}Test.createTestingModule({ providers: [Subject] }).overrideProvider("PORT")`, errors: [{ messageId: "override" }] },
                ],
            })
            tester.run("spec-no-module-mock", specNoModuleMock, {
                valid: [{ filename, settings, code: 'import { jest } from "@jest/globals"\njest.fn()' }],
                invalid: [
                    { filename, settings, code: `import { jest } from "@jest/globals"\njest.mock("./${stem}")`, errors: [{ messageId: "moduleMock" }] },
                    { filename, settings, code: 'import { jest } from "@jest/globals"\njest.doMock("openai")', errors: [{ messageId: "moduleMock" }] },
                ],
            })
            tester.run("spec-infra-double-from-kit", specInfraDoubleFromKit, {
                valid: [{ filename, settings, code: provide("CLOCK", "new FakeClock(0)") }],
                invalid: [{ filename, settings, code: provide("CLOCK", "{ now: () => new Date(0) }"), errors: [{ messageId: "wrong" }] }],
            })
            tester.run("spec-exact-values", specExactValues, {
                valid: [{ filename, settings, code: 'expect(saved).toEqual({ id: "order-1" })' }],
                invalid: [{ filename, settings, code: "expect(saved).toEqual({ id: expect.any(String) })", errors: [{ messageId: "loose" }] }],
            })
        })
    }
    test(`R281 ${edition}: presence-only assertions are refused and a behavior assertion passes`, () => {
        tester.run("spec-behavior-assertion", specBehaviorAssertion, {
            valid: [
                { filename: SPEC, settings, code: 'expect(subject).toBeDefined()\nexpect(subject.run()).toEqual({ accepted: true })' },
                { filename: SPEC, settings, code: "await expect(subject.run()).rejects.toThrow('invalid')" },
                { filename: SPEC, settings, code: "expect(subject.run()).toBeNull()" },
                { filename: SPEC, settings, code: "expect(subject.run()).toBeFalsy()" },
                { filename: SPEC, settings, code: "const expect = (value: object) => ({ toBeDefined: () => value })\nexpect(subject).toBeDefined()" },
                { filename: HANDLER_SPEC, settings, code: "expect(subject).toBeDefined()" },
                { filename: E2E, settings, code: "expect(subject).toBeDefined()" },
                { filename: SERVICE, settings, code: "expect(subject).toBeDefined()" },
                ...LOGIC_SPECS.map(({ path }) => ({ filename: at(path), settings, code: 'expect(subject.run()).toEqual({ accepted: true })' })),
            ],
            invalid: [
                { filename: SPEC, settings, code: "expect(subject).toBeDefined()", errors: [{ messageId: "presenceOnly" }] },
                { filename: SPEC, settings, code: "expect(subject).toBeDefined()\nexpect(subject).toBeTruthy()", errors: [{ messageId: "presenceOnly" }] },
                { filename: SPEC, settings, code: "expect(subject).not.toBeDefined()", errors: [{ messageId: "presenceOnly" }] },
                { filename: SPEC, settings, code: "await expect(subject.run()).resolves.toBeDefined()", errors: [{ messageId: "presenceOnly" }] },
                { filename: SPEC, settings, code: 'import { expect as check } from "@jest/globals"\ncheck(subject).toBeDefined()', errors: [{ messageId: "presenceOnly" }] },
                { filename: SPEC, settings, code: 'import * as globals from "@jest/globals"\nglobals.expect(subject).toBeDefined()', errors: [{ messageId: "presenceOnly" }] },
                { filename: SPEC, settings, code: "it('x', () => subject.run())", errors: [{ messageId: "zeroAssertions" }] },
                ...LOGIC_SPECS.map(({ path }) => ({ filename: at(path), settings, code: "expect(subject).toBeDefined()", errors: [{ messageId: "presenceOnly" }] })),
            ],
        })
    })
    test(`R281 ${edition}: every logic role refuses a test with zero assertions even beside an asserted test`, () => {
        const filenames = [SPEC, at("src/features/cli/migrate/subs/run.cli.spec.ts"), ...hfs.ruleParams.logicRoles.map((role) => at(`src/modules/platform/checks/subject.${role}.spec.ts`))]
        tester.run("spec-behavior-assertion", specBehaviorAssertion, {
            valid: filenames.map((filename) => ({ filename, settings, code: 'it("returns a result", () => expect(subject.run()).toEqual({ accepted: true }))\ntest("rejects invalid input", async () => { await expect(subject.run("invalid")).rejects.toThrow("invalid") })' })),
            invalid: filenames.map((filename) => ({ filename, settings, code: 'it("runs without assertions", () => { subject.run() })\ntest("returns a result", () => expect(subject.run()).toEqual({ accepted: true }))', errors: [{ messageId: "zeroAssertions" }] })),
        })
    })
    test(`R281 ${edition}: each Jest it/test callback must assert, including aliases and parameterized tests`, () => {
        tester.run("spec-behavior-assertion", specBehaviorAssertion, {
            valid: [
                { filename: SPEC, settings, code: 'it("returns a result", function () { expect(subject.run()).toEqual({ accepted: true }) })' },
                { filename: SPEC, settings, code: 'test.only("returns a result", () => expect(subject.run()).toEqual({ accepted: true }))' },
                { filename: SPEC, settings, code: 'test.each([1, 2])("doubles %s", value => expect(subject.run(value)).toBe(value * 2))' },
                { filename: SPEC, settings, code: 'test.concurrent.each([1, 2])("doubles %s", value => expect(subject.run(value)).toBe(value * 2))' },
                { filename: SPEC, settings, code: 'test.each`value\n${1}`("doubles", ({ value }) => expect(subject.run(value)).toBe(value * 2))' },
                { filename: SPEC, settings, code: 'import { it as verify, expect as check } from "@jest/globals"\nverify("returns a result", () => check(subject.run()).toEqual({ accepted: true }))' },
                { filename: SPEC, settings, code: 'import * as globals from "@jest/globals"\nglobals.test("returns a result", () => globals.expect(subject.run()).toEqual({ accepted: true }))' },
                { filename: SPEC, settings, code: 'const checkResult = () => expect(subject.run()).toEqual({ accepted: true })\nit("returns a result", checkResult)' },
                { filename: SPEC, settings, code: 'function checkResult() { expect(subject.run()).toEqual({ accepted: true }) }\nit("returns a result", () => checkResult())' },
                { filename: SPEC, settings, code: 'it("checks each result", () => { [1, 2].forEach(value => expect(subject.run(value)).toBe(value * 2)) })' },
                { filename: SPEC, settings, code: 'function checkResult() { checkResult(); expect(subject.run()).toEqual({ accepted: true }) }\nit("returns a result", () => checkResult())' },
                { filename: SPEC, settings, code: 'it.todo("future behavior")\ntest.skip("pending behavior")' },
                { filename: SPEC, settings, code: 'const it = (name: string, callback: () => void) => callback()\nit("local callback", () => subject.run())' },
                { filename: SPEC, settings, code: 'import { test } from "./custom-runner"\ntest("local callback", () => subject.run())' },
                { filename: HANDLER_SPEC, settings, code: 'it("thin handler", () => subject.run())' },
                { filename: E2E, settings, code: 'it("e2e flow", () => subject.run())' },
                { filename: at("src/tests/integration/checkout/checkout.integration-spec.ts"), settings, code: 'test("integration flow", () => subject.run())' },
                { filename: at("src/tests/contract/checkout/checkout.contract-spec.ts"), settings, code: 'test("contract flow", () => subject.run())' },
                { filename: SERVICE, settings, code: 'test("production callback", () => subject.run())' },
            ],
            invalid: [
                { filename: SPEC, settings, code: 'test("zero assertions", () => subject.run())', errors: [{ messageId: "zeroAssertions" }] },
                { filename: SPEC, settings, code: 'it.only("zero assertions", function () { subject.run() })', errors: [{ messageId: "zeroAssertions" }] },
                { filename: SPEC, settings, code: 'it.skip("zero assertions", () => {})', errors: [{ messageId: "zeroAssertions" }] },
                { filename: SPEC, settings, code: 'test.concurrent("zero assertions", async () => { await subject.run() })', errors: [{ messageId: "zeroAssertions" }] },
                { filename: SPEC, settings, code: 'test.each([1, 2])("zero assertions %s", value => subject.run(value))', errors: [{ messageId: "zeroAssertions" }] },
                { filename: SPEC, settings, code: 'test.each`value\n${1}`("zero assertions", ({ value }) => subject.run(value))', errors: [{ messageId: "zeroAssertions" }] },
                { filename: SPEC, settings, code: 'import { test as verify } from "@jest/globals"\nverify("zero assertions", () => subject.run())', errors: [{ messageId: "zeroAssertions" }] },
                { filename: SPEC, settings, code: 'import * as globals from "@jest/globals"\nglobals.it.only("zero assertions", () => subject.run())', errors: [{ messageId: "zeroAssertions" }] },
                { filename: SPEC, settings, code: 'const run = () => subject.run()\nit("zero assertions", run)', errors: [{ messageId: "zeroAssertions" }] },
                { filename: SPEC, settings, code: 'function run() { subject.run() }\nit("zero assertions", run)', errors: [{ messageId: "zeroAssertions" }] },
                { filename: SPEC, settings, code: 'it("zero assertions", () => { expect.assertions(1); expect.hasAssertions(); expect(subject.run()) })', errors: [{ messageId: "zeroAssertions" }] },
                { filename: SPEC, settings, code: 'expect(subject.run()).toEqual({ accepted: true })\nit("zero assertions", () => subject.run())', errors: [{ messageId: "zeroAssertions" }] },
                { filename: SPEC, settings, code: 'beforeEach(() => expect(subject.run()).toEqual({ accepted: true }))\nit("zero assertions", () => subject.run())', errors: [{ messageId: "zeroAssertions" }] },
                { filename: SPEC, settings, code: 'const expect = (value: unknown) => ({ toEqual: () => value })\nit("zero assertions", () => expect(subject.run()).toEqual())', errors: [{ messageId: "zeroAssertions" }] },
                { filename: SPEC, settings, code: 'it("zero assertions", () => { const unused = () => expect(subject.run()).toEqual({ accepted: true }) })', errors: [{ messageId: "zeroAssertions" }] },
                { filename: SPEC, settings, code: 'it("zero assertions", () => { it("nested assertions", () => expect(subject.run()).toEqual({ accepted: true })) })', errors: [{ messageId: "zeroAssertions" }] },
                { filename: SPEC, settings, code: 'function run() { run() }\nit("zero assertions", () => run())', errors: [{ messageId: "zeroAssertions" }] },
            ],
        })
    })
}

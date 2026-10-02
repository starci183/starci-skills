/**
 * Twin tests for the service-dependency rules (R83 `no-repository-class`, R85 `provider-param-token`, R89
 * `no-test-double-in-source`).
 *
 *   node --test service-deps.spec.mjs
 *
 * Every case is a virtual file under the typed fixture root: slots come from the path, `EntityManager`, `Repository`,
 * `DataSource` from the `typeorm` stub and the Nest decorators from the `@nestjs/common` stub.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { doubleWordOf, noRepositoryClass, noTestDoubleInSource, providerParamToken, rules } from "./service-deps.mjs"
import { at, typedTester } from "./fixtures/typed/tester.mjs"

const tester = typedTester()

const SERVICE = at("src/modules/domain/order/order.service.ts")
const SERVICE_SPEC = at("src/modules/domain/order/order.service.spec.ts")
const HANDLER = at("src/features/api/checkout/application/place.handler.ts")
const PLATFORM_DATABASE = at("src/modules/platform/database/database.service.ts")
const REPOSITORY_FILE = at("src/modules/domain/order/persistence/order.repository.ts")
const MAPPER = at("src/modules/domain/order/order.mapper.ts")
const MIGRATE = at("apps/cli/src/main.ts")
const WORLD = at("src/tests/world/use-test-world.ts")
const FIXTURE = at("src/tests/fixtures/database.ts")
const MIGRATION = at("src/modules/domain/order/persistence/migrations/1730000000000-create-orders.ts")

const NEST = 'import { Injectable } from "@nestjs/common"\n'
const TYPEORM = 'import { DataSource, EntityManager, QueryRunner, Repository } from "typeorm"\n'
const provider = (parameter, head = "") =>
    `${NEST}${head}\ndeclare const InjectTimeout: () => ParameterDecorator\nabstract class Port { abstract run(): void }\nclass Clock {}\n@Injectable()\nclass S { constructor(${parameter}) {} }`

test("every rule this law declares is exported under its published name", () => {
    for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("R85: a provider's constructor parameter is a class token or carries an Inject<Thing>()", () => {
    tester.run("provider-param-token", providerParamToken, {
        valid: [
            { filename: SERVICE, code: provider("private readonly clock: Clock") },
            // an abstract class is the token of a port
            { filename: SERVICE, code: provider("private readonly port: Port") },
            // a named-token injector makes any type resolvable
            { filename: SERVICE, code: provider("@InjectTimeout() private readonly timeoutMs: number") },
            { filename: SERVICE, code: provider("@InjectTimeout() private readonly lookup: ReadonlyMap<string, number>") },
            { filename: SERVICE, code: provider("") },
            // a class no Nest decorator marks is not a provider: an error, an entity, a value object
            { filename: SERVICE, code: "export class BadInput { constructor(readonly message: string, readonly retries: number) {} }" },
        ],
        invalid: [
            { filename: SERVICE, code: provider("private readonly timeoutMs: number"), errors: [{ messageId: "untokened" }] },
            { filename: SERVICE, code: provider("private readonly prefix: string"), errors: [{ messageId: "untokened" }] },
            { filename: SERVICE, code: provider("private readonly lookup: ReadonlyMap<string, number>"), errors: [{ messageId: "untokened" }] },
            { filename: SERVICE, code: provider("private readonly lookup: Map<string, number>"), errors: [{ messageId: "untokened" }] },
            // an interface has no runtime identity
            { filename: SERVICE, code: provider("private readonly options: Options", "interface Options { readonly retries: number }"), errors: [{ messageId: "untokened" }] },
            // a union hides the class from the emitted metadata
            { filename: SERVICE, code: provider("private readonly clock: Clock | null"), errors: [{ messageId: "untokened" }] },
            // a type alias of a class is not the class
            { filename: SERVICE, code: provider("private readonly clock: Aliased", "type Aliased = Clock | undefined"), errors: [{ messageId: "untokened" }] },
            { filename: SERVICE, code: provider("private readonly handler: () => void"), errors: [{ messageId: "untokened" }] },
            { filename: SERVICE, code: provider("private readonly loose"), errors: [{ messageId: "unannotated" }] },
            // a controller is a provider too
            { filename: HANDLER, code: `import { Controller } from "@nestjs/common"\n@Controller()\nclass C { constructor(private readonly limit: number) {} }`, errors: [{ messageId: "untokened" }] },
            // a spec is not exempt
            { filename: SERVICE_SPEC, code: provider("private readonly timeoutMs: number"), errors: [{ messageId: "untokened" }] },
        ],
    })
})

test("R83: a persistence class lives only where the manager may be held", () => {
    const wrapper = `${TYPEORM}export class OrderRepository { find(manager: EntityManager, id: string): Promise<unknown> { return manager.query(id) } }`
    tester.run("no-repository-class", noRepositoryClass, {
        valid: [
            // the roles that may hold the manager
            { filename: HANDLER, code: wrapper },
            { filename: SERVICE, code: wrapper },
            { filename: PLATFORM_DATABASE, code: wrapper },
            // the cli, the test world and a migration receive a connection or a runner by nature
            { filename: MIGRATE, code: `${TYPEORM}export class Runner { run(source: DataSource) { return source.query("select 1") } }` },
            { filename: WORLD, code: `${TYPEORM}export class World { constructor(readonly source: DataSource) {} }` },
            { filename: MIGRATION, code: `${TYPEORM}export class CreateOrders { up(runner: QueryRunner) { return runner.query("select 1") } }` },
            // a class implementing typeorm's MigrationInterface is a migration wherever it sits (a fixture migration too)
            { filename: FIXTURE, code: `import { MigrationInterface, QueryRunner } from "typeorm"\nexport class AddProbe implements MigrationInterface {\n up(runner: QueryRunner): Promise<void> { return runner.query("select 1").then(() => undefined) }\n down(runner: QueryRunner): Promise<void> { return runner.query("select 1").then(() => undefined) } }` },
            // a class with no persistence type anywhere
            { filename: MAPPER, code: "export class OrderMapper { map(row: { id: string }): string { return row.id } }" },
            // a class that only shares the name of the type
            { filename: MAPPER, code: "class Repository<T> { find(): T | null { return null } }\nexport class OrderMapper { constructor(private readonly repository: Repository<string>) {} }" },
            // a service runs its SQL constant through the injected manager; a builder of the test tree takes one by design
            { filename: SERVICE, code: `${TYPEORM}declare const ORDERS_SQL: string
export class OrderService { constructor(private readonly entityManager: EntityManager) {}
 list() { return this.entityManager.query(ORDERS_SQL, []) } }` },
            { filename: at("src/tests/fixtures/builders/order.builder.ts"), code: `${TYPEORM}export const buildOrder = (em: EntityManager) => em.query("select 1")
export class OrderBuilder { constructor(private readonly em: EntityManager) {} }` },
            { filename: SERVICE, code: `${TYPEORM}export const helper = (em: EntityManager) => em` },
            // a function that takes the manager second, or takes no manager, is not a statement module
            { filename: MAPPER, code: `${TYPEORM}export const load = (id: string, em: EntityManager) => em.query(id)` },
            // a function that is not exported is a private detail of its file
            { filename: MAPPER, code: `${TYPEORM}const load = (manager: EntityManager) => manager.query("select 1")
export const x = load` },
        ],
        invalid: [
            // the shape of the census findings: a per-entity class whose methods take the manager
            { filename: REPOSITORY_FILE, code: wrapper, errors: [{ messageId: "repository" }] },
            // whatever it is called
            { filename: MAPPER, code: `${TYPEORM}export class OrderReader { one(manager: EntityManager) { return manager.query("select 1") } }`, errors: [{ messageId: "repository" }] },
            { filename: MAPPER, code: `${TYPEORM}export class OrderStore { constructor(private readonly manager: EntityManager) {} }`, errors: [{ messageId: "repository" }] },
            { filename: MAPPER, code: `${TYPEORM}export class OrderStore { private readonly rows!: Repository<string> }`, errors: [{ messageId: "repository" }] },
            { filename: MAPPER, code: `${TYPEORM}export class OrderStore { transaction(): EntityManager { return null as never } }`, errors: [{ messageId: "repository" }] },
            // an alias of the type is the same type
            { filename: MAPPER, code: `${TYPEORM}type Db = EntityManager\nexport class OrderStore { one(db: Db) { return db } }`, errors: [{ messageId: "repository" }] },
            // one finding per class, not one per method
            { filename: REPOSITORY_FILE, code: `${TYPEORM}export class OrderRepository { a(m: EntityManager) { return m }\n b(m: EntityManager) { return m } }`, errors: [{ messageId: "repository" }] },
            // renamed wrappers: a store, a dao, a gateway and a statements module, in persistence/ or anywhere else
            { filename: at("src/modules/domain/order/persistence/typeorm-order.store.ts"), code: `${TYPEORM}export class TypeOrmOrderStore { constructor(private readonly entityManager: EntityManager) {} }`, errors: [{ messageId: "repository" }] },
            { filename: at("src/modules/domain/order/order.dao.ts"), code: `${TYPEORM}export class OrderDao { find(em: EntityManager) { return em } }`, errors: [{ messageId: "repository" }] },
            { filename: at("src/features/api/checkout/application/order.gateway.ts"), code: `${TYPEORM}export class OrderGateway { private manager!: EntityManager
 set(em: EntityManager) { this.manager = em } }`, errors: [{ messageId: "repository" }] },
            { filename: at("src/modules/domain/order/persistence/order.statements.ts"), code: `${TYPEORM}export function insertOrder(em: EntityManager, id: string) { return em.query(id) }`, errors: [{ messageId: "statements" }] },
            { filename: at("src/modules/domain/order/persistence/order.statements.ts"), code: `${TYPEORM}export const insertOrder = async (em: EntityManager, id: string) => em.query(id)`, errors: [{ messageId: "statements" }] },
        ],
    })
})

test("R89: production source names no test double", () => {
    tester.run("no-test-double-in-source", noTestDoubleInSource, {
        valid: [
            // whole words only
            { filename: SERVICE, code: "export class FakerAdapter {}" },
            { filename: SERVICE, code: "export class MockingbirdReader {}" },
            { filename: SERVICE, code: "export class StubbornRetry {}" },
            { filename: SERVICE, code: "export class OfflineExpertAgentService {}" },
            // doubles live in specs and in src/tests
            { filename: SERVICE_SPEC, code: "class MockClock {}\nconst fakeOrder = 1\nexport { MockClock, fakeOrder }" },
            { filename: FIXTURE, code: "export class FakeClock {}" },
            { filename: WORLD, code: "export const stubServer = 1" },
            // a local that is not exported is a private detail of the file
            { filename: SERVICE, code: "const mockable = 1\nexport const x = mockable" },
        ],
        invalid: [
            { filename: SERVICE, code: "export class MockExpertAgentService {}", errors: [{ messageId: "double" }] },
            { filename: SERVICE, code: "export class FakeClock {}", errors: [{ messageId: "double" }] },
            { filename: SERVICE, code: "export class StubCatalogStore {}", errors: [{ messageId: "double" }] },
            { filename: SERVICE, code: "export class HTTPStubAdapter {}", errors: [{ messageId: "double" }] },
            { filename: SERVICE, code: "class MockLocal {}\nexport { MockLocal }", errors: [{ messageId: "double" }] },
            { filename: SERVICE, code: "export const mockCatalog = {}", errors: [{ messageId: "double" }] },
            { filename: SERVICE, code: "export const MOCK_CATALOG = {}", errors: [{ messageId: "double" }] },
            { filename: SERVICE, code: "export function makeFakeCatalog() { return {} }", errors: [{ messageId: "double" }] },
            { filename: HANDLER, code: "export class MockPlaceOrderHandler {}", errors: [{ messageId: "double" }] },
        ],
    })
})

test("the double marker is a whole word of the identifier, never a substring", () => {
    assert.equal(doubleWordOf("MockExpertAgentService"), "Mock")
    assert.equal(doubleWordOf("makeFakeCatalog"), "Fake")
    assert.equal(doubleWordOf("HTTPStubAdapter"), "Stub")
    assert.equal(doubleWordOf("FAKE_CLOCK"), "FAKE")
    assert.equal(doubleWordOf("Faker"), null)
    assert.equal(doubleWordOf("Mockingbird"), null)
    assert.equal(doubleWordOf("Stubborn"), null)
})

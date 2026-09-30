/**
 * Twin tests for the data-access rules (R82, R83).
 *
 *   node --test data-access.test.mjs
 *
 * Every case is a virtual file under the typed fixture root, so slots come from the path and `EntityManager`, `DataSource`,
 * `QueryRunner` and the repository types from the `typeorm` stub. The loopholes each rule closes are cases here: a renamed
 * variable, a type alias, property injection, a lookalike injector name, a spec file.
 */
import assert from "node:assert/strict"
import test from "node:test"
import {
    mustInjectEntityManager,
    namedEntityManagerOnly,
    noEagerRelation,
    noExternalCallInTransaction,
    noInjectedRepository,
    noOuterManagerInTransaction,
    requireEntityTableName,
    rules,
} from "./data-access.mjs"
import { at, typedTester } from "./fixtures/typed/tester.mjs"

const tester = typedTester()

const HANDLER = at("src/features/checkout/application/place.handler.ts")
const HANDLER_SPEC = at("src/features/checkout/application/place.handler.spec.ts")
const SERVICE = at("src/modules/domain/order/order.service.ts")
const DATABASE_MODULE = at("src/modules/platform/database/database.module.ts")
const MIGRATE = at("apps/migrate/src/main.ts")
const E2E_WORLD = at("src/tests/fixtures/e2e/database-world.ts")
const E2E_SPEC = at("src/tests/e2e/checkout/place-order.e2e-spec.ts")
const ENTITY = at("src/modules/domain/order/persistence/entities/order.entity.ts")

const TYPEORM = 'import { DataSource, EntityManager, QueryRunner, Repository, TreeRepository } from "typeorm"\ndeclare class OrderEntity {}\n'
const constructorOf = (parameter) => `${TYPEORM}class S { constructor(${parameter}) {} }`

test("every rule this law declares is exported under its published name", () => {
    for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("R83: an injected manager carries the named injector of a declared connection", () => {
    tester.run("must-inject-entity-manager", mustInjectEntityManager, {
        valid: [
            { filename: HANDLER, code: constructorOf("@InjectPrimaryEntityManager() private readonly entityManager: EntityManager") },
            { filename: HANDLER, code: constructorOf("@InjectPrimaryEntityManager() readonly entityManager: EntityManager") },
            // not a manager
            { filename: HANDLER, code: `${TYPEORM}class S { constructor(private readonly clock: Date) {} }` },
            // not a constructor
            { filename: HANDLER, code: `${TYPEORM}class S { run(manager: EntityManager) { return manager } }` },
        ],
        invalid: [
            { filename: HANDLER, code: constructorOf("private readonly entityManager: EntityManager"), errors: [{ messageId: "undecorated" }] },
            { filename: HANDLER, code: constructorOf("entityManager: EntityManager"), errors: [{ messageId: "undecorated" }] },
            // a lookalike is not a declared connection's injector
            { filename: HANDLER, code: constructorOf("@InjectFooEntityManager() private readonly entityManager: EntityManager"), errors: [{ messageId: "undecorated" }] },
            // the library decorator names no connection here
            { filename: HANDLER, code: constructorOf("@InjectEntityManager() private readonly entityManager: EntityManager"), errors: [{ messageId: "undecorated" }] },
            { filename: HANDLER, code: constructorOf("@Inject(TOKEN) private readonly entityManager: EntityManager"), errors: [{ messageId: "undecorated" }] },
            // the injector name is right but for another connection than any declared
            { filename: HANDLER, code: constructorOf("@InjectAgentosEntityManager() private readonly entityManager: EntityManager"), errors: [{ messageId: "undecorated" }] },
            // an alias of the type is the same type
            { filename: HANDLER, code: `${TYPEORM}type Db = EntityManager\nclass S { constructor(private readonly db: Db) {} }`, errors: [{ messageId: "undecorated" }] },
            // a spec is not exempt
            { filename: HANDLER_SPEC, code: constructorOf("private readonly entityManager: EntityManager"), errors: [{ messageId: "undecorated" }] },
        ],
    })
})

test("R83: no property injection, no injected DataSource or QueryRunner outside the platform database capability, no getRepository", () => {
    tester.run("named-entity-manager-only", namedEntityManagerOnly, {
        valid: [
            { filename: HANDLER, code: constructorOf("@InjectPrimaryEntityManager() private readonly entityManager: EntityManager") },
            // the platform database capability and the migrate app hold the connections
            { filename: DATABASE_MODULE, code: constructorOf("private readonly dataSource: DataSource") },
            { filename: DATABASE_MODULE, code: constructorOf("private readonly runner: QueryRunner") },
            { filename: MIGRATE, code: constructorOf("private readonly dataSource: DataSource") },
            // the test bootstrap (slot be.tests.fixtures) owns the e2e database world
            { filename: E2E_WORLD, code: constructorOf("private readonly dataSource: DataSource") },
            // a getRepository that is not typeorm's
            { filename: HANDLER, code: "declare const registry: { getRepository(name: string): string }\nregistry.getRepository('orders')" },
        ],
        invalid: [
            { filename: HANDLER, code: `${TYPEORM}class S { @InjectPrimaryEntityManager() private readonly entityManager: EntityManager }`, errors: [{ messageId: "property" }] },
            { filename: HANDLER, code: `${TYPEORM}class S { private readonly dataSource!: DataSource }`, errors: [{ messageId: "property" }] },
            { filename: HANDLER, code: constructorOf("private readonly dataSource: DataSource"), errors: [{ messageId: "infra" }] },
            { filename: SERVICE, code: constructorOf("@InjectDataSource() private readonly source: DataSource"), errors: [{ messageId: "infra" }] },
            { filename: SERVICE, code: constructorOf("private readonly runner: QueryRunner"), errors: [{ messageId: "infra" }] },
            // an alias of the type is the same type
            { filename: SERVICE, code: `${TYPEORM}type Source = DataSource\nclass S { constructor(private readonly source: Source) {} }`, errors: [{ messageId: "infra" }] },
            { filename: HANDLER, code: `${TYPEORM}declare const manager: EntityManager\nmanager.getRepository(OrderEntity)`, errors: [{ messageId: "getRepository" }] },
            { filename: HANDLER, code: `${TYPEORM}declare const source: DataSource\nsource.getRepository(OrderEntity)`, errors: [{ messageId: "getRepository" }] },
            // a renamed receiver is still the manager
            { filename: HANDLER, code: `${TYPEORM}declare const manager: EntityManager\nconst db = manager\ndb.getRepository(OrderEntity)`, errors: [{ messageId: "getRepository" }] },
            // a spec is not exempt
            { filename: HANDLER_SPEC, code: `${TYPEORM}declare const source: DataSource\nsource.getRepository(OrderEntity)`, errors: [{ messageId: "getRepository" }] },
            { filename: HANDLER_SPEC, code: constructorOf("private readonly source: DataSource"), errors: [{ messageId: "infra" }] },
            // an e2e spec takes the fixture's EntityManager, never a DataSource of its own
            { filename: E2E_SPEC, code: constructorOf("private readonly source: DataSource"), errors: [{ messageId: "infra" }] },
            { filename: E2E_SPEC, code: `${TYPEORM}declare const source: DataSource
source.getRepository(OrderEntity)`, errors: [{ messageId: "getRepository" }] },
            // the bootstrap may hold a DataSource but still never binds a repository
            { filename: E2E_WORLD, code: `${TYPEORM}declare const source: DataSource
source.getRepository(OrderEntity)`, errors: [{ messageId: "getRepository" }] },
        ],
    })
})

test("R83: persistence never arrives as a repository", () => {
    tester.run("no-injected-repository", noInjectedRepository, {
        valid: [
            { filename: HANDLER, code: constructorOf("@InjectPrimaryEntityManager() private readonly entityManager: EntityManager") },
            // a class that only shares the name
            { filename: HANDLER, code: "class Repository<T> {}\nclass S { constructor(private readonly repository: Repository<string>) {} }" },
        ],
        invalid: [
            // the decorator and the type are one finding, reported once
            { filename: HANDLER, code: constructorOf("@InjectRepository(OrderEntity) private readonly repository: Repository<OrderEntity>"), errors: [{ messageId: "repo" }] },
            { filename: HANDLER, code: constructorOf("private readonly repository: Repository<OrderEntity>"), errors: [{ messageId: "repo" }] },
            { filename: HANDLER, code: constructorOf("private readonly tree: TreeRepository<OrderEntity>"), errors: [{ messageId: "repo" }] },
            { filename: HANDLER, code: `${TYPEORM}class S { private repository!: Repository<OrderEntity> }`, errors: [{ messageId: "repo" }] },
            { filename: HANDLER, code: `${TYPEORM}type Repo = Repository<OrderEntity>\nclass S { constructor(private readonly repository: Repo) {} }`, errors: [{ messageId: "repo" }, { messageId: "repo" }] },
            { filename: HANDLER_SPEC, code: constructorOf("private readonly repository: Repository<OrderEntity>"), errors: [{ messageId: "repo" }] },
            { filename: DATABASE_MODULE, code: 'import { TypeOrmModule } from "@nestjs/typeorm"\nconst m = TypeOrmModule.forFeature([])', errors: [{ messageId: "forFeature" }] },
        ],
    })
})

test("DATA-3: an entity names its table", () => {
    tester.run("require-entity-table-name", requireEntityTableName, {
        valid: [
            { filename: ENTITY, code: '@Entity("cart_items") class CartItemEntity {}' },
            { filename: ENTITY, code: '@Entity({ name: "cart_items", schema: "billing" }) class CartItemEntity {}' },
            { filename: ENTITY, code: "@Injectable() class Service {}" },
        ],
        invalid: [
            { filename: ENTITY, code: "@Entity() class CartItemEntity {}", errors: [{ messageId: "inferred" }] },
            { filename: ENTITY, code: '@Entity({ schema: "billing" }) class CartItemEntity {}', errors: [{ messageId: "inferred" }] },
        ],
    })
})

test("R83: everything inside a transaction receives the transactional manager", () => {
    const head = `${TYPEORM}class H {\n constructor(private readonly entityManager: EntityManager, private readonly clock: Date) {}\n async run() {\n`
    const inside = (body) => `${head}${body}\n }\n}`
    tester.run("no-outer-manager-in-transaction", noOuterManagerInTransaction, {
        valid: [
            // the callback uses only the manager it was handed, under any name
            { filename: HANDLER, code: inside("return this.entityManager.transaction(async (manager) => { await manager.save(OrderEntity); return manager.query('x') })") },
            { filename: HANDLER, code: inside("return this.entityManager.transaction(async (tx) => { await tx.save(OrderEntity) })") },
            // an isolation level before the callback
            { filename: HANDLER, code: inside("return this.entityManager.transaction('SERIALIZABLE', async (tx) => { await tx.save(OrderEntity) })") },
            // a value that is not a manager
            { filename: HANDLER, code: inside("return this.entityManager.transaction(async (tx) => { this.clock.getTime(); return tx.save(OrderEntity) })") },
            // not a transaction call
            { filename: HANDLER, code: inside("return this.entityManager.find(OrderEntity)") },
            // a manager declared inside the callback is the callback's own
            { filename: HANDLER, code: inside("return this.entityManager.transaction(async (tx) => { const inner = tx; await inner.save(OrderEntity) })") },
            // a transaction that is not typeorm's
            { filename: HANDLER, code: "declare const queue: { transaction(work: () => void): void }\ndeclare const outer: { save(): void }\nqueue.transaction(() => outer.save())" },
        ],
        invalid: [
            { filename: HANDLER, code: inside("return this.entityManager.transaction(async (tx) => { await this.entityManager.save(OrderEntity) })"), errors: [{ messageId: "outerManager" }] },
            // the second write is the one that escapes
            { filename: HANDLER, code: inside("return this.entityManager.transaction(async (tx) => { await tx.save(OrderEntity); await this.entityManager.save(OrderEntity) })"), errors: [{ messageId: "outerManager" }] },
            // a renamed outer manager is found by type, not by `this.<field>`
            { filename: HANDLER, code: inside("const outer = this.entityManager\n return this.entityManager.transaction(async (tx) => { await outer.save(OrderEntity) })"), errors: [{ messageId: "outerManager" }] },
            // a manager parameter of the enclosing method is outside the callback too
            { filename: HANDLER, code: `${TYPEORM}async function run(manager: EntityManager, other: EntityManager) { await manager.transaction(async (tx) => { await other.save(OrderEntity) }) }`, errors: [{ messageId: "outerManager" }] },
            // a manager reached through a data source
            { filename: HANDLER, code: `${TYPEORM}async function run(source: DataSource) { await source.transaction(async (tx) => { await source.manager.save(OrderEntity) }) }`, errors: [{ messageId: "outerManager" }] },
            { filename: HANDLER_SPEC, code: inside("return this.entityManager.transaction(async (tx) => { await this.entityManager.save(OrderEntity) })"), errors: [{ messageId: "outerManager" }] },
        ],
    })
})

test("DATA-5: a relation carries no eager: true", () => {
    tester.run("no-eager-relation", noEagerRelation, {
        valid: [
            { filename: ENTITY, code: "class C { @ManyToOne(() => CourseEntity, (c) => c.items) course: CourseEntity }" },
            { filename: ENTITY, code: "class C { @ManyToOne(() => CourseEntity, (c) => c.items, { eager: false }) course: CourseEntity }" },
            { filename: ENTITY, code: "class C { @Column({ eager: true }) name: string }" },
        ],
        invalid: [
            { filename: ENTITY, code: "class C { @ManyToOne(() => CourseEntity, (c) => c.items, { eager: true }) course: CourseEntity }", errors: [{ messageId: "eager" }] },
            { filename: ENTITY, code: "class C { @OneToMany(() => ItemEntity, (i) => i.course, { eager: true }) items: ItemEntity[] }", errors: [{ messageId: "eager" }] },
        ],
    })
})

test("R82: no transaction spans an external call", () => {
    const head = `${TYPEORM}import { StripeClient } from "@modules/integrations/stripe/stripe.client"\nimport { PayOsGateway } from "@modules/integrations/payos/payos.gateway"\nimport { HttpClient } from "@modules/platform/http/http.client"\nimport { MessagePublisher } from "@modules/platform/messaging/message-publisher"\nimport { HttpClient as LocalClient } from "@modules/domain/order/http.client"\n`
    const S = `${head}class S {\n constructor(private readonly entityManager: EntityManager, private readonly stripe: StripeClient, private readonly payos: PayOsGateway, private readonly http: HttpClient, private readonly publisher: MessagePublisher, private readonly local: LocalClient, private readonly deps: { stripe: StripeClient }) {}\n`
    const inside = (body) => `${S} async run() { ${body} }\n}`
    tester.run("no-external-call-in-transaction", noExternalCallInTransaction, {
        valid: [
            // only the transactional manager
            { filename: HANDLER, code: inside("await this.entityManager.transaction(async (tx) => { await tx.save(OrderEntity) })") },
            // commit first, then call out
            { filename: HANDLER, code: inside("await this.entityManager.transaction(async (tx) => { await tx.save(OrderEntity) })\n await this.stripe.charge('1')") },
            // fetch outside a transaction
            { filename: HANDLER, code: "async function run() { await fetch('x') }" },
            // a receiver typed from neither an integration nor the platform is not external, whatever it is called
            { filename: HANDLER, code: inside("await this.entityManager.transaction(async (tx) => { await this.local.get('x') })") },
            // a transaction that is not typeorm's
            { filename: HANDLER, code: `${head}declare const queue: { transaction(work: () => void): void }\ndeclare const stripe: StripeClient\nqueue.transaction(() => stripe.charge('1'))` },
        ],
        invalid: [
            { filename: HANDLER, code: inside("await this.entityManager.transaction(async (tx) => { await tx.save(OrderEntity); await this.stripe.charge('1') })"), errors: [{ messageId: "external" }] },
            // an integration type that is not named like a client
            { filename: HANDLER, code: inside("await this.entityManager.transaction(async (tx) => { await this.payos.create('1') })"), errors: [{ messageId: "external" }] },
            { filename: HANDLER, code: inside("await this.entityManager.transaction(async (tx) => { await this.http.get('x') })"), errors: [{ messageId: "external" }] },
            { filename: HANDLER, code: inside("await this.entityManager.transaction(async (tx) => { await this.publisher.publish({}) })"), errors: [{ messageId: "external" }] },
            { filename: HANDLER, code: inside("await this.entityManager.transaction(async (tx) => { await fetch('x') })"), errors: [{ messageId: "external" }] },
            // a chain whose receiver is an integration object
            { filename: HANDLER, code: inside("await this.entityManager.transaction(async (tx) => { await this.deps.stripe.charge('1') })"), errors: [{ messageId: "external" }] },
            // a renamed receiver is still the integration
            { filename: HANDLER, code: inside("const gateway = this.payos\n await this.entityManager.transaction(async (tx) => { await gateway.create('1') })"), errors: [{ messageId: "external" }] },
            { filename: HANDLER_SPEC, code: inside("await this.entityManager.transaction(async (tx) => { await this.stripe.charge('1') })"), errors: [{ messageId: "external" }] },
        ],
    })
})

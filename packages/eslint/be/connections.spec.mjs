/**
 * Twin tests for the connection rules (R84, R88 `em-injection-slots`).
 *
 *   node --test connections.spec.mjs
 *
 * The fixture repository declares one connection, `primary` (env prefix `PRIMARY_DB`). Files are virtual paths under the
 * typed fixture root, so the HFS slot of each case comes from its path and the types from the stubs beside it.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { emInjectionSlots, oneConnectionPerDatabase, rules } from "./connections.mjs"
import { at, typedTester } from "./fixtures/typed/tester.mjs"

const tester = typedTester()

const DECORATORS = at("src/modules/platform/database/primary.decorators.ts")
const CONNECTION = at("src/modules/platform/database/primary.connection.ts")
const CONFIG = at("src/modules/platform/database/primary.config.ts")
const DATABASE_MODULE = at("src/modules/platform/database/database.module.ts")
const DATABASE_INDEX = at("src/modules/platform/database/index.ts")
const HANDLER = at("src/features/checkout/application/place.handler.ts")
const RESOLVER = at("src/features/checkout/transport/graphql/place.resolver.ts")
const SERVICE = at("src/modules/domain/order/order.service.ts")
const MIGRATE = at("apps/migrate/src/main.ts")
const DATABASE_FIXTURE = at("src/tests/fixtures/database.ts")
const OTHER = at("src/modules/domain/order/order.helper.ts")
const E2E_WORLD = at("src/tests/world/use-test-world.ts")
const E2E_SPEC = at("src/tests/e2e/checkout/place-order.e2e-spec.ts")

const COMPOSITION = 'import { injector, type TypedParameterDecorator } from "@modules/platform/composition/injector"\n'
const INJECTOR = `import { getEntityManagerToken } from "@nestjs/typeorm"\nimport type { EntityManager } from "typeorm"\n${COMPOSITION}`
const declaration = (name, token = "PRIMARY_CONNECTION") =>
    `${INJECTOR}export const ${name} = (): TypedParameterDecorator<EntityManager> => injector(getEntityManagerToken(${token}))`

test("every rule this law declares is exported under its published name", () => {
    for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("R84: an EntityManager injector is the one injector of a declared connection, declared in its own file", () => {
    tester.run("one-connection-per-database", oneConnectionPerDatabase, {
        valid: [
            { filename: DECORATORS, code: declaration("InjectPrimaryEntityManager") },
            // an injector of something else is not this rule's business, wherever it is written
            { filename: OTHER, code: `${COMPOSITION}declare class Clock {}\nexport const InjectClock = (): TypedParameterDecorator<Clock> => injector(CLOCK)` },
            // re-exporting the declared injector under its own name is the owner's public surface
            { filename: DATABASE_INDEX, code: 'export { InjectPrimaryEntityManager } from "./primary.injector"' },
            // the migrate app and the test database fixture may build the token
            { filename: MIGRATE, code: 'import { getEntityManagerToken } from "@nestjs/typeorm"\nconst token = getEntityManagerToken(PRIMARY_CONNECTION)' },
            { filename: DATABASE_FIXTURE, code: 'import { getEntityManagerToken } from "@nestjs/typeorm"\nexport const token = getEntityManagerToken(PRIMARY_CONNECTION)' },
        ],
        invalid: [
            {
                // RED01: a capability-specific injector for a database that already has one
                filename: at("src/modules/platform/database/collab.decorators.ts"),
                code: declaration("InjectCollabEntityManager", "COLLAB_CONNECTION"),
                errors: [{ messageId: "injectorHome" }, { messageId: "rawInjector" }],
            },
            {
                // the same name declared a second time in another file
                filename: at("src/modules/platform/lease/lease.decorators.ts"),
                code: declaration("InjectPrimaryEntityManager"),
                errors: [{ messageId: "injectorHome" }, { messageId: "rawInjector" }],
            },
            {
                // a second name in the connection's own file
                filename: DECORATORS,
                code: declaration("InjectDb"),
                errors: [{ messageId: "injectorHome" }],
            },
            {
                // an alias hides the type, not the meaning: the declared type is what counts
                filename: OTHER,
                code: `import type { EntityManager } from "typeorm"\n${COMPOSITION}type Em = TypedParameterDecorator<EntityManager>\nexport const InjectOrders = (): Em => injector(ORDERS)`,
                errors: [{ messageId: "injectorHome" }],
            },
            {
                // a function declaration is an injector too
                filename: OTHER,
                code: `import type { EntityManager } from "typeorm"\n${COMPOSITION}export function InjectOrders(): TypedParameterDecorator<EntityManager> { return injector(ORDERS) }`,
                errors: [{ messageId: "injectorHome" }],
            },
            {
                // an alias re-export is a second injector
                filename: DATABASE_INDEX,
                code: 'export { InjectPrimaryEntityManager as InjectDb } from "./primary.injector"',
                errors: [{ messageId: "injectorHome" }],
            },
            {
                filename: HANDLER,
                code: 'import { InjectEntityManager } from "@nestjs/typeorm"\nclass H { constructor(@InjectEntityManager(PRIMARY_CONNECTION) private readonly manager: EntityManager) {} }',
                errors: [{ messageId: "rawInjector" }],
            },
            {
                filename: HANDLER,
                code: 'import { InjectDataSource } from "@nestjs/typeorm"\nclass H { constructor(@InjectDataSource() private readonly source: DataSource) {} }',
                errors: [{ messageId: "rawInjector" }],
            },
            {
                // a renamed import is still the same function
                filename: HANDLER,
                code: 'import { getEntityManagerToken as tokenOf } from "@nestjs/typeorm"\nconst token = tokenOf(PRIMARY_CONNECTION)',
                errors: [{ messageId: "rawInjector" }],
            },
        ],
    })
})

test("R84: a connection is registered once, in the platform database capability or the migrate app", () => {
    tester.run("one-connection-per-database", oneConnectionPerDatabase, {
        valid: [
            { filename: DATABASE_MODULE, code: 'import { TypeOrmModule } from "@nestjs/typeorm"\nconst m = TypeOrmModule.forRootAsync({ name: PRIMARY_CONNECTION })' },
            { filename: DATABASE_MODULE, code: 'import { DataSource } from "typeorm"\nconst source = new DataSource({ name: PRIMARY_CONNECTION })' },
            { filename: MIGRATE, code: 'import { DataSource } from "typeorm"\nconst source = new DataSource({ name: PRIMARY_CONNECTION })' },
            // the test world (slot be.tests.world) builds the DataSource
            { filename: E2E_WORLD, code: 'import { DataSource } from "typeorm"\nconst source = new DataSource({ name: PRIMARY_CONNECTION })' },
            // the same words on a class that is not typeorm's
            { filename: OTHER, code: "class DataSource {}\nconst source = new DataSource()\nconst TypeOrmModule = { forRoot() {} }\nTypeOrmModule.forRoot()" },
        ],
        invalid: [
            { filename: OTHER, code: 'import { TypeOrmModule } from "@nestjs/typeorm"\nconst m = TypeOrmModule.forRoot({})', errors: [{ messageId: "registration" }] },
            { filename: OTHER, code: 'import { TypeOrmModule } from "@nestjs/typeorm"\nconst m = TypeOrmModule.forRootAsync({})', errors: [{ messageId: "registration" }] },
            { filename: SERVICE, code: 'import { DataSource } from "typeorm"\nconst source = new DataSource({})', errors: [{ messageId: "registration" }] },
            // an e2e spec never builds its own DataSource; it takes the fixture's EntityManager
            { filename: E2E_SPEC, code: 'import { DataSource } from "typeorm"\nconst source = new DataSource({})', errors: [{ messageId: "registration" }] },
            // an imported alias is the same class
            { filename: SERVICE, code: 'import { DataSource as Db } from "typeorm"\nconst source = new Db({})', errors: [{ messageId: "registration" }] },
        ],
    })
})

test("R84: the connection name is written once, in its connection file", () => {
    tester.run("one-connection-per-database", oneConnectionPerDatabase, {
        valid: [
            { filename: CONNECTION, code: 'export const PRIMARY_CONNECTION = "primary"' },
            // a word that happens to equal a connection name is not a connection
            { filename: OTHER, code: 'const variant = "primary"\nconst button = { kind: "primary" }' },
            { filename: OTHER, code: 'export const OTHER_CONNECTION = "other"' },
        ],
        invalid: [
            { filename: OTHER, code: 'export const PRIMARY_CONNECTION = "primary"', errors: [{ messageId: "literal" }] },
            { filename: DECORATORS, code: 'import { getEntityManagerToken } from "@nestjs/typeorm"\nconst token = getEntityManagerToken("primary")', errors: [{ messageId: "literal" }] },
            { filename: DATABASE_MODULE, code: 'import { TypeOrmModule } from "@nestjs/typeorm"\nconst m = TypeOrmModule.forRoot({ name: "primary" })', errors: [{ messageId: "literal" }] },
            { filename: MIGRATE, code: 'import { DataSource } from "typeorm"\nconst source = new DataSource({ name: "primary" })', errors: [{ messageId: "literal" }] },
        ],
    })
})

test("R84: a connection config reads only keys of its own env prefix", () => {
    const head = 'import { EnvSource } from "@modules/platform/config/env-source"\ndeclare const env: EnvSource\n'
    tester.run("one-connection-per-database", oneConnectionPerDatabase, {
        valid: [
            { filename: CONFIG, code: `${head}const host = env.string("PRIMARY_DB_HOST")\nconst port = env.optional("PRIMARY_DB_PORT")` },
            // the class's own static constructor reads no key
            { filename: CONFIG, code: `${head}const source = EnvSource.of({})` },
            // not a connection config: any key
            { filename: at("src/modules/platform/config/app.config.ts"), code: `${head}const mode = env.string("APP_MODE")` },
            // a receiver that is not the EnvSource reader
            { filename: CONFIG, code: "declare const bag: { string(key: string): string }\nconst other = bag.string('AGENTOS_DB_HOST')" },
        ],
        invalid: [
            { filename: CONFIG, code: `${head}const host = env.string("AGENTOS_DB_HOST")`, errors: [{ messageId: "envKey" }] },
            { filename: CONFIG, code: `${head}const host = env.optional("PRIMARY_HOST")`, errors: [{ messageId: "envKey" }] },
            { filename: CONFIG, code: `${head}declare const key: string\nconst host = env.string(key)`, errors: [{ messageId: "envKey" }] },
            { filename: CONFIG, code: `${head}const host = env.string(\`AGENTOS_\${suffix}\`)`, errors: [{ messageId: "envKey" }] },
        ],
    })
})

test("R88: an EntityManager is injected only in application handlers, domain services and platform persistence capabilities", () => {
    const manager = 'import { EntityManager } from "typeorm"\n'
    const injected = `${manager}class H { constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {} }`
    tester.run("em-injection-slots", emInjectionSlots, {
        valid: [
            { filename: HANDLER, code: injected },
            { filename: SERVICE, code: injected },
            { filename: at("src/modules/platform/inbox/inbox.service.ts"), code: injected },
            { filename: at("src/modules/platform/lease/lease.ts"), code: injected },
            // no manager, no finding
            { filename: RESOLVER, code: "class R { constructor(private readonly commandBus: CommandBus) {} }" },
        ],
        invalid: [
            { filename: RESOLVER, code: injected, errors: [{ messageId: "slot" }] },
            { filename: at("src/features/checkout/transport/http/place.controller.ts"), code: injected, errors: [{ messageId: "slot" }] },
            { filename: at("src/modules/integrations/stripe/stripe.service.ts"), code: injected, errors: [{ messageId: "slot" }] },
            { filename: at("apps/api/src/app.module.ts"), code: injected, errors: [{ messageId: "slot" }] },
            // a handler's own folder is not enough: only `*.handler.ts`, and a spec beside it is not one
            { filename: at("src/features/checkout/application/place.command.ts"), code: injected, errors: [{ messageId: "slot" }] },
            { filename: OTHER, code: injected, errors: [{ messageId: "slot" }] },
            // property injection of the manager is refused in the same places
            { filename: RESOLVER, code: `${manager}class R { @InjectPrimaryEntityManager() private readonly entityManager: EntityManager }`, errors: [{ messageId: "slot" }] },
            // an alias of the type is the same type
            { filename: RESOLVER, code: `${manager}type Db = EntityManager\nclass R { constructor(private readonly db: Db) {} }`, errors: [{ messageId: "slot" }] },
        ],
    })
})

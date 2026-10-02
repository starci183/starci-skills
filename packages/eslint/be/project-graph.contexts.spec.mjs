import fs from "node:fs"
import test from "node:test"
import { projectFixture } from "./fixtures/project/tester.mjs"
import { rules } from "./project-graph.mjs"

// Bounded contexts (R159 BE_CONTEXT_OWNER, R160 BE_CONTEXT_COUPLING, R161 BE_CONTEXT_TRANSACTION, R163 BE_CONTEXT_PLATFORM_TABLES, and the
// per-connection carve-out of BE_SCHEMA_OWNER). One repository of three contexts: identity, order (with the cart capability) and billing.
// A connection is a context; a capability belongs to the connection its persistence arrays are registered on.
const DATABASE = "src/modules/platform/database"
const DOMAIN = "src/modules/domain"
const PLATFORM = "src/modules/platform"
const pascal = (name) => name[0].toUpperCase() + name.slice(1)

const databaseFiles = {
    [`${DATABASE}/index.ts`]: "export { sql } from './sql';\nexport { DatabaseModule } from './database.module';\n",
    [`${DATABASE}/sql.ts`]: 'export const sql = (strings: TemplateStringsArray, ...values: unknown[]): string => strings.join("?") + values.length;\n',
    [`${DATABASE}/database.module.ts`]: "import { Module } from '@nestjs/common';\n@Module({})\nexport class DatabaseModule {\n  static register(options: { connections: { name: string }[] }) { return { module: DatabaseModule, ...options }; }\n}\n",
    [`${DATABASE}/manager.ts`]: "export declare class EntityManager { transaction<T>(run: (manager: EntityManager) => Promise<T>): Promise<T>; save(entity: unknown): Promise<void> }\n",
}
const connectionFiles = (name, prefix) => ({
    [`${DATABASE}/${name}.connection.ts`]: `export const ${prefix}_CONNECTION = "${name}";\n`,
    [`${DATABASE}/${name}.decorators.ts`]: `import { getEntityManagerToken } from '@nestjs/typeorm';\nimport { ${prefix}_CONNECTION } from './${name}.connection';\ndeclare function injector(token: unknown): unknown;\nexport const Inject${pascal(name)}EntityManager = () => injector(getEntityManagerToken(${prefix}_CONNECTION));\n`,
    [`${DATABASE}/${name}.config.ts`]: `export const ${name}Config = () => ({ host: process.env.${prefix}_HOST, port: process.env.${prefix}_PORT, name: process.env.${prefix}_NAME });\n`,
})
const entity = (klass, table) => `import { Column, Entity, PrimaryColumn } from 'typeorm';\n@Entity("${table}")\nexport class ${klass} {\n  @PrimaryColumn({ name: 'id', type: 'uuid' }) id!: string;\n}\n`
const migration = (klass, sqlText) => `import { MigrationInterface, QueryRunner } from 'typeorm';\nexport class ${klass} implements MigrationInterface {\n  name = "${klass}";\n  async up(queryRunner: QueryRunner): Promise<void> { await queryRunner.query(\`${sqlText}\`); }\n  async down(queryRunner: QueryRunner): Promise<void> { await queryRunner.query('SELECT 1'); }\n}\n`
/** A capability with one entity, its migration and the arrays of persistence/connection.ts, exported from its index. */
const capability = (tier, name, table, extraIndex = "", migrationSql = "SELECT 1") => {
    const root = `src/modules/${tier}/${name}`
    const camel = name.replace(/-(.)/g, (_, c) => c.toUpperCase())
    const klass = `${pascal(camel)}Entity`
    const migrationClass = `Create${pascal(camel)}1790000000000`
    return {
        [`${root}/index.ts`]: `export { ${camel}Entities, ${camel}Migrations } from './persistence/connection';\n${extraIndex}`,
        [`${root}/persistence/connection.ts`]: `import { ${klass} } from './entities/${name}.entity';\nimport { ${migrationClass} } from './migrations/1790000000000-create-${name}';\nexport const ${camel}Entities = [${klass}];\nexport const ${camel}Migrations = [${migrationClass}];\n`,
        [`${root}/persistence/entities/${name}.entity.ts`]: entity(klass, table),
        [`${root}/persistence/migrations/1790000000000-create-${name}.ts`]: migration(migrationClass, migrationSql),
    }
}
const IDENTITY_INDEX = "export class IdentityService { lookup(): string { return 'user'; } }\n"
const BILLING_INDEX = "export class BillingService { charge(): string { return 'invoice'; } }\n"
const CART_INDEX = "export class CartService { total(): number { return 1; } }\n"
/** The imports an entry needs: the connection constant and the arrays of every capability it lists. */
const IMPORTS = {
    IDENTITY_CONNECTION: "import { IDENTITY_CONNECTION } from '../../../src/modules/platform/database/identity.connection';\nimport { identityEntities, identityMigrations } from '../../../src/modules/domain/identity';\n",
    ORDER_CONNECTION: "import { ORDER_CONNECTION } from '../../../src/modules/platform/database/order.connection';\nimport { orderEntities, orderMigrations } from '../../../src/modules/domain/order';\nimport { cartEntities, cartMigrations } from '../../../src/modules/domain/cart';\n",
    BILLING_CONNECTION: "import { BILLING_CONNECTION } from '../../../src/modules/platform/database/billing.connection';\nimport { billingEntities, billingMigrations } from '../../../src/modules/domain/billing';\n",
}
const registration = (entry) => `import { Module } from '@nestjs/common';\nimport { DatabaseModule } from '../../../src/modules/platform/database';\n${Object.entries(IMPORTS).filter(([name]) => entry.some((text) => text.includes(name))).map(([, text]) => text).join("")}@Module({ imports: [DatabaseModule.register({ connections: [${entry.join(", ")}] })] })\nexport class AppModule {}\n`
const IDENTITY_ENTRY = "{ name: IDENTITY_CONNECTION, entities: identityEntities, migrations: identityMigrations }"
const ORDER_ENTRY = "{ name: ORDER_CONNECTION, entities: [...orderEntities, ...cartEntities], migrations: [...orderMigrations, ...cartMigrations] }"
const BILLING_ENTRY = "{ name: BILLING_CONNECTION, entities: billingEntities, migrations: billingMigrations }"

const BASE = {
    ...databaseFiles,
    ...connectionFiles("identity", "IDENTITY"),
    ...connectionFiles("order", "ORDER"),
    ...connectionFiles("billing", "BILLING"),
    ...capability("domain", "identity", "users", IDENTITY_INDEX),
    ...capability("domain", "order", "orders"),
    ...capability("domain", "cart", "carts", CART_INDEX),
    ...capability("domain", "billing", "invoices", BILLING_INDEX),
    "apps/identity/src/app.module.ts": registration([IDENTITY_ENTRY]),
    "apps/order/src/app.module.ts": registration([ORDER_ENTRY]),
    "apps/billing/src/app.module.ts": registration([BILLING_ENTRY]),
    "apps/migrate/src/app.module.ts": registration([IDENTITY_ENTRY, ORDER_ENTRY, BILLING_ENTRY]),
}
const CONNECTIONS = [
    { name: "identity", envPrefix: "IDENTITY", owner: "identity", isolation: "database" },
    { name: "order", envPrefix: "ORDER", owner: "order", isolation: "schema" },
    { name: "billing", envPrefix: "BILLING", owner: "billing", isolation: "schema" },
]
const APPS = [{ name: "identity", kind: "api" }, { name: "order", kind: "api" }, { name: "billing", kind: "api" }, { name: "migrate", kind: "migrate" }]
const repo = (t, files = {}, options = {}) => {
    const f = projectFixture({ files: { ...BASE, ...files }, declaration: { connections: options.connections ?? CONNECTIONS }, apps: options.apps ?? APPS })
    t.after(f.cleanup)
    return f
}
const textOf = (f, files, rel) => files[rel] ?? BASE[rel] ?? fs.readFileSync(f.at(rel), "utf8")
const lineOf = (text, needle) => text.split("\n").findIndex((line) => line.includes(needle)) + 1
const ok = (f, files, rels) => rels.map((rel) => ({ filename: f.at(rel), code: textOf(f, files, rel) }))
/** A violating case: [rel, [needle, /message/], ...]; the line is the first line holding the needle. */
const bad = (f, files, list) => list.map(([rel, ...errors]) => {
    const code = textOf(f, files, rel)
    return { filename: f.at(rel), code, errors: errors.map(([needle, message]) => ({ line: lineOf(code, needle), message })) }
})

// BE_CONTEXT_OWNER ----------------------------------------------------------------------------------------------------------
test("context-owner: an app composes only the contexts it owns, the migrate app composes them all", (t) => {
    const files = {
        "apps/order/src/app.module.ts": registration([ORDER_ENTRY, BILLING_ENTRY]),
        "apps/billing/src/app.module.ts": registration([BILLING_ENTRY]),
        "apps/migrate/src/app.module.ts": registration([IDENTITY_ENTRY, ORDER_ENTRY]),
    }
    const f = repo(t, files)
    f.tester.run("context-owner", rules["context-owner"], {
        valid: ok(f, files, ["apps/identity/src/app.module.ts", "apps/billing/src/app.module.ts"]),
        invalid: [...bad(f, files, [
            ["apps/order/src/app.module.ts", ["import { billingEntities", /App order imports src\/modules\/domain\/billing, a capability of context billing owned by app billing/], ["@Module", /App order composes connection billing, the context owned by app billing/]],
            ["apps/migrate/src/app.module.ts", ["import { Module }", /migrate app migrate does not compose connection billing/]],
        ])],
    })
})

test("context-owner: an app imports no capability of a context it does not own", (t) => {
    const files = {
        "apps/order/src/app.module.ts": `${registration([ORDER_ENTRY])}import { IdentityService } from '../../../src/modules/domain/identity';\nexport const lookup = IdentityService;\n`,
        "apps/billing/src/app.module.ts": `${registration([BILLING_ENTRY])}import { cartEntities as carts } from '../../../src/modules/domain/cart';\nexport const own = carts;\n`,
    }
    const f = repo(t, files)
    f.tester.run("context-owner", rules["context-owner"], {
        valid: ok(f, files, ["apps/identity/src/app.module.ts", "apps/migrate/src/app.module.ts"]),
        invalid: [...bad(f, files, [
            ["apps/order/src/app.module.ts", ["import { IdentityService }", /App order imports src\/modules\/domain\/identity, a capability of context identity owned by app identity/]],
            ["apps/billing/src/app.module.ts", ["import { cartEntities as carts }", /App billing imports src\/modules\/domain\/cart, a capability of context order owned by app order/]],
        ])],
    })
})

// BE_CONTEXT_COUPLING -------------------------------------------------------------------------------------------------------
const importing = (specifier, symbol) => `import { ${symbol} } from '${specifier}';\nexport class OrderService { run() { return ${symbol}; } }\n`
test("context-coupling: no import of another context's capability; a same-context or platform import is fine", (t) => {
    const files = {
        [`${DOMAIN}/order/order.service.ts`]: importing("../identity", "IdentityService"),
        [`${DOMAIN}/order/cart.service.ts`]: importing("../cart", "CartService"),
        [`${DOMAIN}/order/db.service.ts`]: importing("../../platform/database", "sql"),
        [`${DOMAIN}/billing/billing.service.ts`]: importing("../order", "orderEntities"),
    }
    const f = repo(t, files)
    f.tester.run("context-coupling", rules["context-coupling"], {
        valid: ok(f, files, [`${DOMAIN}/order/cart.service.ts`, `${DOMAIN}/order/db.service.ts`]),
        invalid: [...bad(f, files, [
            [`${DOMAIN}/order/order.service.ts`, ["import { IdentityService }", /imports src\/modules\/domain\/identity \(context identity\)/]],
            [`${DOMAIN}/billing/billing.service.ts`, ["import { orderEntities }", /context billing\) imports src\/modules\/domain\/order \(context order\)/]],
        ])],
    })
})

test("context-coupling: an entity relation never crosses a context", (t) => {
    const files = {
        [`${DOMAIN}/order/persistence/entities/order.entity.ts`]: "import { Column, Entity, PrimaryColumn, ManyToOne } from 'typeorm';\nimport { UserEntity } from '../../../identity/persistence/entities/identity.entity';\nimport { CartEntity } from '../../../cart/persistence/entities/cart.entity';\n@Entity(\"orders\")\nexport class OrderEntity {\n  @PrimaryColumn({ name: 'id', type: 'uuid' }) id!: string;\n  @ManyToOne(() => UserEntity) buyer!: UserEntity;\n  @ManyToOne(() => CartEntity) cart!: CartEntity;\n}\n",
        [`${DOMAIN}/identity/persistence/entities/identity.entity.ts`]: entity("UserEntity", "users"),
        [`${DOMAIN}/cart/persistence/entities/cart.entity.ts`]: entity("CartEntity", "carts"),
    }
    const f = repo(t, files)
    f.tester.run("context-coupling", rules["context-coupling"], {
        valid: ok(f, files, [`${DOMAIN}/identity/persistence/entities/identity.entity.ts`, `${DOMAIN}/cart/persistence/entities/cart.entity.ts`]),
        invalid: [...bad(f, files, [[`${DOMAIN}/order/persistence/entities/order.entity.ts`, ["@ManyToOne(() => UserEntity)", /ManyToOne relation in src\/modules\/domain\/order \(context order\) targets an entity of src\/modules\/domain\/identity \(context identity\)/]]])],
    })
})

test("context-coupling: a migration foreign key never references a table of another context", (t) => {
    const files = {
        [`${DOMAIN}/order/persistence/migrations/1790000000000-create-order.ts`]: migration("CreateOrder1790000000000", "CREATE TABLE orders (id uuid PRIMARY KEY, buyer_id uuid REFERENCES users (id), cart_id uuid REFERENCES carts (id))"),
        [`${DOMAIN}/billing/persistence/migrations/1790000000000-create-billing.ts`]: migration("CreateBilling1790000000000", "CREATE TABLE invoices (id uuid PRIMARY KEY, order_id uuid)"),
        [`${DOMAIN}/cart/persistence/migrations/1790000000000-create-cart.ts`]: migration("CreateCart1790000000000", "CREATE TABLE carts (id uuid PRIMARY KEY, order_id uuid REFERENCES orders (id))"),
    }
    const f = repo(t, files)
    f.tester.run("context-coupling", rules["context-coupling"], {
        valid: ok(f, files, [`${DOMAIN}/billing/persistence/migrations/1790000000000-create-billing.ts`, `${DOMAIN}/cart/persistence/migrations/1790000000000-create-cart.ts`]),
        invalid: [...bad(f, files, [[`${DOMAIN}/order/persistence/migrations/1790000000000-create-order.ts`, ["CREATE TABLE orders", /references table users of src\/modules\/domain\/identity \(context identity\), but this migration belongs to context order/]]])],
    })
})

// BE_CONTEXT_TRANSACTION ----------------------------------------------------------------------------------------------------
const MANAGER = "import type { EntityManager } from '../../platform/database/manager';\n"
const SERVICE = (body) => `import { InjectOrderEntityManager } from '../../platform/database/order.decorators';\nimport { InjectBillingEntityManager } from '../../platform/database/billing.decorators';\nimport { BillingService } from '../billing';\nimport { CartService } from '../cart';\n${MANAGER}export class OrderService {\n  constructor(\n    @InjectOrderEntityManager() private readonly entityManager: EntityManager,\n    @InjectBillingEntityManager() private readonly billingManager: EntityManager,\n    private readonly billing: BillingService,\n    private readonly cart: CartService,\n  ) {}\n${body}}\n`
test("context-transaction: a transaction uses one connection and calls no other context", (t) => {
    const files = {
        [`${DOMAIN}/order/clean.service.ts`]: SERVICE("  async place() {\n    const total = this.cart.total();\n    await this.entityManager.transaction(async (manager) => { await manager.save(total); });\n    await this.billingManager.save(this.billing.charge());\n  }\n"),
        [`${DOMAIN}/order/split.service.ts`]: SERVICE("  async place() {\n    await this.entityManager.transaction(async (manager) => { await manager.save(1); await this.billingManager.save(2); });\n  }\n"),
        [`${DOMAIN}/order/call.service.ts`]: SERVICE("  async place() {\n    await this.entityManager.transaction(async (manager) => { await manager.save(this.billing.charge()); });\n  }\n"),
        [`${DOMAIN}/order/nested.service.ts`]: SERVICE("  async place() {\n    await this.entityManager.transaction(async (manager) => { await this.billingManager.transaction(async (inner) => { await inner.save(1); }); });\n  }\n"),
    }
    const f = repo(t, files)
    f.tester.run("context-transaction", rules["context-transaction"], {
        valid: ok(f, files, [`${DOMAIN}/order/clean.service.ts`]),
        invalid: [...bad(f, files, [
            [`${DOMAIN}/order/split.service.ts`, ["this.billingManager.save(2)", /uses the entity manager of connection billing/]],
            [`${DOMAIN}/order/call.service.ts`, ["this.billing.charge()", /calls src\/modules\/domain\/billing of context billing/]],
            [`${DOMAIN}/order/nested.service.ts`, ["this.billingManager.transaction", /uses the entity manager of connection billing/]],
        ])],
    })
})

// BE_CONTEXT_PLATFORM_TABLES and the per-connection carve-out of BE_SCHEMA_OWNER ---------------------------------------------
const BUS_INDEX = "export class EventBus { publish(event: unknown, manager: unknown): void { void event; void manager; } }\n"
const busFiles = capability("platform", "event-bus", "event_outbox", BUS_INDEX)
const BUS_ORDER_ENTRY = "{ name: ORDER_CONNECTION, entities: [...orderEntities, ...cartEntities, ...eventBusEntities], migrations: [...orderMigrations, ...cartMigrations, ...eventBusMigrations] }"
const BUS_BILLING_ENTRY = "{ name: BILLING_CONNECTION, entities: [...billingEntities, ...eventBusEntities], migrations: [...billingMigrations, ...eventBusMigrations] }"
const withBus = (entry) => registration(entry).replace("@Module(", "import { eventBusEntities, eventBusMigrations } from '../../../src/modules/platform/event-bus';\n@Module(")
const PUBLISHER = `import { InjectOrderEntityManager } from '../../platform/database/order.decorators';\nimport { InjectBillingEntityManager } from '../../platform/database/billing.decorators';\nimport { EventBus } from '../../platform/event-bus';\n${MANAGER}export class Publisher {\n  constructor(\n    @InjectOrderEntityManager() private readonly entityManager: EntityManager,\n    @InjectBillingEntityManager() private readonly billingManager: EntityManager,\n    private readonly bus: EventBus,\n  ) {}\n  async publishOrder() { await this.entityManager.transaction(async (manager) => { this.bus.publish('order.placed', manager); }); }\n  async publishBilling() { await this.billingManager.transaction(async (manager) => { this.bus.publish('invoice.issued', manager); }); }\n}\n`
test("context-platform-tables: the event-bus tables exist on every connection that publishes through it", (t) => {
    const missing = {
        ...busFiles,
        "apps/order/src/app.module.ts": withBus([BUS_ORDER_ENTRY]),
        "apps/migrate/src/app.module.ts": withBus([IDENTITY_ENTRY, BUS_ORDER_ENTRY, BILLING_ENTRY]),
        [`${DOMAIN}/billing/publisher.service.ts`]: PUBLISHER,
    }
    const f = repo(t, missing)
    f.tester.run("context-platform-tables", rules["context-platform-tables"], {
        valid: ok(f, missing, [`${PLATFORM}/event-bus/index.ts`]),
        invalid: [...bad(f, missing, [[`${DOMAIN}/billing/publisher.service.ts`, ["this.bus.publish('invoice.issued', manager)", /passes the entity manager of connection billing to event-bus, but the tables of event-bus are not registered on billing \(registered: order\)/]]])],
    })
    const complete = {
        ...busFiles,
        "apps/order/src/app.module.ts": withBus([BUS_ORDER_ENTRY]),
        "apps/billing/src/app.module.ts": withBus([BUS_BILLING_ENTRY]),
        "apps/migrate/src/app.module.ts": withBus([IDENTITY_ENTRY, BUS_ORDER_ENTRY, BUS_BILLING_ENTRY]),
        [`${DOMAIN}/billing/publisher.service.ts`]: PUBLISHER,
    }
    const g = repo(t, complete)
    g.tester.run("context-platform-tables", rules["context-platform-tables"], { valid: ok(g, complete, [`${DOMAIN}/billing/publisher.service.ts`]), invalid: [] })
})

test("schema-owner: a per-connection platform capability registers on several connections, any other capability on one", (t) => {
    const files = {
        ...busFiles,
        "apps/order/src/app.module.ts": withBus([BUS_ORDER_ENTRY]),
        "apps/billing/src/app.module.ts": withBus([BUS_BILLING_ENTRY]),
        "apps/migrate/src/app.module.ts": withBus([IDENTITY_ENTRY, BUS_ORDER_ENTRY, BUS_BILLING_ENTRY]),
    }
    const f = repo(t, files)
    f.tester.run("schema-owner", rules["schema-owner"], { valid: ok(f, files, ["apps/migrate/src/app.module.ts", `${PLATFORM}/event-bus/index.ts`]), invalid: [] })
    const twice = {
        "apps/billing/src/app.module.ts": registration([BILLING_ENTRY, "{ name: ORDER_CONNECTION, entities: billingEntities }"]),
    }
    const g = repo(t, twice)
    g.tester.run("schema-owner", rules["schema-owner"], {
        valid: ok(g, twice, [`${DOMAIN}/billing/persistence/entities/billing.entity.ts`]),
        invalid: [...bad(g, twice, [["apps/billing/src/app.module.ts", ["@Module", /exactly one connection/]]])],
    })
})

// BE_SQL_TABLE_OWNER, tightened: a context reads and writes only its own context's tables ------------------------------------
const SQL_FILE = (statements) => `import { sql } from '../../../platform/database';\n${statements.map(([name, text]) => `export const ${name} = sql\`${text}\`;\n`).join("")}`
test("sql-owner: a cross-context JOIN or read is refused, an own-table and a same-context read pass", (t) => {
    const files = {
        [`${DOMAIN}/order/persistence/order.sql.ts`]: SQL_FILE([
            ["OWN", "SELECT o.id FROM orders o WHERE o.id = $1"],
            ["SAME_CONTEXT", "SELECT o.id FROM orders o JOIN carts c ON c.id = o.id WHERE o.id = $1"],
            ["CROSS_JOIN", "SELECT o.id FROM orders o JOIN invoices i ON i.id = o.id WHERE o.id = $1"],
            ["CROSS_READ", "SELECT u.id FROM users u WHERE u.id = $1"],
        ]),
    }
    const f = repo(t, files)
    f.tester.run("sql-owner", rules["sql-owner"], {
        valid: [],
        invalid: [...bad(f, files, [[`${DOMAIN}/order/persistence/order.sql.ts`,
            ["CROSS_JOIN", /reads table invoices, owned by src\/modules\/domain\/billing \(context billing\); a context reads and writes only its own context's tables/],
            ["CROSS_READ", /reads table users, owned by src\/modules\/domain\/identity \(context identity\)/],
        ]])],
    })
    const clean = { [`${DOMAIN}/order/persistence/order.sql.ts`]: SQL_FILE([["OWN", "SELECT o.id FROM orders o WHERE o.id = $1"], ["SAME_CONTEXT", "SELECT o.id FROM orders o JOIN carts c ON c.id = o.id WHERE o.id = $1"]]) }
    const g = repo(t, clean)
    g.tester.run("sql-owner", rules["sql-owner"], { valid: ok(g, clean, [`${DOMAIN}/order/persistence/order.sql.ts`]), invalid: [] })
})

// BE_CONTEXT_OWNER through the options file of an app: the registration literal names the connection, the database module is passed an options object.
const OPTIONS_FILE = (entry) => `${Object.entries(IMPORTS).filter(([name]) => entry.some((text) => text.includes(name))).map(([, text]) => text).join("")}export const databases = [${entry.join(", ")}];\n`
test("context-owner: a registration literal in an app options file counts, an unresolvable runner registration is not judged", (t) => {
    const files = {
        "apps/order/src/order.options.ts": OPTIONS_FILE([ORDER_ENTRY, BILLING_ENTRY]),
        "apps/billing/src/billing.options.ts": OPTIONS_FILE([BILLING_ENTRY]),
        "apps/migrate/src/app.module.ts": "import { Module } from '@nestjs/common';\nimport { DatabaseModule } from '../../../src/modules/platform/database';\nimport { orderEntities } from '../../../src/modules/domain/order';\ndeclare const name: string;\n@Module({ imports: [DatabaseModule.register({ connections: [{ name, entities: orderEntities }] })] })\nexport class AppModule {}\n",
    }
    const f = repo(t, files)
    f.tester.run("context-owner", rules["context-owner"], {
        valid: [...ok(f, files, ["apps/billing/src/billing.options.ts", "apps/migrate/src/app.module.ts"])],
        invalid: [...bad(f, files, [["apps/order/src/order.options.ts", ["import { billingEntities", /App order imports src\/modules\/domain\/billing/], ["databases = [", /App order composes connection billing, the context owned by app billing/]]])],
    })
})

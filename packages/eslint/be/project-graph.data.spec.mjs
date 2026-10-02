import fs from "node:fs"
import test from "node:test"
import { projectFixture } from "./fixtures/project/tester.mjs"
import { rules } from "./project-graph.mjs"

/** One repository per rule: the case list is the files of the repository, the code of a case is the text of its file. */
const source = (f, files, rel) => ({ filename: f.at(rel), code: files[rel] ?? fs.readFileSync(f.at(rel), "utf8") })
const valid = (f, files, rels) => rels.map((rel) => source(f, files, rel))
const invalid = (f, files, expected) => Object.entries(expected).map(([rel, lines]) => ({ ...source(f, files, rel), errors: lines.map((line) => ({ messageId: "finding", line })) }))
const EXPORT = "export const value = 1;\n"

// ---------------------------------------------------------------------------------------------------------------------
// test-world-files (BE_TEST_TOPOLOGY)
// ---------------------------------------------------------------------------------------------------------------------
/** The app-root stack declaration (`.starcistacks/` lives at the app root, beside hfs.json): projectFixture rootFiles. */
const stack = (services) => ({
    ".starcistacks/application-stacks.yaml": [
        "schema: starci/application-stacks@1",
        "components:",
        ...Object.entries(services).flatMap(([name, image]) => [`  ${name}:`, `    image: ${image}`, "    role: stateful"]),
        "environments:",
        "  dev:",
        "    status: supported",
        "    runtime: docker-compose",
        "    composeFiles: [infra/compose/compose.yaml]",
        "",
    ].join("\n"),
    ".starcistacks/dev/infra/compose/compose.yaml": `services:\n${Object.entries(services).map(([name, image]) => `  ${name}:\n    image: ${image}\n`).join("")}`,
})
const fake = (name) => ({ [`src/tests/world/fakes/${name}/server.ts`]: EXPORT })

test("test-world-files: the test world holds its fixed files, fakes/, kit/ and role-suffixed helpers, and fakes nothing the stack runs real", (t) => {
    const files = {
        "src/tests/world/global-setup.ts": EXPORT,
        "src/tests/world/global-teardown.ts": EXPORT,
        "src/tests/world/use-test-world.ts": EXPORT,
        "src/tests/world/fakes/stripe/stripe.server.ts": EXPORT,
        "src/tests/world/kit/wait-for.service.ts": EXPORT,
        "src/tests/world/identity.client.ts": EXPORT,
        "src/tests/world/checkout.contracts.ts": EXPORT,
        "src/tests/world/world.policy.ts": EXPORT,
        "src/tests/world/world.error.ts": EXPORT,
        "src/tests/world/world.options.ts": EXPORT,
        // a stray file, no role suffix, an unknown folder, a role file in a subfolder
        "src/tests/world/helpers.ts": EXPORT,
        "src/tests/world/checkout.helper.ts": EXPORT,
        "src/tests/world/utils/clock.client.ts": EXPORT,
        "src/tests/world/setup.ts": EXPORT,
        // the stack runs these real: a fake of one (by name, image repository or alias) is refused
        ...fake("keycloak"),
        ...fake("smtp"),
        // an external SaaS the stack does not declare stays legal; stateless GPU compute is faked when the config declares it with a reason
        ...fake("sepay"),
        ...fake("inference"),
        ...fake("postgres"),
        // a stacks entry faking a stateful service, or a service the stack does not declare, is refused on the declaration
        "src/tests/world/test-world.config.ts": "export const { useTestWorld, useSandbox } = defineTestWorld({ stack: '.starcistacks/dev', stacks: { inference: { fakedBy: 'inference', reason: 'Serves a GPU model; the fake speaks the same protocol.' }, postgres: { fakedBy: 'postgres', reason: 'Slow.' }, ghost: { fakedBy: 'postgres', reason: 'GPU.' } } });\n",
    }
    const rootFiles = stack({ postgres: "postgres:16", redis: "redis:7", keycloak: "quay.io/keycloak/keycloak:26.0", inference: "ghcr.io/acme/vllm-proxy:1.0", mailpit: "axllent/mailpit:v1.20" })
    const f = projectFixture({ files, rootFiles, declaration: { optionalSlots: [] } })
    t.after(f.cleanup)
    f.tester.run("test-world-files", rules["test-world-files"], {
        valid: valid(f, files, [
            "src/tests/world/global-setup.ts",
            "src/tests/world/global-teardown.ts",
            "src/tests/world/use-test-world.ts",
            "src/tests/world/fakes/stripe/stripe.server.ts",
            "src/tests/world/kit/wait-for.service.ts",
            "src/tests/world/identity.client.ts",
            "src/tests/world/checkout.contracts.ts",
            "src/tests/world/world.policy.ts",
            "src/tests/world/world.error.ts",
            "src/tests/world/world.options.ts",
            "src/tests/world/fakes/sepay/server.ts",
            "src/tests/world/fakes/inference/server.ts",
            "src/tests/world/fakes/postgres/server.ts",
        ]),
        invalid: [...invalid(f, files, {
            "src/tests/world/helpers.ts": [1],
            "src/tests/world/checkout.helper.ts": [1],
            "src/tests/world/utils/clock.client.ts": [1],
            "src/tests/world/setup.ts": [1],
            "src/tests/world/fakes/keycloak/server.ts": [1],
            "src/tests/world/fakes/smtp/server.ts": [1],
            "src/tests/world/test-world.config.ts": [1, 1],
        })],
    })
})

test("test-world-files: without a mail host in the stack the smtp fake stays legal, and a cache fake is refused when the stack runs redis", (t) => {
    const files = {
        "src/tests/world/global-setup.ts": EXPORT,
        ...fake("smtp"),
        ...fake("cache"),
        "src/tests/world/test-world.config.ts": "export const { useTestWorld, useSandbox } = defineTestWorld({ stack: '.starcistacks/dev', stacks: { redis: {} } });\n",
    }
    const f = projectFixture({ files, rootFiles: stack({ postgres: "postgres:16", redis: "redis:7" }), declaration: { optionalSlots: [] } })
    t.after(f.cleanup)
    f.tester.run("test-world-files", rules["test-world-files"], {
        valid: valid(f, files, ["src/tests/world/fakes/smtp/server.ts", "src/tests/world/test-world.config.ts"]),
        invalid: [...invalid(f, files, { "src/tests/world/fakes/cache/server.ts": [1] })],
    })
})

// ---------------------------------------------------------------------------------------------------------------------
// unit-spec-providers (BE_SPEC_QUALITY) and injection-token-exported (BE_RAW_INJECT)
// One capability per case: a cart service taking two injected tokens and one class, and its unit spec.
// ---------------------------------------------------------------------------------------------------------------------
const DECORATORS = [
    "declare function injector(token: unknown): unknown;",
    "export const CLOCK: unique symbol = Symbol('platform.clock');",
    "export const InjectClock = () => injector(CLOCK);",
    "export const CACHE: unique symbol = Symbol('integrations.cache');",
    "export const InjectCache = () => injector(CACHE);",
    "",
].join("\n")
const SERVICE = [
    "import { InjectCache, InjectClock } from './cart.decorators';",
    "import { PriceService } from './price.service';",
    "export class CartService {",
    "  constructor(@InjectClock() private readonly clock: object, @InjectCache() private readonly cache: object, private readonly prices: PriceService) {}",
    "}",
    "",
].join("\n")
const specOf = (providers) => [
    "import { Test } from '@nestjs/testing';",
    "import { CartService } from './cart.service';",
    "import { PriceService } from './price.service';",
    "import { CACHE as CACHE_TOKEN, CLOCK } from './cart.decorators';",
    "it('builds', async () => {",
    `  await Test.createTestingModule({ providers: [${providers}] }).compile();`,
    "});",
    "",
].join("\n")
const GOOD_PROVIDERS = "CartService, { provide: CLOCK, useValue: {} }, { provide: CACHE_TOKEN, useValue: {} }, PriceService"
const capability = (name, { spec, decorators = DECORATORS, service = SERVICE, index = "export { CartService } from './cart.service';\nexport { CLOCK, CACHE } from './cart.decorators';\n" }) => ({
    [`src/modules/domain/${name}/index.ts`]: index,
    [`src/modules/domain/${name}/cart.decorators.ts`]: decorators,
    [`src/modules/domain/${name}/cart.service.ts`]: service,
    [`src/modules/domain/${name}/price.service.ts`]: "export class PriceService {}\n",
    [`src/modules/domain/${name}/cart.service.spec.ts`]: spec,
})
const SPEC_FILES = {
    ...capability("good", { spec: specOf(GOOD_PROVIDERS) }),
    ...capability("extra", { spec: specOf(`${GOOD_PROVIDERS}, { provide: OTHER, useValue: {} }`) }),
    ...capability("missing", { spec: specOf("CartService, { provide: CLOCK, useValue: {} }, PriceService") }),
    ...capability("none", { spec: "import { CartService } from './cart.service';\nit('builds', () => { expect(new CartService()).toBeDefined(); });\n" }),
    ...capability("shape", { spec: specOf("CartService, { provide: CLOCK, useFactory: () => ({}) }, { provide: CACHE_TOKEN, useValue: {} }, PriceService") }),
    ...capability("noarray", { spec: "import { Test } from '@nestjs/testing';\nit('builds', async () => { await Test.createTestingModule({}).compile(); });\n" }),
    ...capability("unresolved", { spec: specOf(GOOD_PROVIDERS), service: SERVICE.replace("private readonly prices: PriceService", "private readonly limit: number") }),
    // a token the capability keeps private: nobody can provide it in a spec
    ...capability("secret", {
        spec: specOf(GOOD_PROVIDERS),
        decorators: DECORATORS.replace("export const CLOCK", "const CLOCK"),
        index: "export { CartService } from './cart.service';\n",
    }),
}

test("unit-spec-providers: the providers of a unit spec equal the constructor dependencies of its service", (t) => {
    const f = projectFixture({ files: SPEC_FILES })
    t.after(f.cleanup)
    f.tester.run("unit-spec-providers", rules["unit-spec-providers"], {
        valid: valid(f, SPEC_FILES, ["src/modules/domain/good/cart.service.spec.ts", "src/modules/domain/good/cart.service.ts", "src/modules/domain/good/cart.decorators.ts"]),
        invalid: [...invalid(f, SPEC_FILES, {
            "src/modules/domain/extra/cart.service.spec.ts": [6],
            "src/modules/domain/missing/cart.service.spec.ts": [6],
            "src/modules/domain/none/cart.service.spec.ts": [1],
            "src/modules/domain/shape/cart.service.spec.ts": [6],
            "src/modules/domain/noarray/cart.service.spec.ts": [2],
            "src/modules/domain/unresolved/cart.service.spec.ts": [6, 6],
        })],
    })
})

test("injection-token-exported: an Inject<Thing>() over an exported token is fine, over a private token it is refused on its decorator", (t) => {
    const f = projectFixture({ files: SPEC_FILES })
    t.after(f.cleanup)
    f.tester.run("injection-token-exported", rules["injection-token-exported"], {
        valid: valid(f, SPEC_FILES, [
            "src/modules/domain/good/cart.decorators.ts",
            "src/modules/domain/good/cart.service.ts",
            "src/modules/domain/extra/cart.decorators.ts",
            "src/modules/domain/secret/cart.service.ts",
        ]),
        invalid: [...invalid(f, SPEC_FILES, { "src/modules/domain/secret/cart.decorators.ts": [3] })],
    })
})

// ---------------------------------------------------------------------------------------------------------------------
// connection-map (BE_CONNECTION_DUPLICATE)
// Connections: agentos is clean everywhere; primary has a wrong connection constant; billing has a double injector and a config
// reading foreign keys; collab is undeclared and reaches the entity manager by other paths; app core registers primary twice.
// ---------------------------------------------------------------------------------------------------------------------
const DATABASE = "src/modules/platform/database"
const databaseFiles = {
    [`${DATABASE}/index.ts`]: "export { sql } from './sql';\nexport { DatabaseModule } from './database.module';\n",
    [`${DATABASE}/sql.ts`]: 'export const sql = (strings: TemplateStringsArray, ...values: unknown[]): string => strings.join("?") + values.length;\n',
    [`${DATABASE}/database.module.ts`]: "import { Module } from '@nestjs/common';\n@Module({})\nexport class DatabaseModule {\n  static register(options: { connections: { name: string }[] }) { return { module: DatabaseModule, ...options }; }\n}\n",
}
const connectionFiles = (name, prefix, constant) => ({
    [`${DATABASE}/${name}.connection.ts`]: `export const ${constant}_CONNECTION = "${name}";\n`,
    [`${DATABASE}/${name}.decorators.ts`]: `import { getEntityManagerToken } from '@nestjs/typeorm';\nimport { ${constant}_CONNECTION } from './${name}.connection';\ndeclare function injector(token: unknown): unknown;\nexport const Inject${name[0].toUpperCase()}${name.slice(1)}EntityManager = () => injector(getEntityManagerToken(${constant}_CONNECTION));\n`,
    [`${DATABASE}/${name}.config.ts`]: `export const ${name}Config = () => ({ host: process.env.${prefix}_HOST, port: process.env.${prefix}_PORT, name: process.env.${prefix}_NAME });\n`,
})
const appModule = (names) => `import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../src/modules/platform/database';
import { PRIMARY_CONNECTION } from '../../../src/modules/platform/database/primary.connection';
import { AGENTOS_CONNECTION } from '../../../src/modules/platform/database/agentos.connection';
@Module({ imports: [DatabaseModule.register({ connections: [${names.join(", ")}] })] })
export class AppModule {}
`
const CONNECTION_FILES = {
    ...databaseFiles,
    ...connectionFiles("primary", "PRIMARY", "PRIMARY"),
    ...connectionFiles("agentos", "AGENTOS", "AGENTOS"),
    ...connectionFiles("billing", "BILLING", "BILLING"),
    [`${DATABASE}/primary.connection.ts`]: 'export const PRIMARY_CONNECTION = "main";\n',
    [`${DATABASE}/billing.decorators.ts`]: `import { getEntityManagerToken } from '@nestjs/typeorm';
import { BILLING_CONNECTION } from './billing.connection';
declare function injector(token: unknown): unknown;
export const InjectBillingEntityManager = () => injector(getEntityManagerToken(BILLING_CONNECTION));
export const again = () => injector(getEntityManagerToken(BILLING_CONNECTION));
`,
    [`${DATABASE}/billing.config.ts`]: "export const billingConfig = () => ({ host: process.env.BILLING_HOST, url: process.env.DATABASE_URL, other: 'AGENTOS_HOST' });\n",
    [`${DATABASE}/collab.connection.ts`]: 'export const COLLAB_CONNECTION = "collab";\n',
    "src/modules/domain/collab/index.ts": "export { InjectCollabEntityManager } from './collab.decorators';\n",
    "src/modules/domain/collab/collab.decorators.ts": `import { getEntityManagerToken, InjectEntityManager } from '@nestjs/typeorm';
import { AGENTOS_CONNECTION } from '../../platform/database/agentos.connection';
declare function injector(token: unknown): unknown;
export const InjectCollabEntityManager = () => injector(getEntityManagerToken(AGENTOS_CONNECTION));
export const second = () => InjectEntityManager('agentos');
export const ghost = () => InjectEntityManager('nowhere');
`,
    "src/modules/domain/collab/collab.data.ts": "import { InjectDataSource } from '@nestjs/typeorm';\nexport const source = InjectDataSource();\n",
    "apps/core/src/app.module.ts": appModule(["{ name: PRIMARY_CONNECTION }", "{ name: AGENTOS_CONNECTION }", "{ name: AGENTOS_CONNECTION }"]),
    // the other app registers each connection once
    "apps/worker/src/main.ts": "void 0;\n",
    "apps/worker/src/app.module.ts": appModule(["{ name: PRIMARY_CONNECTION }", "{ name: AGENTOS_CONNECTION }"]),
}

test("connection-map: one connection file set per declared connection, one registration per app, one injector per connection", (t) => {
    const f = projectFixture({
        files: CONNECTION_FILES,
        declaration: { connections: [{ name: "primary", envPrefix: "PRIMARY", owner: "core", isolation: "database" }, { name: "agentos", envPrefix: "AGENTOS", owner: "core", isolation: "database" }, { name: "billing", envPrefix: "BILLING", owner: "core", isolation: "database" }] },
        apps: [{ name: "core", kind: "api" }, { name: "worker", kind: "worker" }, { name: "cli", kind: "cli" }],
    })
    t.after(f.cleanup)
    f.tester.run("connection-map", rules["connection-map"], {
        valid: valid(f, CONNECTION_FILES, [
            `${DATABASE}/agentos.connection.ts`,
            `${DATABASE}/agentos.decorators.ts`,
            `${DATABASE}/agentos.config.ts`,
            `${DATABASE}/billing.connection.ts`,
            `${DATABASE}/index.ts`,
            "apps/worker/src/app.module.ts",
        ]),
        invalid: [...invalid(f, CONNECTION_FILES, {
            [`${DATABASE}/primary.connection.ts`]: [1],
            [`${DATABASE}/primary.decorators.ts`]: [4],
            [`${DATABASE}/billing.decorators.ts`]: [5],
            [`${DATABASE}/billing.config.ts`]: [1, 1],
            [`${DATABASE}/collab.connection.ts`]: [1],
            "src/modules/domain/collab/collab.decorators.ts": [4, 4, 5, 6],
            "src/modules/domain/collab/collab.data.ts": [2],
            "apps/core/src/app.module.ts": [5],
        })],
    })
})

// ---------------------------------------------------------------------------------------------------------------------
// sql-owner (BE_SQL_TABLE_OWNER)
// ---------------------------------------------------------------------------------------------------------------------
const entityFiles = (name, table, columns = "") => ({
    [`src/modules/domain/${name}/index.ts`]: `export const ${name} = 1;\n`,
    [`src/modules/domain/${name}/persistence/entities/${name}.entity.ts`]:
        `import { Column, Entity, PrimaryColumn } from 'typeorm';\n@Entity("${table}")\nexport class ${name[0].toUpperCase()}${name.slice(1)}Entity {\n  @PrimaryColumn({ name: 'id', type: 'uuid' }) id!: string;\n${columns}}\n`,
})
const SQL_FILES = {
    ...databaseFiles,
    ...entityFiles("purchase", "purchases", "  @Column({ name: 'learner_id', type: 'uuid' }) learnerId!: string;\n"),
    ...entityFiles("identity", "users", "  @Column({ name: 'email', type: 'varchar', unique: true }) email!: string;\n"),
    // bounded reads, own writes, reads of an owner it may import, a string and a comment that only look like SQL, a dynamic tail
    "src/modules/domain/purchase/persistence/purchase.sql.ts": `import { sql } from '../../../platform/database';
/** one purchase */
export const FIND_ONE = sql\`SELECT id FROM purchases WHERE id = $1\`;
export const FIND_OPEN = sql\`SELECT id, learner_id FROM purchases WHERE learner_id = $1 AND status = 'FROM ghosts' LIMIT $2\`;
export const COUNT_ALL = sql\`SELECT count(*) FROM purchases\`;
export const MARK = sql\`UPDATE purchases SET status = $2 FROM users u WHERE purchases.learner_id = u.id AND u.email = $1\`;
export const BY_EMAIL = sql\`SELECT u.id FROM users u WHERE u.email = $1\`;
export const LOCK = sql\`SELECT id FROM purchases WHERE id = $1 FOR UPDATE\`;
export const dynamic = (column: string) => sql\`SELECT id FROM purchases WHERE id = $1 ORDER BY \${column} LIMIT 1\`;
`,
    // a write to another owner, an unknown table, an unbounded SELECT, an unknown joined table
    "src/modules/domain/purchase/persistence/refund.sql.ts": `import { sql } from '../../../platform/database';
export const STEAL = sql\`UPDATE users SET id = $1 WHERE id = $2\`;
export const GHOST = sql\`SELECT id FROM ghosts WHERE id = $1\`;
export const ALL = sql\`SELECT id FROM purchases WHERE status = $1\`;
export const JOINED = sql\`INSERT INTO purchases (id) SELECT u.id FROM users u JOIN ghost_links l ON l.id = u.id LIMIT 5\`;
`,
    // a platform capability reads a domain table it may not import
    "src/modules/platform/inbox/index.ts": "export const inbox = 1;\n",
    "src/modules/platform/inbox/persistence/inbox.sql.ts": "import { sql } from '../../database';\nexport const PEEK = sql`SELECT id FROM purchases WHERE id = $1`;\n",
    // SQL outside a persistence `.sql.ts`, or under a tag not declared in platform/database, is not read
    "src/modules/domain/purchase/other.ts": "import { sql } from '../../platform/database';\nexport const NOT_READ = sql`SELECT id FROM ghosts`;\n",
    "src/modules/domain/purchase/persistence/tagged.sql.ts": 'const sql = (s: TemplateStringsArray) => s.join(""); export const NOT_READ = sql`SELECT id FROM ghosts`;\n',
}

test("sql-owner: bounded reads, own writes and reads of an importable owner pass; a foreign write, an unknown table, an unbounded SELECT and an upward read do not", (t) => {
    const f = projectFixture({ files: SQL_FILES })
    t.after(f.cleanup)
    f.tester.run("sql-owner", rules["sql-owner"], {
        valid: valid(f, SQL_FILES, [
            "src/modules/domain/purchase/persistence/purchase.sql.ts",
            "src/modules/domain/purchase/other.ts",
            "src/modules/domain/purchase/persistence/tagged.sql.ts",
            "src/modules/domain/identity/persistence/entities/identity.entity.ts",
        ]),
        invalid: [...invalid(f, SQL_FILES, {
            "src/modules/domain/purchase/persistence/refund.sql.ts": [2, 3, 4, 5],
            "src/modules/platform/inbox/persistence/inbox.sql.ts": [2],
        })],
    })
})

// ---------------------------------------------------------------------------------------------------------------------
// public-contract-form (BE_PUBLIC_CONTRACT_FORM), readonly-boundary (BE_READONLY_BOUNDARY), source-names (BE_SOURCE_FORM)
// Framework packages are stubbed in the fixture's node_modules: the machine recognises a decorator by the package it comes from.
// ---------------------------------------------------------------------------------------------------------------------
const STUBS = {
    "node_modules/@nestjs/common/package.json": '{"name":"@nestjs/common","types":"index.d.ts"}',
    "node_modules/@nestjs/common/index.d.ts": "export declare function Controller():ClassDecorator; export declare function Inject(token:unknown):ParameterDecorator & PropertyDecorator; export declare function Injectable():ClassDecorator; export declare function Module(metadata:unknown):ClassDecorator;",
    "node_modules/@nestjs/cqrs/package.json": '{"name":"@nestjs/cqrs","types":"index.d.ts"}',
    "node_modules/@nestjs/cqrs/index.d.ts": "export declare function CommandHandler(message:unknown):ClassDecorator; export declare function QueryHandler(message:unknown):ClassDecorator;",
    "node_modules/@nestjs/graphql/package.json": '{"name":"@nestjs/graphql","types":"index.d.ts"}',
    "node_modules/@nestjs/graphql/index.d.ts": "export declare function Args(n?:string):ParameterDecorator; export declare function ArgsType():ClassDecorator; export declare function InputType():ClassDecorator; export declare function Mutation(t:()=>unknown,o?:{name?:string}):MethodDecorator; export declare function Query(t:()=>unknown,o?:{name?:string}):MethodDecorator; export declare function registerEnumType(e:object,o:{name:string}):void;",
    "node_modules/typeorm/package.json": '{"name":"typeorm","types":"index.d.ts"}',
    "node_modules/typeorm/index.d.ts": "export declare function Entity():ClassDecorator; export declare function ViewEntity():ClassDecorator; export declare class EntitySchema { constructor(o:object) } export interface MigrationInterface {}",
}
const O = "src/modules/domain/orders"
const CONTRACT_FILES = {
    ...STUBS,
    [`${O}/index.ts`]: [
        "export { CreateOrderService } from './create-order.service';",
        "export { FindOrdersService } from './find-orders.service';",
        "export type { OrderPort } from './order.port';",
        "export { PingService } from './ping.service';",
        "export { OptionalService } from './optional.service';",
        "export { BadService } from './bad.service';",
        "export { InlineInheritedService } from './inline-inherited.service';",
        "export { MutableAssignedService, ValidAssignedService } from './injection.service';",
        "export { ChangeOrderCommand } from './change-order.command';",
        "export { ChangeOrderHandler } from './change-order.handler';",
        "export { CreateOrderCommand } from './create-order.command';",
        "export { CreateOrderHandler } from './create-order.handler';",
        "export { MutableInput } from './mutable.input';",
        "",
    ].join("\n"),
    [`${O}/order.contracts.ts`]: [
        "export interface CreateOrderParams { readonly sku:string }",
        "export interface CreateOrderResult { readonly id:string }",
        "export interface FindOrdersParams { readonly accountId:string }",
        "export interface FindOrdersResult { readonly ids:ReadonlyArray<string> }",
        "export interface NamedParams { readonly id:string }",
        "export interface OtherParams { readonly key:string }",
        "",
    ].join("\n"),
    [`${O}/order.port.ts`]: "import type { FindOrdersParams,FindOrdersResult } from './order.contracts';\nexport interface OrderPort { find(params:FindOrdersParams):Promise<FindOrdersResult> }\n",
    // a named contract in, a named contract out
    [`${O}/create-order.service.ts`]: `import { Injectable } from '@nestjs/common';
import type { CreateOrderParams,CreateOrderResult } from './order.contracts';
class Repository { save(params:CreateOrderParams):Promise<CreateOrderResult> { return Promise.resolve({ id: params.sku }) } }
@Injectable() export class CreateOrderService {
  private readonly repository:Repository;
  constructor(repository:Repository){this.repository=repository}
  execute(params:CreateOrderParams):Promise<CreateOrderResult>{return this.repository.save(params)}
}
`,
    // the inherited execute carries named contracts
    [`${O}/find-orders.service.ts`]: `import type { FindOrdersParams,FindOrdersResult } from './order.contracts';
class BaseUseCase<P,R>{ execute(_params:P):Promise<R>{throw new Error('abstract behavior')} }
export class FindOrdersService extends BaseUseCase<FindOrdersParams,FindOrdersResult>{}
`,
    // a boolean is a primitive, not an inline union
    [`${O}/ping.service.ts`]: "export class PingService {\n  ping():boolean{return true}\n  isReady(flag:boolean):boolean{return flag}\n}\n",
    // an optional named contract is one contract; an optional union of two is an inline union
    [`${O}/optional.service.ts`]: `import type { NamedParams,OtherParams } from './order.contracts';
export class OptionalService {
  run(input?:NamedParams):number{return input?1:0}
  count(value?:number):number{return value??0}
  bad(input?:NamedParams|OtherParams):number{return input?1:0}
}
`,
    [`${O}/bad.service.ts`]: `export class BadService {
  run(input:{readonly value:string}) { return {value:input.value} }
  static build(input:{readonly value:string}) {return input}
  get transform(){return (input:{readonly value:string})=>({value:input.value})}
}
`,
    [`${O}/inline-inherited.service.ts`]: `class BaseUseCase<P,R>{ execute(_params:P):Promise<R>{throw new Error('base')} }
export class InlineInheritedService extends BaseUseCase<{readonly id:string},{readonly ok:boolean}>{}
`,
    // an injected dependency is readonly
    [`${O}/injection.service.ts`]: `import { Injectable } from '@nestjs/common';
class Repository{}
@Injectable() export class MutableAssignedService { private repository:Repository; constructor(repository:Repository){this.repository=repository} }
@Injectable() export class ValidAssignedService { private readonly repository:Repository; constructor(repository:Repository){this.repository=repository} }
`,
    [`${O}/valid-injection.service.ts`]: `import { Injectable } from '@nestjs/common';
class Repository{}
@Injectable() export class ValidInjectionService { private readonly repository:Repository; constructor(repository:Repository){this.repository=repository} }
`,
    // a message is readonly
    [`${O}/create-order.command.ts`]: "export class CreateOrderCommand { constructor(public readonly sku:string){} }\n",
    [`${O}/create-order.handler.ts`]: `import { CommandHandler } from '@nestjs/cqrs';
import { CreateOrderCommand } from './create-order.command';
@CommandHandler(CreateOrderCommand) export class CreateOrderHandler { execute(command:CreateOrderCommand):Promise<void>{void command;return Promise.resolve()} }
`,
    [`${O}/change-order.command.ts`]: "export class ChangeOrderCommand { constructor(public id:string){} }\n",
    [`${O}/change-order.handler.ts`]: `import { CommandHandler } from '@nestjs/cqrs';
import { ChangeOrderCommand } from './change-order.command';
@CommandHandler(ChangeOrderCommand) export class ChangeOrderHandler { execute(command:ChangeOrderCommand):Promise<void>{void command;return Promise.resolve()} }
`,
    // a transport input is data, not a message: its mutable field is never a readonly-boundary finding
    [`${O}/mutable.input.ts`]: "export class MutableInput { value!:string }\n",
}
const contractFixture = (t) => {
    const f = projectFixture({ files: CONTRACT_FILES })
    t.after(f.cleanup)
    return f
}

test("public-contract-form: a public signature is typed by a named contract, never inline or untyped", (t) => {
    const f = contractFixture(t)
    f.tester.run("public-contract-form", rules["public-contract-form"], {
        valid: valid(f, CONTRACT_FILES, [
            `${O}/create-order.service.ts`,
            `${O}/find-orders.service.ts`,
            `${O}/order.port.ts`,
            `${O}/ping.service.ts`,
            `${O}/injection.service.ts`,
            `${O}/create-order.handler.ts`,
        ]),
        invalid: [...invalid(f, CONTRACT_FILES, {
            [`${O}/bad.service.ts`]: [1, 1, 1, 1, 1, 1],
            [`${O}/inline-inherited.service.ts`]: [2, 2],
            [`${O}/optional.service.ts`]: [2],
        })],
    })
})

test("readonly-boundary: an injected dependency and a message are readonly, a DTO is not a message", (t) => {
    const f = contractFixture(t)
    f.tester.run("readonly-boundary", rules["readonly-boundary"], {
        valid: valid(f, CONTRACT_FILES, [
            `${O}/valid-injection.service.ts`,
            `${O}/create-order.command.ts`,
            `${O}/create-order.handler.ts`,
            `${O}/mutable.input.ts`,
            `${O}/create-order.service.ts`,
        ]),
        invalid: [...invalid(f, CONTRACT_FILES, {
            [`${O}/injection.service.ts`]: [3],
            [`${O}/change-order.command.ts`]: [1],
        })],
    })
})

const C = "src/modules/domain/catalog"
const NAME_FILES = {
    ...STUBS,
    // the forms that pass: a class named by its role, a class named after the port it implements, transport contracts named by
    // their role, domain values without suffix, a registered enum, an error class, a GraphQL field in camelCase with the `input` argument
    [`${C}/index.ts`]: "export { SystemClock } from './system-clock.service';\nexport { OrderStatus } from './enums/order-status';\n",
    [`${C}/clock.port.ts`]: "export interface Clock { now():Date }\n",
    [`${C}/system-clock.service.ts`]: "import type { Clock } from './clock.port'; export class SystemClock implements Clock { now():Date { return new Date(0) } }\n",
    [`${C}/cart.contracts.ts`]: "export interface CartLine { readonly sku:string } export type Outcome = { readonly ok:boolean };\n",
    [`${C}/cache.options.ts`]: "export interface CacheKey { readonly name:string }\n",
    [`${C}/order-line.rows.ts`]: "export interface OrderLineRow { readonly id:string }\n",
    [`${C}/place.input.ts`]: "export interface PlaceInput { readonly id:string }\n",
    [`${C}/enums/order-status.ts`]: "export enum OrderStatus { Pending='pending', Complete='complete' }\n",
    [`${C}/errors/challenge-not-found.ts`]: "export class ChallengeNotFoundException extends Error {}\n",
    [`${C}/transport/graphql/dto/create-order.request.ts`]: "import { InputType } from '@nestjs/graphql'; @InputType() export class CreateOrderRequest { itemId!:string }\n",
    [`${C}/transport/graphql/place-order.resolver.ts`]: "import { Args,Mutation } from '@nestjs/graphql'; export class PlaceOrderResolver { @Mutation(()=>String,{name:'placeOrder'}) place(@Args('input') input:string){return input} }\n",
    // the forms that do not
    [`${C}/bad_Name.service.ts`]: "export class WrongName {}\n",
    [`${C}/export-list.service.ts`]: "class ExportListWrong {} export {ExportListWrong};\n",
    [`${C}/class-expression.service.ts`]: "export const Wrong=class {};\n",
    [`${C}/named-expression.service.ts`]: "const Value=class InnerWrong {}; export {Value};\n",
    [`${C}/wrong.service.ts`]: "import type { Clock } from './clock.port'; export class Wrong implements Clock { now():Date { return new Date(0) } }\n",
    [`${C}/plain.service.ts`]: "export class Plain {}\n",
    [`${C}/order.rows.ts`]: "export interface OrderRow { readonly id:string } export interface Order { readonly id:string }\n",
    [`${C}/add.input.ts`]: "export interface AddInput { readonly id:string } export interface Add { readonly id:string }\n",
    [`${C}/enums/bad-status.ts`]: "export const enum orderStatus { pending=1 }\n",
    [`${C}/transport/graphql/create-order.resolver.ts`]: "import { Args,Mutation } from '@nestjs/graphql'; export class CreateOrderResolver { @Mutation(()=>String,{name:'Create_Order'}) create(@Args('itemId') itemId:string){return itemId} }\n",
}

test("source-names: the names and forms inside a source file follow its role", (t) => {
    const f = projectFixture({ files: NAME_FILES })
    t.after(f.cleanup)
    f.tester.run("source-names", rules["source-names"], {
        valid: valid(f, NAME_FILES, [
            `${C}/system-clock.service.ts`,
            `${C}/clock.port.ts`,
            `${C}/cart.contracts.ts`,
            `${C}/cache.options.ts`,
            `${C}/order-line.rows.ts`,
            `${C}/place.input.ts`,
            `${C}/enums/order-status.ts`,
            `${C}/errors/challenge-not-found.ts`,
            `${C}/transport/graphql/dto/create-order.request.ts`,
            `${C}/transport/graphql/place-order.resolver.ts`,
        ]),
        invalid: [...invalid(f, NAME_FILES, {
            [`${C}/bad_Name.service.ts`]: [1, 1],
            [`${C}/export-list.service.ts`]: [1],
            [`${C}/class-expression.service.ts`]: [1],
            [`${C}/named-expression.service.ts`]: [1],
            [`${C}/wrong.service.ts`]: [1],
            [`${C}/plain.service.ts`]: [1],
            [`${C}/order.rows.ts`]: [1],
            [`${C}/add.input.ts`]: [1],
            [`${C}/enums/bad-status.ts`]: [1, 1],
            [`${C}/transport/graphql/create-order.resolver.ts`]: [1, 1],
        })],
    })
})

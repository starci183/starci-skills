/**
 * Twin tests for the injection rules (R85).
 *
 *   node --test injection.test.mjs
 *
 * Every case is typed: the filename decides the slot, and the imports resolve to the fixture repository under
 * `fixtures/typed` (the injector builder in `platform/composition`, the `Clock` port in `platform/clock`, a domain
 * service, a platform service, a local `InjectFoo` and the package stubs). The loophole shapes are here on purpose:
 * renamed and namespace imports, an alias variable, a lookalike name, a spec file, property injection.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import {
    infraNeedsInjector,
    injectorOnly,
    injectorShape,
    injectorTypeMatch,
    noForwardRef,
    noModuleRef,
    noStringToken,
    recommended,
    rules,
} from "./injection.mjs"

const tester = typedTester()

/** A service of a domain owner. */
const SERVICE = at("src/modules/domain/order/order.consumer.ts")
/** A spec beside it. */
const SPEC = at("src/modules/domain/order/order.consumer.spec.ts")
/** A handler of a feature (a different owner from every module). */
const HANDLER = at("src/features/shop/application/open.handler.ts")
/** The decorators file of the `platform/clock` owner, at its owner root. */
const DECORATORS = at("src/modules/platform/clock/probe.decorators.ts")
/** A decorators-named file one folder below the owner root. */
const NESTED = at("src/modules/platform/clock/sub/probe.decorators.ts")

const COMMON = `import { Inject, forwardRef } from "@nestjs/common"\n`
const CLOCK = `import { InjectClock } from "@modules/platform/clock"\nimport type { Clock } from "@modules/platform/clock"\n`
const LOGGER = `import type { Logger } from "@modules/platform/logging"\n`
const SHAPE_HEAD = `import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { Clock } from "@modules/platform/clock"
import type { Logger } from "@modules/platform/logging"
`

test("every rule of the law is published and ships at error", () => {
    for (const [name, rule] of Object.entries(rules)) {
        assert.ok(rule?.meta && rule.create, `${name} is not a rule`)
        assert.equal(recommended[`starci-be/${name}`], "error", `${name} is not at error`)
    }
    assert.equal(Object.keys(rules).length, Object.keys(recommended).length)
})

test("injector-only: raw injection lives only in <owner>.decorators.ts", () => {
    tester.run("injector-only", injectorOnly, {
        valid: [
            // the raw call inside an owner-root decorators file
            { filename: DECORATORS, code: `${COMMON}const T: unique symbol = Symbol("platform.clock")\nexport const build = () => Inject(T)` },
            // a custom injector on a constructor parameter
            { filename: SERVICE, code: `${CLOCK}export class S { constructor(@InjectClock() private readonly clock: Clock) {} }` },
            // a lookalike: InjectFoo declared in the repository is a custom injector, not a third-party call
            { filename: SERVICE, code: `import { InjectFoo, FooClient } from "@modules/integrations/foo"\nexport class S { constructor(@InjectFoo() private readonly foo: FooClient) {} }` },
            // Injectable is not an injector
            { filename: SERVICE, code: `import { Injectable } from "@nestjs/common"\n@Injectable()\nexport class S {}` },
            // a locally declared function that happens to be called Inject is not the framework's
            { filename: SERVICE, code: `const Inject = (token: string): string => token\nexport const x = Inject("a")` },
        ],
        invalid: [
            { filename: SERVICE, code: `${COMMON}const T: unique symbol = Symbol("order.thing")\nexport class S { constructor(@Inject(T) private readonly x: string) {} }`, errors: [{ messageId: "rawDecorator" }] },
            // a renamed import resolves to the same function
            { filename: SERVICE, code: `import { Inject as I } from "@nestjs/common"\nconst T: unique symbol = Symbol("order.thing")\nexport class S { constructor(@I(T) private readonly x: string) {} }`, errors: [{ messageId: "rawDecorator" }] },
            // a namespace import too
            { filename: SERVICE, code: `import * as common from "@nestjs/common"\nconst T: unique symbol = Symbol("order.thing")\nexport class S { constructor(@common.Inject(T) private readonly x: string) {} }`, errors: [{ messageId: "rawDecorator" }] },
            // an unresolved name of the reserved set is raw
            { filename: SERVICE, code: `export class S { constructor(@Inject(TOKEN) private readonly x: string) {} }`, errors: [{ messageId: "rawDecorator" }] },
            // a spec file has no exemption
            { filename: SPEC, code: `import { InjectEntityManager } from "@nestjs/typeorm"\nimport type { EntityManager } from "typeorm"\nexport class S { constructor(@InjectEntityManager("primary") private readonly em: EntityManager) {} }`, errors: [{ messageId: "rawDecorator" }] },
            { filename: SERVICE, code: `import { InjectQueue } from "@nestjs/bull"\nimport type { Queue } from "@nestjs/bull"\nexport class S { constructor(@InjectQueue("mail") private readonly queue: Queue) {} }`, errors: [{ messageId: "rawDecorator" }] },
            // any third-party function whose name starts with Inject
            { filename: SERVICE, code: `import { InjectS3, S3 } from "nestjs-s3"\nexport class S { constructor(@InjectS3("k") private readonly s3: S3) {} }`, errors: [{ messageId: "rawDecorator" }] },
            // a raw call outside a decorators file
            { filename: SERVICE, code: `${COMMON}const T: unique symbol = Symbol("order.thing")\nexport const decorate = Inject(T)`, errors: [{ messageId: "rawCall" }] },
            // a decorators-named file that is not at an owner root
            { filename: NESTED, code: `${COMMON}const T: unique symbol = Symbol("platform.clock")\nexport const build = () => Inject(T)`, errors: [{ messageId: "rawCall" }] },
            // raw @Inject as a decorator is a finding even inside a decorators file
            { filename: DECORATORS, code: `${COMMON}const T: unique symbol = Symbol("platform.clock")\nexport class S { constructor(@Inject(T) private readonly x: string) {} }`, errors: [{ messageId: "rawDecorator" }] },
            // property injection, raw
            { filename: SERVICE, code: `${COMMON}const T: unique symbol = Symbol("order.thing")\nexport class S { @Inject(T) private readonly x!: string }`, errors: [{ messageId: "rawDecorator" }] },
            // property injection through a custom injector
            { filename: SERVICE, code: `${CLOCK}export class S { @InjectClock() private readonly clock!: Clock }`, errors: [{ messageId: "property" }] },
            // an injector on a method parameter
            { filename: SERVICE, code: `${CLOCK}export class S { run(@InjectClock() clock: Clock): Date { return clock.now() } }`, errors: [{ messageId: "notConstructor" }] },
        ],
    })
})

test("injector-shape: zero-arg, typed, built with injector<T>, documented, over a unique symbol", () => {
    tester.run("injector-shape", injectorShape, {
        valid: [
            {
                filename: DECORATORS,
                code: `${SHAPE_HEAD}
/** Token of the Clock port. */
export const CLOCK: unique symbol = Symbol("platform.clock")

/** Injects the Clock port. Parameter type: Clock. */
export const InjectClock = (): TypedParameterDecorator<Clock> => injector<Clock>(CLOCK)`,
            },
            {
                filename: DECORATORS,
                code: `${SHAPE_HEAD}
/** Token of the Clock port. */
export const CLOCK: unique symbol = Symbol("platform.clock")

/** Injects the Clock port. Parameter type: Clock. */
export function InjectClock(): TypedParameterDecorator<Clock> {
    return injector<Clock>(CLOCK)
}`,
            },
            // a module provider that is a class, and one that is a unique symbol token
            { filename: SERVICE, code: `import { OrderService } from "@modules/domain/order"\nconst T: unique symbol = Symbol("order.thing")\nexport const providers = [{ provide: OrderService, useClass: OrderService }, { provide: T, useValue: 1 }]` },
            // a file that is not a decorators file may declare a helper that merely starts with inject
            { filename: SERVICE, code: `export const injectAll = (): number => 1` },
        ],
        invalid: [
            // keyed injector: InjectS3(key)
            {
                filename: DECORATORS,
                code: `${SHAPE_HEAD}
const KEYED: unique symbol = Symbol("platform.clock")
/** Injects the Clock port. Parameter type: Clock. */
export const InjectS3 = (key: string): TypedParameterDecorator<Clock> => injector<Clock>(KEYED)`,
                errors: [{ messageId: "params" }],
            },
            // name not PascalCase after Inject
            {
                filename: DECORATORS,
                code: `${SHAPE_HEAD}
const CLOCK: unique symbol = Symbol("platform.clock")
/** Injects the Clock port. Parameter type: Clock. */
export const injectClock = (): TypedParameterDecorator<Clock> => injector<Clock>(CLOCK)`,
                errors: [{ messageId: "name" }],
            },
            // missing return type
            {
                filename: DECORATORS,
                code: `${SHAPE_HEAD}
const CLOCK: unique symbol = Symbol("platform.clock")
/** Injects the Clock port. Parameter type: Clock. */
export const InjectClock = () => injector<Clock>(CLOCK)`,
                errors: [{ messageId: "returnType" }],
            },
            // a plain ParameterDecorator carries no T
            {
                filename: DECORATORS,
                code: `${SHAPE_HEAD}
const CLOCK: unique symbol = Symbol("platform.clock")
/** Injects the Clock port. Parameter type: Clock. */
export const InjectClock = (): ParameterDecorator => injector<Clock>(CLOCK)`,
                errors: [{ messageId: "returnType" }],
            },
            // the body's T differs from the declared T
            {
                filename: DECORATORS,
                code: `${SHAPE_HEAD}
const CLOCK: unique symbol = Symbol("platform.clock")
/** Injects the Clock port. Parameter type: Clock. */
export const InjectClock = (): TypedParameterDecorator<Clock> => injector<Logger>(CLOCK)`,
                errors: [{ messageId: "body" }],
            },
            // a body that is not injector<T>(token)
            {
                filename: DECORATORS,
                code: `${SHAPE_HEAD}
import { Inject } from "@nestjs/common"
const CLOCK: unique symbol = Symbol("platform.clock")
/** Injects the Clock port. Parameter type: Clock. */
export const InjectClock = (): TypedParameterDecorator<Clock> => Inject(CLOCK)`,
                errors: [{ messageId: "body" }],
            },
            // no JSDoc (a line comment is not one)
            {
                filename: DECORATORS,
                code: `${SHAPE_HEAD}
const CLOCK: unique symbol = Symbol("platform.clock")
// Injects the Clock port.
export const InjectClock = (): TypedParameterDecorator<Clock> => injector<Clock>(CLOCK)`,
                errors: [{ messageId: "jsdoc" }],
            },
            // JSDoc that does not name T
            {
                filename: DECORATORS,
                code: `${SHAPE_HEAD}
const CLOCK: unique symbol = Symbol("platform.clock")
/** Injects the thing. */
export const InjectClock = (): TypedParameterDecorator<Clock> => injector<Clock>(CLOCK)`,
                errors: [{ messageId: "jsdoc" }],
            },
            // token without the unique symbol annotation
            { filename: DECORATORS, code: `export const CLOCK = Symbol("platform.clock")`, errors: [{ messageId: "tokenType" }] },
            // token described without its owner
            { filename: DECORATORS, code: `export const CLOCK: unique symbol = Symbol("clock")`, errors: [{ messageId: "tokenName" }] },
            { filename: DECORATORS, code: `export const CLOCK: unique symbol = Symbol("platform.database")`, errors: [{ messageId: "tokenName" }] },
            // a registry symbol is not unique
            { filename: DECORATORS, code: `export const CLOCK: unique symbol = Symbol.for("platform.clock")`, errors: [{ messageId: "tokenName" }] },
            // provide: that is neither a class nor a unique symbol
            { filename: SERVICE, code: `export const providers = [{ provide: { a: 1 }, useValue: 1 }]`, errors: [{ messageId: "provide" }] },
            { filename: SERVICE, code: `export const providers = [{ provide: 42, useValue: 1 }]`, errors: [{ messageId: "provide" }] },
        ],
    })
})

test("injector-type-match: T of the injector is the parameter's type", () => {
    tester.run("injector-type-match", injectorTypeMatch, {
        valid: [
            { filename: SERVICE, code: `${CLOCK}export class S { constructor(@InjectClock() private readonly clock: Clock) {} }` },
            // an optional dependency keeps its T
            { filename: SERVICE, code: `${CLOCK}export class S { constructor(@InjectClock() private readonly clock: Clock | null) {} }` },
            { filename: SERVICE, code: `import { InjectFoo, FooClient } from "@modules/integrations/foo"\nexport class S { constructor(@InjectFoo() foo: FooClient) {} }` },
            // a decorator that is not an injector is not compared
            { filename: SERVICE, code: `${CLOCK}const Marker = (): ParameterDecorator => () => undefined\nexport class S { constructor(@Marker() private readonly clock: Clock) {} }` },
            // not a constructor
            { filename: SERVICE, code: `${CLOCK}${LOGGER}export class S { run(@InjectClock() logger: Logger): void { logger.info("x") } }` },
        ],
        invalid: [
            { filename: SERVICE, code: `${CLOCK}${LOGGER}export class S { constructor(@InjectClock() private readonly logger: Logger) {} }`, errors: [{ messageId: "mismatch" }] },
            { filename: SERVICE, code: `import { InjectClock as IC } from "@modules/platform/clock"\n${LOGGER}export class S { constructor(@IC() logger: Logger) {} }`, errors: [{ messageId: "mismatch" }] },
            { filename: SERVICE, code: `import { InjectFoo } from "@modules/integrations/foo"\nimport type { Clock } from "@modules/platform/clock"\nexport class S { constructor(@InjectFoo() private readonly clock: Clock) {} }`, errors: [{ messageId: "mismatch" }] },
            { filename: SERVICE, code: `import { InjectClock } from "@modules/platform/clock"\nexport class S { constructor(@InjectClock() private readonly clock) {} }`, errors: [{ messageId: "unannotated" }] },
        ],
    })
})

test("infra-needs-injector: class injection only for domain services and the same owner", () => {
    const EM = `import type { EntityManager } from "typeorm"\n`
    const CACHE = `import { CacheService } from "@modules/platform/cache"\n`
    tester.run("infra-needs-injector", infraNeedsInjector, {
        valid: [
            // a domain service injected by class, from a feature (valid)
            { filename: HANDLER, code: `import { OrderService } from "@modules/domain/order"\nexport class H { constructor(private readonly orderService: OrderService) {} }` },
            // an injected clock
            { filename: HANDLER, code: `${CLOCK}export class H { constructor(@InjectClock() private readonly clock: Clock) {} }` },
            // a raw @Inject still counts as an injector for THIS rule (injector-only reports it)
            { filename: HANDLER, code: `${COMMON}${EM}const T: unique symbol = Symbol("shop.em")\nexport class H { constructor(@Inject(T) private readonly em: EntityManager) {} }` },
            // primitives, lib types and the class's own types
            { filename: HANDLER, code: `class Local { ping(): boolean { return true } }\nexport class H { constructor(private readonly name: string, private readonly ids: Array<number>, private readonly at: Date, private readonly local: Local) {} }` },
            // a class of the same owner, even a platform one
            { filename: at("src/modules/platform/cache/cache.warmer.ts"), code: `import { CacheService } from "./cache.service"\nexport class Warmer { constructor(private readonly cache: CacheService) {} }` },
            // a CQRS message carries its params as data; it is built with new, never injected\n            { filename: at("src/features/plan/application/place-order.command.ts"), code: `import { Command } from "@nestjs/cqrs"\nimport type { ExecuteParams } from "@modules/platform/cqrs"\nexport class PlaceOrderCommand extends Command<string> { constructor(readonly params: ExecuteParams<{ id: string }>) { super() } }` },\n            // not a constructor
            { filename: HANDLER, code: `${EM}export class H { run(em: EntityManager): EntityManager { return em } }` },
        ],
        invalid: [
            // the same parameter on a class that is not a message is a dependency\n            { filename: HANDLER, code: `import type { ExecuteParams } from "@modules/platform/cqrs"\nexport class H { constructor(readonly params: ExecuteParams<{ id: string }>) {} }`, errors: [{ messageId: "missing" }] },\n            // renamed receivers do not matter: the TYPE is infrastructure
            { filename: HANDLER, code: `${EM}export class H { constructor(private readonly em: EntityManager) {} }`, errors: [{ messageId: "missing" }] },
            { filename: HANDLER, code: `${EM}export class H { constructor(manager: EntityManager) {} }`, errors: [{ messageId: "missing" }] },
            { filename: HANDLER, code: `${EM}export class H { constructor(private readonly repo: EntityManager) {} }`, errors: [{ messageId: "missing" }] },
            // a platform service injected by class
            { filename: HANDLER, code: `${CACHE}export class H { constructor(private readonly cache: CacheService) {} }`, errors: [{ messageId: "missing" }] },
            // a platform port
            { filename: HANDLER, code: `${LOGGER}export class H { constructor(private readonly logger: Logger) {} }`, errors: [{ messageId: "missing" }] },
            // an integrations type
            { filename: HANDLER, code: `import type { FooClient } from "@modules/integrations/foo"\nexport class H { constructor(private readonly foo: FooClient) {} }`, errors: [{ messageId: "missing" }] },
            // a package type
            { filename: HANDLER, code: `import type { CommandBus } from "@nestjs/cqrs"\nexport class H { constructor(private readonly commandBus: CommandBus) {} }`, errors: [{ messageId: "missing" }] },
            { filename: HANDLER, code: `import type { S3 } from "nestjs-s3"\nexport class H { constructor(private readonly s3: S3) {} }`, errors: [{ messageId: "missing" }] },
            // domain code is not exempt from injecting infrastructure
            { filename: SERVICE, code: `${CACHE}export class S { constructor(private readonly cache: CacheService) {} }`, errors: [{ messageId: "missing" }] },
            // specs are not exempt
            { filename: SPEC, code: `import type { CommandBus } from "@nestjs/cqrs"\nexport class Probe { constructor(private readonly commandBus: CommandBus) {} }`, errors: [{ messageId: "missing" }] },
            // a decorator that is not an injector does not help
            { filename: HANDLER, code: `${EM}const Marker = (): ParameterDecorator => () => undefined\nexport class H { constructor(@Marker() private readonly em: EntityManager) {} }`, errors: [{ messageId: "missing" }] },
        ],
    })
})

test("no-module-ref: no service locator anywhere", () => {
    tester.run("no-module-ref", noModuleRef, {
        valid: [
            { filename: SERVICE, code: `import { Reflector } from "@nestjs/core"\nexport const x = Reflector` },
            { filename: SERVICE, code: `export const read = (map: Map<string, string>): string | undefined => map.get("a")` },
            // a repository class that happens to be called ModuleRef is not the framework's
            { filename: SERVICE, code: `class ModuleRef { get(): number { return 1 } }\nexport const r = (m: ModuleRef): number => m.get()` },
        ],
        invalid: [
            { filename: SERVICE, code: `import { ModuleRef } from "@nestjs/core"\nexport const x = 1`, errors: [{ messageId: "use" }] },
            { filename: SPEC, code: `import { ModuleRef } from "@nestjs/core"\nexport const x = 1`, errors: [{ messageId: "use" }] },
            // import and annotation
            { filename: SERVICE, code: `import { ModuleRef } from "@nestjs/core"\nexport class S { constructor(private readonly moduleRef: ModuleRef) {} }`, errors: [{ messageId: "use" }, { messageId: "use" }] },
            // a renamed import: the import and the call through it
            { filename: SERVICE, code: `import { ModuleRef as MR } from "@nestjs/core"\nexport class S { constructor(private readonly locator: MR) {} run(): number { return this.locator.get<number>("x") } }`, errors: [{ messageId: "use" }, { messageId: "use" }] },
            // a namespace import
            { filename: SERVICE, code: `import * as core from "@nestjs/core"\nexport class S { constructor(private readonly locator: core.ModuleRef) {} }`, errors: [{ messageId: "use" }] },
            { filename: SERVICE, code: `import type { ModuleRef } from "@nestjs/core"\nexport const resolve = async (m: ModuleRef): Promise<number> => m.resolve<number>("x")`, errors: [{ messageId: "use" }, { messageId: "use" }, { messageId: "use" }] },
            { filename: SERVICE, code: `export { ModuleRef } from "@nestjs/core"`, errors: [{ messageId: "use" }] },
        ],
    })
})

test("no-forward-ref: a cycle is a layering finding", () => {
    tester.run("no-forward-ref", noForwardRef, {
        valid: [
            { filename: SERVICE, code: `const forwardRef = (build: () => number): number => build()\nexport const x = forwardRef(() => 1)` },
            { filename: SERVICE, code: `export const later = (): number => 1` },
        ],
        invalid: [
            { filename: SERVICE, code: `${COMMON}export const x = forwardRef(() => 1)`, errors: [{ messageId: "cycle" }] },
            { filename: SPEC, code: `${COMMON}export const x = forwardRef(() => 1)`, errors: [{ messageId: "cycle" }] },
            { filename: SERVICE, code: `import { forwardRef as fr } from "@nestjs/common"\nexport const x = fr(() => 1)`, errors: [{ messageId: "cycle" }] },
            { filename: SERVICE, code: `${COMMON}const alias = forwardRef\nexport const x = alias(() => 1)`, errors: [{ messageId: "cycle" }] },
            { filename: SERVICE, code: `import * as common from "@nestjs/common"\nexport const x = common.forwardRef(() => 1)`, errors: [{ messageId: "cycle" }] },
        ],
    })
})

test("no-string-token: a token is a class or a unique symbol", () => {
    tester.run("no-string-token", noStringToken, {
        valid: [
            { filename: SERVICE, code: `const T: unique symbol = Symbol("order.thing")\nexport const providers = [{ provide: T, useValue: 1 }]` },
            { filename: SERVICE, code: `import { OrderService } from "@modules/domain/order"\nexport const providers = [{ provide: OrderService, useClass: OrderService }]` },
            // a connection name constant is fine
            { filename: SERVICE, code: `import { getEntityManagerToken } from "@nestjs/typeorm"\nconst PRIMARY_CONNECTION = "primary"\nexport const token = getEntityManagerToken(PRIMARY_CONNECTION)` },
            // the literal lives in the connection file
            { filename: at("src/modules/platform/database/primary.connection.ts"), code: `import { getEntityManagerToken } from "@nestjs/typeorm"\nexport const PRIMARY_TOKEN = getEntityManagerToken("primary")` },
            // an entity manager token built from the connection constant, passed to injector
            { filename: DECORATORS, code: `import { injector } from "@modules/platform/composition"\nimport { getEntityManagerToken } from "@nestjs/typeorm"\nimport type { EntityManager } from "typeorm"\nconst PRIMARY_CONNECTION = "primary"\nexport const build = () => injector<EntityManager>(getEntityManagerToken(PRIMARY_CONNECTION))` },
            { filename: DECORATORS, code: `import { injector } from "@modules/platform/composition"\nimport type { Clock } from "@modules/platform/clock"\nimport { CLOCK } from "@modules/platform/clock"\nexport const build = () => injector<Clock>(CLOCK)` },
        ],
        invalid: [
            { filename: SERVICE, code: `${COMMON}export class S { constructor(@Inject("X") private readonly x: string) {} }`, errors: [{ messageId: "string" }] },
            { filename: SERVICE, code: `${COMMON}export class S { constructor(@Inject(\`X\`) private readonly x: string) {} }`, errors: [{ messageId: "string" }] },
            // a string constant is still a string
            { filename: SERVICE, code: `${COMMON}const TOKEN = "X"\nexport class S { constructor(@Inject(TOKEN) private readonly x: string) {} }`, errors: [{ messageId: "string" }] },
            { filename: SERVICE, code: `import { Inject as I } from "@nestjs/common"\nexport class S { constructor(@I("X") private readonly x: string) {} }`, errors: [{ messageId: "string" }] },
            { filename: SERVICE, code: `export const providers = [{ provide: "X", useValue: 1 }]`, errors: [{ messageId: "string" }] },
            { filename: SERVICE, code: `export const providers = [{ provide: \`X\`, useValue: 1 }]`, errors: [{ messageId: "string" }] },
            { filename: DECORATORS, code: `import { injector } from "@modules/platform/composition"\nimport type { Clock } from "@modules/platform/clock"\nexport const build = () => injector<Clock>("clock")`, errors: [{ messageId: "string" }] },
            { filename: SERVICE, code: `import { getEntityManagerToken } from "@nestjs/typeorm"\nexport const token = getEntityManagerToken("primary")`, errors: [{ messageId: "connection" }] },
            { filename: SERVICE, code: `import { getEntityManagerToken as token } from "@nestjs/typeorm"\nexport const t = token(\`primary\`)`, errors: [{ messageId: "connection" }] },
        ],
    })
})

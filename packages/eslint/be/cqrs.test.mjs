/**
 * Twin tests for the CQRS law (R87 `BE_CQRS_SHAPE`).
 *
 *   node --test cqrs.test.mjs
 *
 * Typed cases over the fixture repository (`fixtures/typed`): a case's file path decides its slot, and the types come
 * from the stubs of `@nestjs/cqrs`, `typeorm` and the fixture `platform/cqrs` capability.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { executeParamsShape, handlerIsThin, handlerOverridesProcess, messageCarriesParamsOnly, messageTypedResult, noEventBus, noUseCase, rules } from "./cqrs.mjs"

const tester = typedTester()
const APP = "src/features/plan/application"
const COMMAND = at(`${APP}/place-order.command.ts`)
const QUERY = at(`${APP}/list-orders.query.ts`)
const HANDLER = at(`${APP}/place-order.handler.ts`)
const SUPPORT = at(`${APP}/support/order-math.service.ts`)
const RESOLVER = at("src/features/plan/transport/graphql/place-order.resolver.ts")
const DOMAIN = at("src/modules/domain/order/order.service.ts")

const HANDLER_HEAD = `
import { CommandHandler, QueryHandler } from "@nestjs/cqrs"
import { ICQRSHandler } from "@modules/platform/cqrs"
class PlaceOrderCommand {}
`

test("every rule this law declares is exported under its published name", () => {
    for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("a rule that needs the slot view refuses to run without it", () => {
    const bare = new RuleTester({ languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module" } })
    assert.throws(() => bare.run("no-use-case", noUseCase, { valid: [{ filename: HANDLER, code: "export const a = 1" }], invalid: [] }), /settings\.starci\.hfs/)
})

test("handler-overrides-process: a handler extends ICQRSHandler and implements process, never execute", () => {
    tester.run("handler-overrides-process", handlerOverridesProcess, {
        valid: [
            { filename: HANDLER, code: `${HANDLER_HEAD}
@CommandHandler(PlaceOrderCommand) class H extends ICQRSHandler<PlaceOrderCommand, string> { protected override async process(c: PlaceOrderCommand): Promise<string> { return "" } }` },
            // a renamed import of the decorator is the same decorator
            { filename: HANDLER, code: `${HANDLER_HEAD.replace("CommandHandler,", "CommandHandler as Handles,")}
@Handles(PlaceOrderCommand) class H extends ICQRSHandler<PlaceOrderCommand, string> { protected override async process(c: PlaceOrderCommand): Promise<string> { return "" } }` },
            // an intermediate abstract handler that implements process once is a legitimate base
            { filename: HANDLER, code: `${HANDLER_HEAD}
abstract class SearchBase<C> extends ICQRSHandler<C, string> { protected async process(c: C): Promise<string> { return "" } }
@QueryHandler(PlaceOrderCommand) class H extends SearchBase<PlaceOrderCommand> {}` },
            // a class that only LOOKS like a handler (no cqrs decorator) is nobody's business, and `execute` on it is fine
            { filename: HANDLER, code: "class Runner { async execute() { return 1 } }" },
            // a locally declared decorator of the same name is not the cqrs one
            { filename: HANDLER, code: "const CommandHandler = (x: unknown) => (t: unknown) => t\n@CommandHandler(1) class H { async execute() { return 1 } }" },
            // outside the application slot the rule is silent
            { filename: RESOLVER, code: `${HANDLER_HEAD}
@CommandHandler(PlaceOrderCommand) class H { async execute() { return 1 } }` },
        ],
        invalid: [
            { filename: HANDLER, code: `${HANDLER_HEAD}
@CommandHandler(PlaceOrderCommand) class H extends ICQRSHandler<PlaceOrderCommand, string> { async execute(c: PlaceOrderCommand): Promise<string> { return "" } protected override async process(c: PlaceOrderCommand): Promise<string> { return "" } }`, errors: [{ messageId: "overridesExecute" }] },
            // a handler that does not extend the template at all
            { filename: HANDLER, code: `${HANDLER_HEAD}
@CommandHandler(PlaceOrderCommand) class H { protected async process(c: PlaceOrderCommand): Promise<string> { return "" } }`, errors: [{ messageId: "notTemplate" }] },
            // extends the template but forgot process (still abstract)
            { filename: HANDLER, code: `${HANDLER_HEAD}
@QueryHandler(PlaceOrderCommand) class H extends ICQRSHandler<PlaceOrderCommand, string> {}`, errors: [{ messageId: "noProcess" }] },
            // a renamed decorator import does not hide an execute override
            { filename: HANDLER, code: `${HANDLER_HEAD.replace("CommandHandler,", "CommandHandler as Handles,")}
@Handles(PlaceOrderCommand) class H extends ICQRSHandler<PlaceOrderCommand, string> { async execute(c: PlaceOrderCommand): Promise<string> { return "" } }`, errors: [{ messageId: "overridesExecute" }] },
        ],
    })
})

const THIN_HEAD = `
import { CommandHandler } from "@nestjs/cqrs"
import { CommandBus } from "@nestjs/cqrs"
import { EntityManager } from "typeorm"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { OrderService } from "@modules/domain/order"
import type { Logger } from "@modules/platform/logging"
class PlaceOrderCommand { constructor(readonly params: { id: string; flag: boolean }) {} }
`

/** A handler class whose constructor is `ctor` and whose `process` body is `body`. */
const thin = (ctor, body) => `${THIN_HEAD}
@CommandHandler(PlaceOrderCommand) class H extends ICQRSHandler<PlaceOrderCommand, string> {
  constructor(${ctor}) { super() }
  protected override async process(command: PlaceOrderCommand): Promise<string> { ${body} }
}`

test("handler-is-thin: a handler maps input, calls one service method and returns its result", () => {
    tester.run("handler-is-thin", handlerIsThin, {
        valid: [
            { filename: HANDLER, code: thin("logger: Logger, private readonly orders: OrderService", "return this.orders.open(command.params.id)") },
            { filename: HANDLER, code: thin("private readonly orders: OrderService", "return await this.orders.open(command.params.id)") },
            // mapping the input into an object literal is mapping
            { filename: HANDLER, code: thin("private readonly orders: OrderService", "return this.orders.open(`${command.params.id}`)") },
            // the Logger the template needs, and several services, are allowed dependencies
            { filename: HANDLER, code: thin("logger: Logger, private readonly a: OrderService, private readonly b: OrderService", "return this.a.open(command.params.id)") },
            // a class without the cqrs handler decorator is not a handler
            { filename: HANDLER, code: `${THIN_HEAD}
class Plain { constructor(private readonly em: EntityManager) {} async process() { if (this.em) { return 1 } return 2 } }` },
            // outside the application slot the rule is silent
            { filename: RESOLVER, code: thin("private readonly em: EntityManager", "if (command.params.flag) { return '' } return ''") },
        ],
        invalid: [
            // an EntityManager (or any infrastructure) is not a handler dependency
            { filename: HANDLER, code: thin("private readonly em: EntityManager, private readonly orders: OrderService", "return this.orders.open(command.params.id)"), errors: [{ messageId: "dependency" }] },
            { filename: HANDLER, code: thin("private readonly bus: CommandBus, private readonly orders: OrderService", "return this.orders.open(command.params.id)"), errors: [{ messageId: "dependency" }] },
            // a lookalike name that is not a service class
            { filename: HANDLER, code: `${THIN_HEAD}
class Helper {}
@CommandHandler(PlaceOrderCommand) class H extends ICQRSHandler<PlaceOrderCommand, string> { constructor(private readonly helper: Helper) { super() } protected override async process(): Promise<string> { return this.helper.run() } }`, errors: [{ messageId: "dependency" }, { messageId: "call" }] },
            // more than one statement, or no return
            { filename: HANDLER, code: thin("private readonly orders: OrderService", "const id = command.params.id; return this.orders.open(id)"), errors: [{ messageId: "body" }] },
            { filename: HANDLER, code: thin("private readonly orders: OrderService", "await this.orders.open(command.params.id); return ''"), errors: [{ messageId: "body" }] },
            { filename: HANDLER, code: thin("private readonly orders: OrderService", "this.orders.open(command.params.id)"), errors: [{ messageId: "body" }] },
            // two service calls, or none, or a call that is not on a service
            { filename: HANDLER, code: thin("private readonly orders: OrderService", "return this.orders.open(this.orders.open(command.params.id))"), errors: [{ messageId: "call" }] },
            { filename: HANDLER, code: thin("private readonly orders: OrderService", "return command.params.id"), errors: [{ messageId: "call" }] },
            { filename: HANDLER, code: thin("private readonly orders: OrderService", "return String(command.params.id)"), errors: [{ messageId: "call" }] },
            { filename: HANDLER, code: thin("private readonly orders: OrderService", "return this.other.open(command.params.id)"), errors: [{ messageId: "call" }] },
            // decisions and repetitions
            { filename: HANDLER, code: thin("private readonly orders: OrderService", "if (command.params.flag) { return '' } return this.orders.open(command.params.id)"), errors: [{ messageId: "body" }, { messageId: "branch" }] },
            { filename: HANDLER, code: thin("private readonly orders: OrderService", "return this.orders.open(command.params.flag ? 'a' : 'b')"), errors: [{ messageId: "branch" }] },
            { filename: HANDLER, code: thin("private readonly orders: OrderService", "return this.orders.open(command.params.id ?? 'x')"), errors: [{ messageId: "branch" }] },
            { filename: HANDLER, code: thin("private readonly orders: OrderService", "return this.orders.open(command.params.flag && command.params.id)"), errors: [{ messageId: "branch" }] },
            { filename: HANDLER, code: thin("private readonly orders: OrderService", "try { return this.orders.open(command.params.id) } catch { return '' }"), errors: [{ messageId: "body" }, { messageId: "branch" }] },
            { filename: HANDLER, code: thin("private readonly orders: OrderService", "for (const x of [1]) { break } return this.orders.open(command.params.id)"), errors: [{ messageId: "body" }, { messageId: "branch" }] },
            { filename: HANDLER, code: thin("private readonly orders: OrderService", "switch (command.params.id) { default: return '' }"), errors: [{ messageId: "body" }, { messageId: "branch" }] },
        ],
    })
})

test("message-carries-params-only: a message is one params and nothing else", () => {
    const head = `import { Command } from "@nestjs/cqrs"\nimport type { ExecuteParams } from "@modules/platform/cqrs"\n`
    tester.run("message-carries-params-only", messageCarriesParamsOnly, {
        valid: [
            { filename: COMMAND, code: `${head}export class PlaceOrderCommand extends Command<string> { constructor(readonly params: ExecuteParams<{ id: string }>) { super() } }` },
            { filename: QUERY, code: `${head}export class ListOrdersQuery extends Command<string> { constructor(readonly params: ExecuteParams<{ id: string }>) { super() } }` },
            // a `.command.ts` of a CLI transport is not an application message
            { filename: at("src/features/plan/transport/cli/seed.command.ts"), code: "export class Seed { run() { return 1 } }" },
            // a handler file is not a message file
            { filename: HANDLER, code: "export class H { run() { return 1 } }" },
        ],
        invalid: [
            { filename: COMMAND, code: `${head}export class PlaceOrderCommand extends Command<string> { constructor(readonly params: ExecuteParams<{ id: string }>) { super() } total() { return 1 } }`, errors: [{ messageId: "member" }] },
            { filename: COMMAND, code: `${head}export class PlaceOrderCommand extends Command<string> { readonly at = new Date(); constructor(readonly params: ExecuteParams<{ id: string }>) { super() } }`, errors: [{ messageId: "member" }] },
            { filename: COMMAND, code: `${head}export class PlaceOrderCommand extends Command<string> { constructor(readonly params: ExecuteParams<{ id: string }>, readonly extra: string) { super() } }`, errors: [{ messageId: "shape" }] },
            { filename: COMMAND, code: `${head}export class PlaceOrderCommand extends Command<string> { constructor(readonly request: ExecuteParams<{ id: string }>) { super() } }`, errors: [{ messageId: "shape" }] },
            { filename: COMMAND, code: `${head}export class PlaceOrderCommand extends Command<string> { constructor(readonly params: ExecuteParams<{ id: string }>) { super(); console.log(params) } }`, errors: [{ messageId: "body" }] },
            { filename: COMMAND, code: `${head}export class PlaceOrderCommand extends Command<string> {}`, errors: [{ messageId: "shape" }] },
        ],
    })
})

test("message-typed-result: a message extends Command<R> / Query<R> from @nestjs/cqrs with a readonly params", () => {
    const head = `import { Command, Query } from "@nestjs/cqrs"\nimport type { ExecuteParams } from "@modules/platform/cqrs"\n`
    tester.run("message-typed-result", messageTypedResult, {
        valid: [
            { filename: COMMAND, code: `${head}export class PlaceOrderCommand extends Command<string> { constructor(readonly params: ExecuteParams<string>) { super() } }` },
            { filename: QUERY, code: `${head}export class ListOrdersQuery extends Query<Array<string>> { constructor(readonly params: ExecuteParams<string>) { super() } }` },
            // a renamed import is the same class
            { filename: COMMAND, code: `import { Command as Message } from "@nestjs/cqrs"\nimport type { ExecuteParams } from "@modules/platform/cqrs"\nexport class PlaceOrderCommand extends Message<string> { constructor(readonly params: ExecuteParams<string>) { super() } }` },
            // outside the application slot the rule is silent
            { filename: at("src/features/plan/transport/cli/seed.command.ts"), code: "export class Seed {}" },
        ],
        invalid: [
            { filename: COMMAND, code: `${head}export class PlaceOrderCommand { constructor(readonly params: ExecuteParams<string>) {} }`, errors: [{ messageId: "base" }] },
            { filename: COMMAND, code: `${head}export class PlaceOrderCommand extends Command { constructor(readonly params: ExecuteParams<string>) { super() } }`, errors: [{ messageId: "result" }] },
            // a Query base in a command file
            { filename: COMMAND, code: `${head}export class PlaceOrderCommand extends Query<string> { constructor(readonly params: ExecuteParams<string>) { super() } }`, errors: [{ messageId: "base" }] },
            // a Command that is not the cqrs one
            { filename: COMMAND, code: `import { Command } from "commander"\nimport type { ExecuteParams } from "@modules/platform/cqrs"\nexport class PlaceOrderCommand extends Command<string> { constructor(readonly params: ExecuteParams<string>) { super() } }`, errors: [{ messageId: "base" }] },
            { filename: COMMAND, code: `${head}export class PlaceOrderCommand extends Command<string> { constructor(readonly params: ExecuteParams<string>) { super() } }\nexport class Other extends Command<string> { constructor(params: ExecuteParams<string>) { super() } }`, errors: [{ messageId: "params" }] },
            { filename: COMMAND, code: `${head}export class PlaceOrderCommand extends Command<string> { constructor(private readonly params: ExecuteParams<string>) { super() } }`, errors: [{ messageId: "params" }] },
            { filename: COMMAND, code: `${head}export class PlaceOrderCommand extends Command<string> { constructor(readonly params: ExecuteParams<string> = null as never) { super() } }`, errors: [{ messageId: "params" }] },
        ],
    })
})

test("execute-params-shape: params is ExecuteParams<X> of platform/cqrs and X holds no entity", () => {
    const head = `import { Command } from "@nestjs/cqrs"\nimport type { ExecuteParams, PublicExecuteParams } from "@modules/platform/cqrs"\nimport { OrderEntity } from "@modules/domain/order/persistence/entities/order.entity"\n`
    tester.run("execute-params-shape", executeParamsShape, {
        valid: [
            { filename: COMMAND, code: `${head}export class A extends Command<string> { constructor(readonly params: ExecuteParams<{ id: string }>) { super() } }` },
            { filename: COMMAND, code: `${head}export class A extends Command<string> { constructor(readonly params: PublicExecuteParams<{ id: string }>) { super() } }` },
            // an id or a plain projection of an entity is fine; only the entity class travels badly
            { filename: COMMAND, code: `${head}export class A extends Command<string> { constructor(readonly params: ExecuteParams<{ orderId: OrderEntity["id"] }>) { super() } }` },
        ],
        invalid: [
            { filename: COMMAND, code: `${head}export class A extends Command<string> { constructor(readonly params: { request: { id: string } }) { super() } }`, errors: [{ messageId: "shape" }] },
            // a local alias hides the platform type behind a name of its own
            { filename: COMMAND, code: `${head}type Mine<T> = ExecuteParams<T>\nexport class A extends Command<string> { constructor(readonly params: Mine<{ id: string }>) { super() } }` , errors: [{ messageId: "shape" }] },
            // a lookalike declared in the feature is not the platform type
            { filename: COMMAND, code: `import { Command } from "@nestjs/cqrs"\ninterface ExecuteParams<T> { request: T }\nexport class A extends Command<string> { constructor(readonly params: ExecuteParams<{ id: string }>) { super() } }`, errors: [{ messageId: "shape" }] },
            { filename: COMMAND, code: `${head}export class A extends Command<string> { constructor(readonly params: ExecuteParams<OrderEntity>) { super() } }`, errors: [{ messageId: "entity" }] },
            // reachable through a property, an array and a union
            { filename: COMMAND, code: `${head}export class A extends Command<string> { constructor(readonly params: ExecuteParams<{ order: OrderEntity }>) { super() } }`, errors: [{ messageId: "entity" }] },
            { filename: COMMAND, code: `${head}export class A extends Command<string> { constructor(readonly params: ExecuteParams<{ orders: Array<OrderEntity> }>) { super() } }`, errors: [{ messageId: "entity" }] },
            { filename: COMMAND, code: `${head}export class A extends Command<string> { constructor(readonly params: PublicExecuteParams<{ order: OrderEntity | null }>) { super() } }`, errors: [{ messageId: "entity" }] },
            // reachable through an alias
            { filename: COMMAND, code: `${head}type Payload = { deep: { order: OrderEntity } }\nexport class A extends Command<string> { constructor(readonly params: ExecuteParams<Payload>) { super() } }`, errors: [{ messageId: "entity" }] },
        ],
    })
})

test("no-use-case: no use-case file, no UseCase class, no forwarder service", () => {
    const bus = `import { CommandBus, QueryBus } from "@nestjs/cqrs"\n`
    tester.run("no-use-case", noUseCase, {
        valid: [
            { filename: HANDLER, code: "export class PlaceOrderHandler {}" },
            { filename: COMMAND, code: "export class PlaceOrderCommand {}" },
            // a service that decides something is not a forwarder
            { filename: at(`${APP}/order-math.service.ts`), code: `${bus}export class OrderMathService { constructor(private readonly bus: CommandBus) {} async total(id: string) { const x = id.length; return this.bus.execute(x as never) } }` },
            // a forwarder-shaped service in the support folder is out of the rule's slots
            { filename: SUPPORT, code: `${bus}export class OrderMathService { constructor(private readonly bus: CommandBus) {} total(x: never) { return this.bus.execute(x) } }` },
            // a service with a method that does not dispatch
            { filename: at(`${APP}/order-math.service.ts`), code: `${bus}export class Math { constructor(private readonly bus: CommandBus) {} plain() { return 1 } }` },
            // a class named UseCase in a domain file is out of scope of the application slot
            { filename: DOMAIN, code: "export class BillingUseCase {}" },
            // a forwarder-shaped class in a file that is not a service file
            { filename: HANDLER, code: `${bus}export class Fwd { constructor(private readonly bus: CommandBus) {} go() { return this.bus.execute(null as never) } }` },
            // `execute` on a receiver that is not a bus
            { filename: at(`${APP}/thing.service.ts`), code: "export class Thing { constructor(private readonly runner: { execute(x: number): number }) {} go() { return this.runner.execute(1) } }" },
        ],
        invalid: [
            { filename: at(`${APP}/place-order.use-case.ts`), code: "export const x = 1", errors: [{ messageId: "file" }] },
            { filename: at(`${APP}/support/place-order.use-case.ts`), code: "export const x = 1", errors: [{ messageId: "file" }] },
            { filename: HANDLER, code: "export class PlaceOrderUseCase {}", errors: [{ messageId: "klass" }] },
            { filename: at(`${APP}/place-order.service.ts`), code: `${bus}export class PlaceOrderService { constructor(private readonly commandBus: CommandBus) {} execute(x: never) { return this.commandBus.execute(x) } }`, errors: [{ messageId: "forwarder" }] },
            // a renamed receiver, an awaited dispatch and a query bus are still a forwarder
            { filename: at(`${APP}/list-orders.service.ts`), code: `${bus}export class ListOrdersService { constructor(private readonly q: QueryBus) {} async run(x: never) { return await this.q.execute(x) } }`, errors: [{ messageId: "forwarder" }] },
            // a forwarder parked in a transport slot
            { filename: at("src/features/plan/transport/graphql/place-order.service.ts"), code: `${bus}export class PlaceOrderService { constructor(private readonly b: CommandBus) {} go(x: never) { return this.b.execute(x) } }`, errors: [{ messageId: "forwarder" }] },
        ],
    })
})

test("no-event-bus: no EventBus, @EventsHandler, IEventHandler or @nestjs/event-emitter", () => {
    tester.run("no-event-bus", noEventBus, {
        valid: [
            { filename: HANDLER, code: `import { CommandBus, CommandHandler, QueryBus } from "@nestjs/cqrs"\nexport const x = [CommandBus, CommandHandler, QueryBus]` },
            // a local class with the same name is not the package's
            { filename: HANDLER, code: "class EventBus {}\nexport const x = new EventBus()" },
            { filename: DOMAIN, code: `import { Module } from "@nestjs/common"\nexport const x = Module` },
        ],
        invalid: [
            { filename: HANDLER, code: `import { EventBus } from "@nestjs/cqrs"\nexport const x = EventBus`, errors: [{ messageId: "event" }] },
            { filename: HANDLER, code: `import { EventsHandler } from "@nestjs/cqrs"\nexport const x = EventsHandler`, errors: [{ messageId: "event" }] },
            { filename: HANDLER, code: `import type { IEventHandler } from "@nestjs/cqrs"\nexport type X = IEventHandler`, errors: [{ messageId: "event" }] },
            // renamed
            { filename: HANDLER, code: `import { EventBus as Bus } from "@nestjs/cqrs"\nexport const x = Bus`, errors: [{ messageId: "event" }] },
            // namespace import
            { filename: HANDLER, code: `import * as cqrs from "@nestjs/cqrs"\nexport const x = cqrs.EventBus`, errors: [{ messageId: "event" }] },
            { filename: DOMAIN, code: `import { EventEmitter2 } from "@nestjs/event-emitter"\nexport const x = EventEmitter2`, errors: [{ messageId: "event" }] },
            { filename: DOMAIN, code: `import { OnEvent } from "@nestjs/event-emitter"\nexport const x = OnEvent`, errors: [{ messageId: "event" }] },
            { filename: DOMAIN, code: `export * from "@nestjs/event-emitter"`, errors: [{ messageId: "event" }] },
            { filename: DOMAIN, code: `export const load = () => import("@nestjs/event-emitter")`, errors: [{ messageId: "event" }] },
            { filename: DOMAIN, code: `const e = require("@nestjs/event-emitter")\nexport { e }`, errors: [{ messageId: "event" }] },
            // a spec is not exempt
            { filename: at(`${APP}/place-order.handler.spec.ts`), code: `import { EventBus } from "@nestjs/cqrs"\nexport const x = EventBus`, errors: [{ messageId: "event" }] },
        ],
    })
})

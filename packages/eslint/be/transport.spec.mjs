/**
 * Twin tests for the transport law (R88 `BE_TRANSPORT_SHAPE`).
 *
 *   node --test transport.spec.mjs
 *
 * Typed cases over the fixture repository (`fixtures/typed`): the path of a case decides its slot, the stubs of
 * `@nestjs/cqrs`, `typeorm` and the fixture platform capabilities decide what a receiver IS.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import {
    doorLivesInFeatures,
    noCapabilityImportsFeatures,
    noGraphqlJson,
    noResponseEnvelope,
    restDoorNeedsAReason,
    rules,
    transportIsThin,
} from "./transport.mjs"

const tester = typedTester()
const T = "src/features/api/plan/transport"
const RESOLVER = at(`${T}/graphql/place-order.resolver.ts`)
const DTO = at(`${T}/graphql/dto/place-order.input.ts`)
const CONTROLLER = at(`${T}/http/pay.controller.ts`)
const CONSUMER = at(`${T}/message/paid.consumer.ts`)
const JOB = at(`${T}/schedule/sweep.job.ts`)
const GATEWAY = at(`${T}/websocket/chat.gateway.ts`)
const CLI = at(`${T}/cli/seed.cli.ts`)
const DOMAIN = at("src/modules/domain/order/order.service.ts")
const PLATFORM = at("src/modules/platform/graphql/graphql.module.ts")
const INTEGRATION = at("src/modules/integrations/payos/payos.client.ts")

const BUS = `import { Command, CommandBus, Query, QueryBus } from "@nestjs/cqrs"
import { EntityManager } from "typeorm"
import { Get, Inject, Post, Controller } from "@nestjs/common"
import { Mutation, Query as GqlQuery, Resolver } from "@nestjs/graphql"
import { SubscribeMessage } from "@nestjs/websockets"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs/cqrs.decorators"
import type { RequestLocale } from "@modules/platform/i18n"
import { unwrapOutcome } from "@modules/platform/primitives"
import { unwrapOutcome as lookalike } from "./local"
class Place extends Command<string> {}
class Ask extends Query<string> {}
interface OrderService { place(): number }
`

test("every rule this law declares is exported under its published name", () => {
    for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("transport-is-thin: a door injects only the bus, dispatches exactly once and holds no logic", () => {
    tester.run("transport-is-thin", transportIsThin, {
        valid: [
            { filename: RESOLVER, code: `${BUS}@Resolver() export class R { constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {} @Mutation(() => String, { name: "place" }) async place() { return this.commandBus.execute(new Place()) } }` },
            // a renamed receiver and a query bus
            { filename: RESOLVER, code: `${BUS}@Resolver() export class R { constructor(@InjectQueryBus() private readonly q: QueryBus, @InjectCommandBus() readonly c: CommandBus) {} @GqlQuery(() => String) async ask() { return this.q.execute(new Ask()) } }` },
            // REST content negotiation
            { filename: CONTROLLER, code: `${BUS}@Controller() export class C { constructor(@InjectCommandBus() private readonly bus: CommandBus, private readonly locale: RequestLocale) {} @Post() async pay() { return this.bus.execute(new Place()) } }` },
            { filename: JOB, code: `${BUS}export class J { readonly name = "sweep"; constructor(private readonly bus: CommandBus) {} async run(at: Date) { await this.bus.execute(new Place()) } }` },
            { filename: GATEWAY, code: `${BUS}export class G { constructor(private readonly bus: CommandBus) {} @SubscribeMessage("say") say() { return this.bus.execute(new Place()) } handleConnection() { return 1 } }` },
            { filename: CLI, code: `${BUS}export class S { constructor(private readonly bus: CommandBus) {} async run() { await this.bus.execute(new Place()) } }` },
            // mapping the input and the result with pure mapper functions is mapping
            { filename: RESOLVER, code: `${BUS}import { toCommand, toView } from "./place.mapper"\n@Resolver() export class R { constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {} @Mutation(() => String) async place(input: string) { const command = toCommand(input); return toView(await this.commandBus.execute(command)) } }` },
            // unwrapOutcome of platform/primitives, resolved by its symbol, sits between the bus and the mapper\n            { filename: RESOLVER, code: `${BUS}import { toView } from "./place.mapper"\n@Resolver() export class R { constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {} @Mutation(() => String) async place() { return toView(unwrapOutcome(await this.commandBus.execute(new Place()), Error)) } }` },\n            // a class with no handler method is not a door (a guard, an interceptor, a plain provider)
            { filename: at(`${T}/http/session.guard.ts`), code: `${BUS}export class G { canActivate(x: number) { if (x > 1) { return true } return x ? Date.now() > 1 : false } }` },
            // a Nest module wires consumers and jobs into a registry at startup: it is not a door
            { filename: CONSUMER, code: `${BUS}import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
interface Registry { add(x: object): void }
@Module({})
export class PlanMessageModule implements OnModuleInit { constructor(private readonly registry: Registry) {} onModuleInit(): void { this.registry.add({}) } }` },
            // a DTO class carries decorated fields and no injection
            { filename: DTO, code: `import { Field } from "@nestjs/graphql"\nexport class PlaceInput { @Field() name!: string }` },
            // outside the transport slots the rule is silent
            { filename: DOMAIN, code: `${BUS}export class S { constructor(private readonly em: EntityManager) {} go() { return 1 } }` },
        ],
        invalid: [
            // the exemption is the Module decorator only: an undecorated class that registers at startup is a consumer with no dispatch
            { filename: CONSUMER, code: `${BUS}interface Registry { add(x: object): void }
export class PlanMessageModule { constructor(private readonly registry: Registry) {} onModuleInit(): void { this.registry.add({}) } }`, errors: [{ messageId: "injects" }, { messageId: "none" }, { messageId: "call" }] },
            { filename: RESOLVER, code: `${BUS}@Resolver() export class R { constructor(private readonly orders: OrderService, private readonly bus: CommandBus) {} @Mutation(() => String) place() { return this.bus.execute(new Place()) } }`, errors: [{ messageId: "injects" }] },
            { filename: RESOLVER, code: `${BUS}@Resolver() export class R { constructor(private readonly em: EntityManager, private readonly bus: CommandBus) {} @Mutation(() => String) place() { return this.bus.execute(new Place()) } }`, errors: [{ messageId: "injects" }] },
            // property injection
            { filename: RESOLVER, code: `${BUS}@Resolver() export class R { @Inject("X") private readonly orders!: OrderService; constructor(private readonly bus: CommandBus) {} @Mutation(() => String) place() { return this.bus.execute(new Place()) } }`, errors: [{ messageId: "injects" }] },
            // a lookalike bus declared in the file is not the cqrs one
            { filename: RESOLVER, code: `${BUS}class Fake { execute(x: unknown) { return x } }\n@Resolver() export class R { constructor(private readonly bus: Fake) {} @Mutation(() => String) place() { return this.bus.execute(1) } }`, errors: [{ messageId: "injects" }, { messageId: "none" }, { messageId: "call" }] },
            // the locale is allowed only in a REST door; an inbox is a service concern, never a door dependency
            { filename: RESOLVER, code: `${BUS}@Resolver() export class R { constructor(private readonly locale: RequestLocale, private readonly bus: CommandBus) {} @Mutation(() => String) place() { return this.bus.execute(new Place()) } }`, errors: [{ messageId: "injects" }] },
            // an untyped parameter cannot be judged
            { filename: RESOLVER, code: `${BUS}@Resolver() export class R { constructor(private readonly bus) {} @Mutation(() => String) place() { return this.bus.execute(new Place()) } }`, errors: [{ messageId: "injects" }, { messageId: "none" }, { messageId: "call" }] },
            { filename: RESOLVER, code: `${BUS}@Resolver() export class R { constructor(private readonly bus: CommandBus) {} @Mutation(() => String) place() { return 1 } }`, errors: [{ messageId: "none" }] },
            { filename: RESOLVER, code: `${BUS}@Resolver() export class R { constructor(private readonly bus: CommandBus, private readonly q: QueryBus) {} @Mutation(() => String) async place() { await this.q.execute(new Ask()); return this.bus.execute(new Place()) } }`, errors: [{ messageId: "many" }] },
            { filename: CONTROLLER, code: `${BUS}@Controller() export class C { constructor(private readonly bus: CommandBus) {} @Get() list() { return 1 } }`, errors: [{ messageId: "none" }] },
            { filename: CONSUMER, code: `${BUS}export class C { constructor(private readonly bus: CommandBus) {} async handle() { return 1 } }`, errors: [{ messageId: "none" }] },
            { filename: JOB, code: `${BUS}export class J { constructor(private readonly bus: CommandBus) {} async run() { await this.bus.execute(new Place()); await this.bus.execute(new Place()) } }`, errors: [{ messageId: "many" }] },
            { filename: GATEWAY, code: `${BUS}export class G { constructor(private readonly svc: OrderService) {} @SubscribeMessage("say") say() { return this.svc.place() } }`, errors: [{ messageId: "injects" }, { messageId: "none" }, { messageId: "call" }] },
            // a decision, a loop or a throw in a door is logic no unit spec covers
            { filename: RESOLVER, code: `${BUS}@Resolver() export class R { constructor(private readonly bus: CommandBus) {} @Mutation(() => String) place(flag: boolean) { if (flag) { return "" } return this.bus.execute(new Place()) } }`, errors: [{ messageId: "branch" }] },
            { filename: RESOLVER, code: `${BUS}@Resolver() export class R { constructor(private readonly bus: CommandBus) {} @Mutation(() => String) place(flag: boolean) { return this.bus.execute(flag ? new Place() : new Place()) } }`, errors: [{ messageId: "branch" }] },
            { filename: RESOLVER, code: `${BUS}@Resolver() export class R { constructor(private readonly bus: CommandBus) {} @Mutation(() => String) place(id?: string) { return this.bus.execute(new Place(id ?? "x")) } }`, errors: [{ messageId: "branch" }] },
            { filename: RESOLVER, code: `${BUS}@Resolver() export class R { constructor(private readonly bus: CommandBus) {} @Mutation(() => String) place(a: boolean, b: boolean) { return this.bus.execute(new Place(a && b || a)) } }`, errors: [{ messageId: "branch" }, { messageId: "branch" }] },
            { filename: RESOLVER, code: `${BUS}@Resolver() export class R { constructor(private readonly bus: CommandBus) {} @Mutation(() => String) async place() { try { return await this.bus.execute(new Place()) } catch { throw new Error("x") } } }`, errors: [{ messageId: "branch" }, { messageId: "branch" }] },
            { filename: RESOLVER, code: `${BUS}@Resolver() export class R { constructor(private readonly bus: CommandBus) {} @Mutation(() => String) place(ids: string[]) { for (const id of ids) { void id } return this.bus.execute(new Place()) } }`, errors: [{ messageId: "branch" }] },
            { filename: RESOLVER, code: `${BUS}@Resolver() export class R { constructor(private readonly bus: CommandBus) {} @Mutation(() => String) place(kind: string) { switch (kind) { default: break } return this.bus.execute(new Place()) } }`, errors: [{ messageId: "branch" }] },
            // a lookalike unwrapOutcome from another module is a foreign call\n            { filename: RESOLVER, code: `${BUS}@Resolver() export class R { constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {} @Mutation(() => String) async place() { return lookalike(await this.commandBus.execute(new Place())) } }`, errors: [{ messageId: "call" }] },\n            // an inbox is not a door dependency\n            { filename: CONSUMER, code: `${BUS}interface Inbox { claim(s: string, id: string): Promise<boolean> }\nexport class C { constructor(private readonly inbox: Inbox, private readonly bus: CommandBus) {} async handle(id: string) { if (!(await this.inbox.claim("s", id))) return; await this.bus.execute(new Place()) } }`, errors: [{ messageId: "injects" }, { messageId: "branch" }, { messageId: "call" }] },\n            // a call a door does not make: a global, a helper on the class, a function that is not a mapper
            { filename: RESOLVER, code: `${BUS}import { normalise } from "./normalise.helper"\n@Resolver() export class R { constructor(private readonly bus: CommandBus) {} @Mutation(() => String) place(raw: string) { return this.bus.execute(new Place(normalise(raw))) } }`, errors: [{ messageId: "call" }] },
            { filename: RESOLVER, code: `${BUS}@Resolver() export class R { constructor(private readonly bus: CommandBus) {} @Mutation(() => String) place(raw: string) { return this.bus.execute(new Place(JSON.parse(raw))) } }`, errors: [{ messageId: "call" }] },
            { filename: RESOLVER, code: `${BUS}@Resolver() export class R { constructor(private readonly bus: CommandBus) {} @Mutation(() => String) place(raw: string[]) { return this.bus.execute(new Place(raw.map((x) => x))) } }`, errors: [{ messageId: "call" }] },
            { filename: CONSUMER, code: `${BUS}export class C { constructor(private readonly bus: CommandBus) {} async handle() { await this.bus.execute(new Place()); this.helper() } private helper() { return 1 } }`, errors: [{ messageId: "call" }] },
            // logic hidden in a private helper of the door is still logic in the door
            { filename: CONSUMER, code: `${BUS}export class C { constructor(private readonly bus: CommandBus) {} async handle(x: number) { await this.bus.execute(new Place()) } private pick(x: number) { return x > 1 ? 1 : 2 } }`, errors: [{ messageId: "branch" }] },
            // an action that dispatches and returns nothing
            { filename: CONTROLLER, code: `${BUS}@Controller() export class C { constructor(private readonly bus: CommandBus) {} @Post() async pay() { await this.bus.execute(new Place()) } }`, errors: [{ messageId: "noReturn" }] },
        ],
    })
})

test("no-response-envelope: no envelope class, decorator, mapping interceptor or { success, data } literal", () => {
    tester.run("no-response-envelope", noResponseEnvelope, {
        valid: [
            { filename: RESOLVER, code: `${BUS}@Resolver() export class R { @Mutation(() => String) place() { return { id: 1 } } }` },
            { filename: RESOLVER, code: `import { UseInterceptors } from "@nestjs/common"\nimport { PlainInterceptor } from "./plain.interceptor"\n@UseInterceptors(PlainInterceptor) export class R {}` },
            // only one of the two envelope keys is not an envelope
            { filename: RESOLVER, code: `${BUS}@Resolver() export class R { @Mutation(() => String) place() { return { success: true } } }` },
            // a nested function of a method is not the method's return
            { filename: RESOLVER, code: `${BUS}@Resolver() export class R { @Mutation(() => String) place() { return [1].map((x) => { return { success: true, data: x } }) } }` },
            // an interceptor the repository does not declare is judged by nobody here
            { filename: RESOLVER, code: `import { UseInterceptors, ClassSerializerInterceptor } from "@nestjs/common"\n@UseInterceptors(ClassSerializerInterceptor) export class R {}` },
        ],
        invalid: [
            { filename: RESOLVER, code: `import { UseInterceptors } from "@nestjs/common"\nimport { WrapInterceptor } from "./wrap.interceptor"\n@UseInterceptors(WrapInterceptor) export class R {}`, errors: [{ messageId: "interceptor" }] },
            { filename: RESOLVER, code: `import { UseInterceptors } from "@nestjs/common"\nimport { WrapInterceptor } from "./wrap.interceptor"\n@UseInterceptors(new WrapInterceptor()) export class R {}`, errors: [{ messageId: "interceptor" }] },
            { filename: RESOLVER, code: `${BUS}@Resolver() export class R { @Mutation(() => String) place() { return { success: true, data: 1 } } }`, errors: [{ messageId: "literal" }] },
            { filename: RESOLVER, code: `${BUS}@Resolver() export class R { @Mutation(() => String) async place(ok: boolean) { if (ok) { return await ({ success: true, message: "ok", data: 1 } as never) } return null } }`, errors: [{ messageId: "literal" }] },
            { filename: CONTROLLER, code: `${BUS}@Controller() export class C { @Get() list() { return { "success": true, "data": [] } } }`, errors: [{ messageId: "literal" }] },
            { filename: RESOLVER, code: `export class GraphQLTransformInterceptor {}`, errors: [{ messageId: "named" }] },
            { filename: DOMAIN, code: `export abstract class AbstractGraphQLResponse {}`, errors: [{ messageId: "named" }] },
            { filename: DOMAIN, code: `export class RestTransformInterceptor {}`, errors: [{ messageId: "named" }] },
            { filename: DOMAIN, code: `export const GraphQLSuccessMessage = (text: string) => text`, errors: [{ messageId: "named" }] },
            // an import under a rename is still the envelope name
            { filename: RESOLVER, code: `import { GraphQLSuccessMessage as Msg } from "@modules/platform/graphql"\n@Msg("ok") export class R {}`, errors: [{ messageId: "named" }] },
        ],
    })
})

test("no-graphql-json: no GraphQLJSON, no unknown body, no switch on operation", () => {
    tester.run("no-graphql-json", noGraphqlJson, {
        valid: [
            { filename: RESOLVER, code: `import { GraphQLDateTime } from "graphql-scalars"\nexport const x = GraphQLDateTime` },
            { filename: CONTROLLER, code: `import { Body, Post } from "@nestjs/common"\nclass PayRequest { id!: string }\nexport class C { @Post() pay(@Body() body: PayRequest) { return body } }` },
            { filename: RESOLVER, code: `export function f(input: { kind: string }) { switch (input.kind) { case "a": return 1 } return 2 }` },
            // an untyped parameter that is not a body
            { filename: CONTROLLER, code: `export class C { pay(body: unknown) { return body } }` },
            // outside the transport slots the rule is silent
            { filename: PLATFORM, code: `import GraphQLJSON from "graphql-type-json"\nexport const x = GraphQLJSON` },
        ],
        invalid: [
            { filename: RESOLVER, code: `import GraphQLJSON from "graphql-type-json"\nexport const x = GraphQLJSON`, errors: [{ messageId: "scalar" }] },
            { filename: RESOLVER, code: `import { GraphQLJSON as Json } from "graphql-scalars"\nexport const x = Json`, errors: [{ messageId: "scalar" }] },
            // laundered through a repository re-export under another name
            { filename: RESOLVER, code: `import { AnyJson } from "@modules/platform/graphql/graphql.type"\nexport const x = AnyJson`, errors: [{ messageId: "scalar" }] },
            { filename: CONTROLLER, code: `import { Body, Post } from "@nestjs/common"\nexport class C { @Post() pay(@Body() body: unknown) { return body } }`, errors: [{ messageId: "body" }] },
            { filename: CONTROLLER, code: `import { Body, Post } from "@nestjs/common"\nexport class C { @Post() pay(@Body() body: Record<string, unknown>) { return body } }`, errors: [{ messageId: "body" }] },
            { filename: CONTROLLER, code: `import { Body as Payload, Post } from "@nestjs/common"\ntype Bag = Record<string, unknown>\nexport class C { @Post() pay(@Payload() body: Bag) { return body } }`, errors: [{ messageId: "body" }] },
            { filename: RESOLVER, code: `export function f(input: { operation: string }) { switch (input.operation) { case "a": return 1 } return 2 }`, errors: [{ messageId: "operation" }] },
            { filename: RESOLVER, code: `export function f(input: { operation: string }) { switch (input["operation"]) { case "a": return 1 } return 2 }`, errors: [{ messageId: "operation" }] },
        ],
    })
})

test("door-lives-in-features: a @Controller is declared in the transport/http slot", () => {
    const head = `import { Controller } from "@nestjs/common"\n`
    tester.run("door-lives-in-features", doorLivesInFeatures, {
        valid: [
            { filename: CONTROLLER, code: `${head}@Controller() export class C {}` },
            // a decorator of the same name that is not Nest's
            { filename: DOMAIN, code: `const Controller = () => (t: unknown) => t\n@Controller() export class C {}` },
            { filename: DOMAIN, code: `export class C {}` },
        ],
        invalid: [
            { filename: DOMAIN, code: `${head}@Controller() export class C {}`, errors: [{ messageId: "wrongSlot" }] },
            { filename: PLATFORM, code: `${head}@Controller("health") export class C {}`, errors: [{ messageId: "wrongSlot" }] },
            // a REST door parked in the GraphQL slot of a feature is still not in the http slot
            { filename: RESOLVER, code: `${head}@Controller() export class C {}`, errors: [{ messageId: "wrongSlot" }] },
            { filename: DOMAIN, code: `import { Controller as Door } from "@nestjs/common"\n@Door() export class C {}`, errors: [{ messageId: "wrongSlot" }] },
        ],
    })
})

test("no-capability-imports-features: a capability never imports a feature", () => {
    tester.run("no-capability-imports-features", noCapabilityImportsFeatures, {
        valid: [
            // a capability importing another capability
            { filename: DOMAIN, code: `import { x } from "@modules/platform/cqrs"\nexport { x }` },
            // a feature importing a capability, or another file of its own owner
            { filename: RESOLVER, code: `import { x } from "@modules/domain/order"\nexport { x }` },
            { filename: RESOLVER, code: `import { x } from "@features/api/plan"\nexport { x }` },
            // a package whose name spells features
            { filename: DOMAIN, code: `import { x } from "features"\nexport { x }` },
        ],
        invalid: [
            { filename: DOMAIN, code: `import { x } from "@features/api/plan"\nexport { x }`, errors: [{ messageId: "reversed" }] },
            { filename: DOMAIN, code: `import { x } from "../../../features/api/plan"\nexport { x }`, errors: [{ messageId: "reversed" }] },
            { filename: PLATFORM, code: `export { x } from "@features/api/plan"`, errors: [{ messageId: "reversed" }] },
            { filename: INTEGRATION, code: `export const load = () => import("@features/api/plan")`, errors: [{ messageId: "reversed" }] },
            { filename: DOMAIN, code: `const plan = require("@features/api/plan")\nexport { plan }`, errors: [{ messageId: "reversed" }] },
        ],
    })
})

test("rest-door-needs-a-reason: a controller shows a public reason, a byte stream or a redirect", () => {
    const head = `import { Controller, Get, Redirect, StreamableFile } from "@nestjs/common"\nimport { Public, PublicReason } from "@modules/domain/identity"\n`
    tester.run("rest-door-needs-a-reason", restDoorNeedsAReason, {
        valid: [
            { filename: CONTROLLER, code: `${head}@Controller("health") export class C { @Public({ reason: PublicReason.Health }) @Get() ok() { return 1 } }` },
            { filename: CONTROLLER, code: `${head}@Controller("hooks") export class C { @Public({ reason: PublicReason.SignedWebhook }) @Get() hook() { return 1 } }` },
            { filename: CONTROLLER, code: `${head}@Controller("auth") export class C { @Public({ reason: PublicReason.AuthHandshake }) @Get() callback() { return 1 } }` },
            { filename: CONTROLLER, code: `${head}@Controller("files") export class C { @Get() file() { return new StreamableFile(Buffer.from("")) } }` },
            // a renamed import is the same export
            { filename: CONTROLLER, code: `import { Controller, Get, StreamableFile as Bytes } from "@nestjs/common"\n@Controller("files") export class C { @Get() file() { return new Bytes(Buffer.from("")) } }` },
            { filename: CONTROLLER, code: `${head}@Controller("oauth") export class C { @Redirect() @Get() go() { return { url: "/" } } }` },
            { filename: CONTROLLER, code: `import { Controller, Post } from "@nestjs/common"\nimport { FileInterceptor } from "@nestjs/platform-express"\n@Controller("up") export class C { @Post() up() { return FileInterceptor } }` },
            // a class that is not a controller is not judged
            { filename: CONTROLLER, code: `export class NotADoor { list() { return 1 } }` },
        ],
        invalid: [
            { filename: CONTROLLER, code: `${head}@Controller("orders") export class C { @Get() list() { return 1 } }`, errors: [{ messageId: "unjustified" }] },
            // a catalog read is a GraphQL query, not a REST reason
            { filename: CONTROLLER, code: `${head}@Controller("catalog") export class C { @Public({ reason: PublicReason.CatalogRead }) @Get() list() { return 1 } }`, errors: [{ messageId: "unjustified" }] },
            // a local enum of the same name is not the identity capability's
            { filename: CONTROLLER, code: `import { Controller, Get } from "@nestjs/common"\nenum PublicReason { Health }\n@Controller("orders") export class C { @Get() list() { return PublicReason.Health } }`, errors: [{ messageId: "unjustified" }] },
            // a class of the same name is not the stream
            { filename: CONTROLLER, code: `import { Controller, Get } from "@nestjs/common"\nclass StreamableFile {}\n@Controller("orders") export class C { @Get() list() { return new StreamableFile() } }`, errors: [{ messageId: "unjustified" }] },
        ],
    })
})

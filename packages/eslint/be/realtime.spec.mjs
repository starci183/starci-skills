/**
 * Twin tests for the realtime kind (R184 `BE_REALTIME_SHAPE`, R185 `BE_REALTIME_WRITES`, R186 `BE_REALTIME_TOPIC_SCOPE`).
 *
 *   node --test realtime.spec.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { appDeclaration } from "./fixtures/app.mjs"
import { BE_DECLARATION, TYPED_ROOT, at, ruleTester, typedTester } from "./fixtures/typed/tester.mjs"
import { hfsFromDeclaration } from "./lib/hfs.mjs"
import { realtimeReadOnly, realtimeShape, realtimeTopicScope, rules } from "./realtime.mjs"

const tester = typedTester({ declaration: { ...BE_DECLARATION, patterns: ["webhooks", "realtime"] } })
const GATEWAY = at("src/features/realtime/order-status/transport/websocket/order-status.gateway.ts")
const SUBSCRIPTION = at("src/features/realtime/order-status/transport/graphql/order-status.subscription.ts")
const SSE = at("src/features/realtime/order-status/transport/sse/order-status.controller.ts")
const OTHER_SLOT = at("src/features/plan/transport/graphql/order-status.subscription.ts")

const SOCKET_HEAD = `import { SubscribeMessage, WebSocketGateway } from "@nestjs/websockets"
import { CurrentPrincipal } from "@modules/domain/identity"
import { RealtimeHub } from "@modules/platform/realtime"
`
const GRAPHQL_HEAD = `import { Args, Resolver, Subscription } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { RealtimeHub } from "@modules/platform/realtime"
`
const PUSH_HEAD = `import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets"
import type { Principal } from "@modules/platform/cqrs"
import { RealtimeHub } from "@modules/platform/realtime"
`

const SSE_HEAD = `import { Controller, Headers, Sse } from "@nestjs/common"
import { CurrentPrincipal } from "@modules/domain/identity"
import { RealtimeHub } from "@modules/platform/realtime"
`

/** A gateway whose one handler body and constructor are given. */
const gateway = ({ head = SOCKET_HEAD, ctor = "private readonly hub: RealtimeHub", params = "@CurrentPrincipal() principal: { id: string }", body = "return this.hub.subscribe(`orders:${principal.id}`)", extra = "" } = {}) => `${head}
@WebSocketGateway()
export class OrderStatusGateway {
    constructor(${ctor}) {}

    @SubscribeMessage("orders")
    watch(${params}): AsyncIterable<object> {
        ${body}
    }
    ${extra}
}`

/** An SSE controller whose one `@Sse` method body and constructor are given. */
const controller = ({ head = SSE_HEAD, ctor = "private readonly hub: RealtimeHub", params = "@CurrentPrincipal() principal: { id: string }, @Headers(\"last-event-id\") lastEventId?: string", body = "return this.hub.subscribe(`orders:${principal.id}`, { after: lastEventId })", extra = "" } = {}) => `${head}
@Controller("orders")
export class OrderStatusController {
    constructor(${ctor}) {}

    @Sse("stream")
    stream(${params}): AsyncIterable<object> {
        ${body}
    }
    ${extra}
}`

/** A subscription resolver whose one operation body and constructor are given. */
const subscription = ({ head = GRAPHQL_HEAD, ctor = "private readonly hub: RealtimeHub", params = "@CurrentPrincipal() principal: { id: string }, @Args(\"orderId\") orderId: string", body = "return this.hub.subscribe(`orders:${principal.id}:${orderId}`)", extra = "" } = {}) => `${head}
@Resolver()
export class OrderStatusSubscription {
    constructor(${ctor}) {}

    @Subscription(() => Object)
    orderStatusChanged(${params}): AsyncIterable<object> {
        ${body}
    }
    ${extra}
}`

/** A server-owned push stream receives the authenticated principal from socket middleware. */
const pushGateway = ({ head = PUSH_HEAD, ctor = "private readonly hub: RealtimeHub", params = "principal: Principal", body = "return this.hub.subscribe(`orders:${principal.id}`)", extra = "", server = "@WebSocketServer()\n    namespace!: object" } = {}) => `${head}
@WebSocketGateway()
export class OrderStatusGateway {
    constructor(${ctor}) {}
    ${server}
    frames(${params}): AsyncIterable<object> {
        ${body}
    }
    ${extra}
}`

/** The same typed rule surface is exercised in each edition. */
const editionTester = (edition) => {
    const declaration = { ...appDeclaration("be", { ...BE_DECLARATION, patterns: ["realtime"] }), edition }
    return ruleTester({ root: TYPED_ROOT, hfs: hfsFromDeclaration(declaration, TYPED_ROOT) })
}

test("every rule this law declares is exported under its published name", () => {
    for (const [name, rule] of Object.entries(rules)) assert.ok(rule?.meta && rule.create, `${name} is not a rule`)
})

test("realtime-shape: a file is the one door its role names, with no route, query or mutation", () => {
    tester.run("realtime-shape", realtimeShape, {
        valid: [
            { filename: GATEWAY, code: gateway() },
            { filename: SUBSCRIPTION, code: subscription() },
            { filename: SSE, code: controller() },
            // the module and the dto of the kind are not doors
            { filename: at("src/features/realtime/order-status/transport/graphql/order-status-graphql.module.ts"), code: "export class M {}" },
            // outside the realtime slot nothing is judged
            { filename: OTHER_SLOT, code: "export class NotADoor {}" },
        ],
        invalid: [
            // no door class, or two
            { filename: GATEWAY, code: "export class Plain {}", errors: [{ messageId: "door" }] },
            { filename: GATEWAY, code: `${gateway()}\n@WebSocketGateway()\nexport class Second {}`, errors: [{ messageId: "door" }] },
            { filename: SUBSCRIPTION, code: `${GRAPHQL_HEAD}export class Plain {}`, errors: [{ messageId: "door" }] },
            // a door with no handler
            { filename: GATEWAY, code: `${SOCKET_HEAD}@WebSocketGateway()\nexport class Empty {}`, errors: [{ messageId: "operations" }] },
            { filename: SUBSCRIPTION, code: `${GRAPHQL_HEAD}@Resolver()\nexport class Empty {}`, errors: [{ messageId: "operations" }] },
            // a query, a mutation and a REST route have no place in a subscription door
            { filename: SUBSCRIPTION, code: subscription({ head: `${GRAPHQL_HEAD}import { Mutation, Query } from "@nestjs/graphql"\n`, extra: "@Query(() => String)\n    read(): string { return 'x' }\n    @Mutation(() => String)\n    write(): string { return 'x' }" }), errors: [{ messageId: "foreign" }, { messageId: "foreign" }] },
            { filename: SUBSCRIPTION, code: subscription({ head: `${GRAPHQL_HEAD}import { Controller } from "@nestjs/common"\n`, extra: "" }).replace("@Resolver()", "@Controller()\n@Resolver()"), errors: [{ messageId: "foreign" }] },
            // a socket handler inside a subscription file is the other protocol
            { filename: SUBSCRIPTION, code: subscription({ head: `${GRAPHQL_HEAD}import { SubscribeMessage } from "@nestjs/websockets"\n`, extra: "@SubscribeMessage('x')\n    other(): void {}" }), errors: [{ messageId: "foreign" }] },
            // an SSE controller is one controller with exactly one @Sse stream and no plain route
            { filename: SSE, code: `${SSE_HEAD}export class Plain {}`, errors: [{ messageId: "door" }] },
            { filename: SSE, code: `${SSE_HEAD}@Controller("orders") export class Empty {}`, errors: [{ messageId: "operations" }] },
            { filename: SSE, code: controller({ extra: '@Sse("other") other(): AsyncIterable<object> { return [] as never }' }), errors: [{ messageId: "single" }] },
            { filename: SSE, code: controller({ head: `${SSE_HEAD}import { Get, Post } from "@nestjs/common"\n`, extra: '@Get("read") read(): string { return "x" } @Post("write") write(): string { return "x" }' }), errors: [{ messageId: "foreign" }, { messageId: "foreign" }] },
            { filename: SSE, code: controller({ head: `${SSE_HEAD}import { Query } from "@nestjs/graphql"\n`, extra: "@Query(() => String) read(): string { return 'x' }" }), errors: [{ messageId: "foreign" }] },
            { filename: SSE, code: controller({ head: `${SSE_HEAD}import { SubscribeMessage } from "@nestjs/websockets"\n`, extra: "@SubscribeMessage('x') other(): void {}" }), errors: [{ messageId: "foreign" }] },
            // a subscription inside a gateway file is the other protocol
            { filename: GATEWAY, code: gateway({ head: `${SOCKET_HEAD}import { Subscription } from "@nestjs/graphql"\n`, extra: "@Subscription(() => Object)\n    other(): void {}" }), errors: [{ messageId: "foreign" }] },
        ],
    })
})

test("realtime-read-only: the hub is the only injected value", () => {
    tester.run("realtime-read-only", realtimeReadOnly, {
        valid: [
            { filename: GATEWAY, code: gateway() },
            { filename: SUBSCRIPTION, code: subscription() },
            { filename: SSE, code: controller() },
            // a class with no constructor injects nothing
            { filename: SUBSCRIPTION, code: subscription({ ctor: "" }) },
            // outside the realtime slot nothing is judged
            { filename: OTHER_SLOT, code: subscription({ ctor: "private readonly hub: RealtimeHub, private readonly orders: OrderService" }) },
        ],
        invalid: [
            { filename: GATEWAY, code: gateway({ head: `${SOCKET_HEAD}import { OrderService } from "@modules/domain/order"\n`, ctor: "private readonly hub: RealtimeHub, private readonly orders: OrderService" }), errors: [{ messageId: "injects" }] },
            { filename: SUBSCRIPTION, code: subscription({ head: `${GRAPHQL_HEAD}import { EntityManager } from "typeorm"\n`, ctor: "private readonly hub: RealtimeHub, private readonly entityManager: EntityManager" }), errors: [{ messageId: "injects" }] },
            { filename: SUBSCRIPTION, code: subscription({ head: `${GRAPHQL_HEAD}import { CommandBus } from "@nestjs/cqrs"\n`, ctor: "private readonly bus: CommandBus" }), errors: [{ messageId: "injects" }] },
            { filename: SSE, code: controller({ head: `${SSE_HEAD}import { OrderService } from "@modules/domain/order"
`, ctor: "private readonly hub: RealtimeHub, private readonly orders: OrderService" }), errors: [{ messageId: "injects" }] },
            // an untyped parameter cannot be proven to be the hub
            { filename: SUBSCRIPTION, code: subscription({ ctor: "private readonly hub" }), errors: [{ messageId: "injects" }] },
            // a lookalike hub of another owner is not the platform hub
            { filename: SUBSCRIPTION, code: subscription({ head: GRAPHQL_HEAD.replace('import { RealtimeHub } from "@modules/platform/realtime"', 'import { PaymentService as RealtimeHub } from "@modules/domain/payment"') }), errors: [{ messageId: "injects" }] },
        ],
    })
})

test("realtime-topic-scope: the topic is built from the principal parameter", () => {
    tester.run("realtime-topic-scope", realtimeTopicScope, {
        valid: [
            { filename: GATEWAY, code: gateway() },
            { filename: SUBSCRIPTION, code: subscription() },
            { filename: SSE, code: controller() },
            // the Last-Event-ID only picks the replay point inside a topic built from the principal
            { filename: SSE, code: controller({ body: "return this.hub.subscribe(['orders', principal.id].join(':'), { after: lastEventId })" }) },
            // the principal id may be passed through a call
            { filename: SUBSCRIPTION, code: subscription({ body: "return this.hub.subscribe(['orders', principal.id].join(':'))" }) },
            // a handler that never subscribes is not judged
            { filename: SUBSCRIPTION, code: subscription({ body: "return this.hub.subscribe.name as never" }) },
            // outside the realtime slot nothing is judged
            { filename: OTHER_SLOT, code: subscription({ params: "@Args(\"orderId\") orderId: string", body: "return this.hub.subscribe(orderId)" }) },
        ],
        invalid: [
            // a topic from client input only
            { filename: SUBSCRIPTION, code: subscription({ body: "return this.hub.subscribe(`orders:${orderId}`)" }), errors: [{ messageId: "scope" }] },
            { filename: SUBSCRIPTION, code: subscription({ body: "return this.hub.subscribe('orders')" }), errors: [{ messageId: "scope" }] },
            // a topic from the Last-Event-ID header or the client alone is a leak
            { filename: SSE, code: controller({ body: "return this.hub.subscribe(`orders:${lastEventId}`)" }), errors: [{ messageId: "scope" }] },
            { filename: SSE, code: controller({ params: "@Headers(\"last-event-id\") lastEventId?: string", body: "return this.hub.subscribe('orders')" }), errors: [{ messageId: "scope" }] },
            // no principal parameter at all
            { filename: GATEWAY, code: gateway({ params: "", body: "return this.hub.subscribe('orders')" }), errors: [{ messageId: "scope" }] },
            // a principal parameter that is a lookalike decorator of another owner proves nothing
            { filename: SUBSCRIPTION, code: subscription({ head: GRAPHQL_HEAD.replace('"@modules/domain/identity"', '"@modules/domain/payment/payment.decorators"') }), errors: [{ messageId: "scope" }] },
            // a name that merely looks like the parameter: the parameter of an inner function is not the principal
            { filename: SUBSCRIPTION, code: subscription({ body: "return ((principal: { id: string }) => this.hub.subscribe(`orders:${principal.id}`))({ id: 'x' })" }), errors: [{ messageId: "scope" }] },
        ],
    })
})

for (const edition of ["lite", "full"]) {
    test(`realtime-shape: ${edition} permits a principal-typed server push stream`, () => {
        editionTester(edition).run("realtime-shape", realtimeShape, {
            valid: [
                { filename: GATEWAY, code: pushGateway() },
                { filename: GATEWAY, code: gateway() },
                { filename: GATEWAY, code: pushGateway({ head: PUSH_HEAD.replace("WebSocketServer }", "WebSocketServer as SocketServer }").replace("{ Principal }", "{ Principal as Caller }"), params: "caller: Caller", body: "return this.hub.subscribe(['orders', caller.id].join(':'))", server: "@SocketServer()\n    namespace!: object" }) },
            ],
            invalid: [
                { filename: GATEWAY, code: pushGateway({ server: "" }), errors: [{ messageId: "operations" }] },
                { filename: GATEWAY, code: pushGateway({ params: "principal: { id: string }" }), errors: [{ messageId: "operations" }] },
                { filename: GATEWAY, code: pushGateway({ body: "return [] as never" }), errors: [{ messageId: "operations" }] },
                { filename: GATEWAY, code: pushGateway({ head: PUSH_HEAD.replace("import { WebSocketGateway, WebSocketServer }", "import { WebSocketGateway }") + "function WebSocketServer(): PropertyDecorator { return () => {} }\n" }), errors: [{ messageId: "operations" }] },
                { filename: GATEWAY, code: pushGateway({ head: PUSH_HEAD + 'import { Query, Mutation } from "@nestjs/graphql"\n', extra: "@Query(() => String)\n    read(): string { return 'x' }\n    @Mutation(() => String)\n    write(): string { return 'x' }" }), errors: [{ messageId: "foreign" }, { messageId: "foreign" }] },
                { filename: GATEWAY, code: pushGateway({ head: PUSH_HEAD + 'import { Controller } from "@nestjs/common"\n' }).replace("@WebSocketGateway()", "@Controller()\n@WebSocketGateway()"), errors: [{ messageId: "foreign" }] },
                { filename: GATEWAY, code: pushGateway({ head: PUSH_HEAD + 'import { Subscription } from "@nestjs/graphql"\n', extra: "@Subscription(() => Object)\n    other(): void {}" }), errors: [{ messageId: "foreign" }] },
            ],
        })
    })

    test(`realtime-topic-scope: ${edition} push streams retain principal scope`, () => {
        editionTester(edition).run("realtime-topic-scope", realtimeTopicScope, {
            valid: [
                { filename: GATEWAY, code: pushGateway() },
                { filename: GATEWAY, code: pushGateway({ params: "principal: Principal, verifiedId: string", body: "return this.hub.subscribe(['orders', principal.id, verifiedId].join(':'))" }) },
            ],
            invalid: [
                { filename: GATEWAY, code: pushGateway({ body: "return this.hub.subscribe('orders')" }), errors: [{ messageId: "scope" }] },
                { filename: GATEWAY, code: pushGateway({ params: "principal: Principal, topic: string", body: "return this.hub.subscribe(topic)" }), errors: [{ messageId: "scope" }] },
                { filename: GATEWAY, code: pushGateway({ params: "principal: { id: string }" }), errors: [{ messageId: "scope" }] },
                { filename: GATEWAY, code: pushGateway({ head: PUSH_HEAD.replace('import type { Principal } from "@modules/platform/cqrs"', 'import { PaymentService as Principal } from "@modules/domain/payment"') }), errors: [{ messageId: "scope" }] },
                { filename: GATEWAY, code: pushGateway({ body: "return ((principal: Principal) => this.hub.subscribe(`orders:${principal.id}`))({ id: 'x' })" }), errors: [{ messageId: "scope" }] },
                // An inbound handler still needs the identity decorator; a client argument's type proves no authentication.
                { filename: GATEWAY, code: gateway({ head: SOCKET_HEAD + 'import type { Principal } from "@modules/platform/cqrs"\n', params: "principal: Principal" }), errors: [{ messageId: "scope" }] },
            ],
        })
    })

    test(`realtime-read-only: ${edition} push streams inject only the platform hub`, () => {
        editionTester(edition).run("realtime-read-only", realtimeReadOnly, {
            valid: [{ filename: GATEWAY, code: pushGateway() }],
            invalid: [{ filename: GATEWAY, code: pushGateway({ head: PUSH_HEAD + 'import { OrderService } from "@modules/domain/order"\n', ctor: "private readonly hub: RealtimeHub, private readonly orders: OrderService" }), errors: [{ messageId: "injects" }] }],
        })
    })
}

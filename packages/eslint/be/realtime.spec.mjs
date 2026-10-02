/**
 * Twin tests for the realtime kind (R163 `BE_REALTIME_SHAPE`, R164 `BE_REALTIME_WRITES`, R165 `BE_REALTIME_TOPIC_SCOPE`).
 *
 *   node --test realtime.spec.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { BE_DECLARATION, at, typedTester } from "./fixtures/typed/tester.mjs"
import { realtimeReadOnly, realtimeShape, realtimeTopicScope, rules } from "./realtime.mjs"

const tester = typedTester({ declaration: { ...BE_DECLARATION, patterns: ["webhooks", "realtime"] } })
const GATEWAY = at("src/features/realtime/order-status/order-status.gateway.ts")
const SUBSCRIPTION = at("src/features/realtime/order-status/order-status.subscription.ts")
const OTHER_SLOT = at("src/features/plan/transport/graphql/order-status.subscription.ts")

const SOCKET_HEAD = `import { SubscribeMessage, WebSocketGateway } from "@nestjs/websockets"
import { CurrentPrincipal } from "@modules/domain/identity"
import { RealtimeHub } from "@modules/platform/realtime"
`
const GRAPHQL_HEAD = `import { Args, Resolver, Subscription } from "@nestjs/graphql"
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

test("every rule this law declares is exported under its published name", () => {
    for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("realtime-shape: a file is the one door its role names, with no route, query or mutation", () => {
    tester.run("realtime-shape", realtimeShape, {
        valid: [
            { filename: GATEWAY, code: gateway() },
            { filename: SUBSCRIPTION, code: subscription() },
            // the module and the dto of the kind are not doors
            { filename: at("src/features/realtime/order-status/order-status-realtime.module.ts"), code: "export class M {}" },
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
            // a class with no constructor injects nothing
            { filename: SUBSCRIPTION, code: subscription({ ctor: "" }) },
            // outside the realtime slot nothing is judged
            { filename: OTHER_SLOT, code: subscription({ ctor: "private readonly hub: RealtimeHub, private readonly orders: OrderService" }) },
        ],
        invalid: [
            { filename: GATEWAY, code: gateway({ head: `${SOCKET_HEAD}import { OrderService } from "@modules/domain/order"\n`, ctor: "private readonly hub: RealtimeHub, private readonly orders: OrderService" }), errors: [{ messageId: "injects" }] },
            { filename: SUBSCRIPTION, code: subscription({ head: `${GRAPHQL_HEAD}import { EntityManager } from "typeorm"\n`, ctor: "private readonly hub: RealtimeHub, private readonly entityManager: EntityManager" }), errors: [{ messageId: "injects" }] },
            { filename: SUBSCRIPTION, code: subscription({ head: `${GRAPHQL_HEAD}import { CommandBus } from "@nestjs/cqrs"\n`, ctor: "private readonly bus: CommandBus" }), errors: [{ messageId: "injects" }] },
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
            // no principal parameter at all
            { filename: GATEWAY, code: gateway({ params: "", body: "return this.hub.subscribe('orders')" }), errors: [{ messageId: "scope" }] },
            // a principal parameter that is a lookalike decorator of another owner proves nothing
            { filename: SUBSCRIPTION, code: subscription({ head: GRAPHQL_HEAD.replace('"@modules/domain/identity"', '"@modules/domain/payment/payment.decorators"') }), errors: [{ messageId: "scope" }] },
            // a name that merely looks like the parameter: the parameter of an inner function is not the principal
            { filename: SUBSCRIPTION, code: subscription({ body: "return ((principal: { id: string }) => this.hub.subscribe(`orders:${principal.id}`))({ id: 'x' })" }), errors: [{ messageId: "scope" }] },
        ],
    })
})

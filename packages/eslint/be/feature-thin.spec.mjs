/**
 * Twin tests for the thin-feature law (R203 `BE_FEATURE_THIN`).
 *
 *   node --test feature-thin.spec.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { BE_DECLARATION, at, typedTester } from "./fixtures/typed/tester.mjs"
import { featureThin, rules } from "./feature-thin.mjs"

const tester = typedTester({ declaration: { ...BE_DECLARATION, patterns: ["webhooks", "realtime", "fenced-job", "event-bus", "saga"] } })

const HANDLER = at("src/features/api/checkout/application/place-order.handler.ts")
const RESOLVER = at("src/features/api/checkout/transport/graphql/place-order.resolver.ts")
const MAPPER = at("src/features/api/checkout/transport/graphql/place-order.mapper.ts")
const CONSUMER = at("src/features/reactors/order-paid-loyalty/transport/message/order-paid.consumer.ts")
const PROCESSOR = at("src/features/jobs/expire-orders/transport/queue/expire-orders.processor.ts")
const STEP = at("src/features/jobs/expire-orders/steps/expire-overdue.step.ts")
const COMPENSATION = at("src/features/saga/place-order/compensations/reserve-order.compensation.ts")
const SAGA_STEP = at("src/features/saga/place-order/steps/reserve-order.saga-step.ts")
const WEBHOOK = at("src/features/webhooks/sepay/transport/http/sepay.webhook.ts")
const SUBSCRIPTION = at("src/features/realtime/order-status/transport/graphql/order-status.subscription.ts")
const CLI = at("src/features/cli/migrate/subs/run.cli.ts")
const COMMAND = at("src/features/api/checkout/application/place-order.command.ts")
const HANDLER_SPEC = at("src/features/api/checkout/application/place-order.handler.spec.ts")
const DECLARATION_FILE = at("src/features/api/checkout/application/place-order.d.ts")
const DOMAIN_SERVICE = at("src/modules/domain/order/order.service.ts")

const SERVICES = `import { OrderService } from "@modules/domain/order"
`

/** A feature door class whose `handle` holds the given body. */
const door = (body, { imports = SERVICES, ctor = "private readonly orders: OrderService", params = "input: { orderId: string }" } = {}) => `${imports}
export class Door {
    constructor(${ctor}) {}

    async handle(${params}): Promise<unknown> {
        ${body}
    }
}`

const BUS = `import { CommandBus } from "@nestjs/cqrs"
import { OrderService } from "@modules/domain/order"
class PlaceOrderCommand { constructor(readonly orderId: string) {} }
`

const WEBHOOK_DOOR = (body) => `import { WebhookSignatureService } from "@modules/platform/http-security"
import { PaymentService } from "@modules/domain/payment"
export class Door {
    constructor(private readonly signature: WebhookSignatureService, private readonly payments: PaymentService) {}

    async receive(signature: string, body: object): Promise<void> {
        ${body}
    }
}`

test("every rule this law declares is exported under its published name", () => {
    for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("feature-thin: a feature file of a thin role maps parameters and makes one delegating call; every other shape is refused", () => {
    tester.run("feature-thin", featureThin, {
        valid: [
            // a handler delegates to its injected service once
            { filename: HANDLER, code: door("return this.orders.open(input.orderId)") },
            // a handler over the command bus: `execute` is the one delegating call and `new` is not a call
            {
                filename: HANDLER,
                code: `${BUS}export class Door {
    constructor(private readonly bus: CommandBus) {}

    handle(input: { orderId: string }): Promise<unknown> {
        return this.bus.execute(new PlaceOrderCommand(input.orderId))
    }
}`,
            },
            // a consumer hands the event payload to one domain service call
            { filename: CONSUMER, code: door("await this.orders.open(input.orderId)") },
            // a processor delegates to the injected runner
            { filename: PROCESSOR, code: door("await this.orders.open(input.orderId)") },
            // a step makes one service call
            { filename: STEP, code: door("await this.orders.open(input.orderId)") },
            // a job step records its fence through the JobClaims port (free) and makes one delegating call: the effect
            {
                filename: STEP,
                code: `import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { OrderService } from "@modules/domain/order"
export class Door {
    constructor(private readonly claims: JobClaims, private readonly orders: OrderService) {}

    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "expire" })
        await this.orders.open(job.jobId, this.claims.runKey(job, "expire"))
    }
}`,
            },
            // a compensation delegates once
            { filename: COMPENSATION, code: door("return this.orders.open(input.orderId)") },
            // a saga-step is a contract: constants only, no call at all
            {
                filename: SAGA_STEP,
                code: `export class ReserveOrderSagaStep {
    readonly name = "reserve-order"
    readonly event = "order.reserved"
}`,
            },
            // a resolver: one bus call plus a pure mapper call is still one delegating call
            {
                filename: RESOLVER,
                code: `import { CommandBus } from "@nestjs/cqrs"
import { toOrder } from "./place-order.mapper"
class GetOrder { constructor(readonly id: string) {} }
export class Door {
    constructor(private readonly bus: CommandBus) {}

    resolve(orderId: string): Promise<unknown> {
        return toOrder(this.bus.execute(new GetOrder(orderId)))
    }
}`,
            },
            // a mapper may map a collection item by item and write a date as text: shape conversions that decide nothing
            {
                filename: MAPPER,
                code: `export const toCart = (view: { items: Array<{ id: string }>; at: Date }) => ({ lines: view.items.map((item) => ({ id: item.id })), at: view.at.toISOString() })`,
            },
            // a cli group command shows its help through the command nest-commander gives it
            {
                filename: CLI,
                code: `export class Door {
    command = { help: () => undefined }

    async run(): Promise<void> {
        this.command.help()
    }
}`,
            },
            // a mapper maps properties and calls another mapper
            {
                filename: MAPPER,
                code: `import { toMoney } from "./money.mapper"
export const toOrder = (input: { id: string }) => ({ id: input.id, total: toMoney(input.id) })`,
            },
            // a webhook proves the signature (verify is free) and hands the delivery to one intake method
            { filename: WEBHOOK, code: WEBHOOK_DOOR(`this.signature.verify({ rawBody: body, signature })
        await this.payments.acceptNotification(body)`) },
            // a subscription: one hub call; the modules function sits in its arguments (parameter mapping)
            {
                filename: SUBSCRIPTION,
                code: `import { label } from "@modules/domain/order/order.pause.policy"
import { RealtimeHub } from "@modules/platform/realtime"
export class Door {
    constructor(private readonly hub: RealtimeHub) {}

    orderStatusChanged(principal: { id: string }, orderId: string): AsyncIterable<object> {
        return this.hub.subscribe(label(principal.id))
    }
}`,
            },
            // the same modules function extracted to a const stays parameter mapping
            {
                filename: SUBSCRIPTION,
                code: `import { label } from "@modules/domain/order/order.pause.policy"
import { RealtimeHub } from "@modules/platform/realtime"
export class Door {
    constructor(private readonly hub: RealtimeHub) {}

    orderStatusChanged(principal: { id: string }, orderId: string): AsyncIterable<object> {
        const topic = label(principal.id)
        return this.hub.subscribe(topic)
    }
}`,
            },
            // a logger call on the injected Logger is free beside the one delegating call
            {
                filename: HANDLER,
                code: `import type { Logger } from "@modules/platform/logging"
import { OrderService } from "@modules/domain/order"
export class Door {
    constructor(private readonly logger: Logger, private readonly orders: OrderService) {}

    handle(input: { orderId: string }): string {
        this.logger.info("order.opening")
        return this.orders.open(input.orderId)
    }
}`,
            },
            // optional chaining is not a branch
            { filename: HANDLER, code: door("return this.orders.open(input.order?.id)", { params: "input: { order?: { id: string } }" }) },
            // an awaited delegating call is still one call
            { filename: HANDLER, code: door("await this.orders.open(input.orderId)\n        return input.orderId") },
            // a cli command delegates once
            { filename: CLI, code: door("await this.orders.open(input.orderId)") },
            // a file outside the feature tier is never judged (its own laws apply)
            { filename: DOMAIN_SERVICE, code: `export class S { f(x: number): number { if (x > 0) return x + 1; for (;;) return x } }` },
            // a feature file whose role is not a thin role is never judged
            { filename: COMMAND, code: `export class PlaceOrderCommand { readonly total = 1 + 2 }` },
            // a spec file is never judged
            { filename: HANDLER_SPEC, code: `const x = 1 === 1 ? "a" : "b"\nif (x) throw new Error(x)` },
            // a declaration file is never judged
            { filename: DECLARATION_FILE, code: `export declare const x: number` },
        ],
        invalid: [
            // the shape conversions are a mapper's: any other call on a value is still refused there
            { filename: MAPPER, code: `export const toId = (input: { ids: Array<string> }) => ({ first: input.ids.reduce((a, b) => a + b, "") })`, errors: [{ messageId: "call" }, { messageId: "compute" }] },
            // the JobClaims fence is free only in a job step: a processor that calls it and a service is orchestrating
            {
                filename: PROCESSOR,
                code: `import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { OrderService } from "@modules/domain/order"
export class Door {
    constructor(private readonly claims: JobClaims, private readonly orders: OrderService) {}

    async process(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "expire" })
        await this.orders.open(job.kind)
    }
}`,
                errors: [{ messageId: "many" }],
            },
            // an `if`
            { filename: HANDLER, code: door(`if (input.orderId) return this.orders.open(input.orderId)
        return "none"`), errors: [{ messageId: "branch" }] },
            // a ternary
            { filename: HANDLER, code: door("return input.orderId ? this.orders.open(input.orderId) : \"none\""), errors: [{ messageId: "branch" }] },
            // `&&`, `||` and `??`
            { filename: HANDLER, code: door("const ok = input.orderId && input.name\n        return this.orders.open(input.orderId)"), errors: [{ messageId: "branch" }] },
            { filename: HANDLER, code: door("const id = input.orderId || \"none\"\n        return this.orders.open(id)"), errors: [{ messageId: "branch" }] },
            { filename: HANDLER, code: door("const id = input.orderId ?? \"none\"\n        return this.orders.open(id)"), errors: [{ messageId: "branch" }] },
            // loops and a `try`
            { filename: HANDLER, code: door("for (const id of input.ids) await this.orders.open(id)", { params: "input: { ids: string[] }" }), errors: [{ messageId: "branch" }] },
            { filename: HANDLER, code: door("while (input.more) { return \"x\" }", { params: "input: { more: boolean }" }), errors: [{ messageId: "branch" }] },
            { filename: HANDLER, code: door("try { return this.orders.open(input.orderId) } catch { return \"x\" }"), errors: [{ messageId: "branch" }] },
            // a `throw`
            { filename: HANDLER, code: door("throw new Error(\"bad\")"), errors: [{ messageId: "branch" }] },
            // computation: comparison, arithmetic, unary, update, assignment, `in`, template with an expression
            { filename: HANDLER, code: door("const same = input.orderId === \"x\"\n        return this.orders.open(input.orderId)"), errors: [{ messageId: "compute" }] },
            { filename: HANDLER, code: door("const n = input.a + input.b\n        return this.orders.open(input.orderId)", { params: "input: { a: number, b: number, orderId: string }" }), errors: [{ messageId: "compute" }] },
            { filename: HANDLER, code: door("const no = !input.ok\n        return this.orders.open(input.orderId)", { params: "input: { ok: boolean, orderId: string }" }), errors: [{ messageId: "compute" }] },
            { filename: HANDLER, code: door("input.n++", { params: "input: { n: number }" }), errors: [{ messageId: "compute" }] },
            { filename: HANDLER, code: door("input.orderId = \"x\""), errors: [{ messageId: "compute" }] },
            { filename: HANDLER, code: door("const has = \"id\" in input\n        return this.orders.open(input.orderId)"), errors: [{ messageId: "compute" }] },
            { filename: HANDLER, code: door("const t = `order:${input.orderId}`\n        return this.orders.open(t)"), errors: [{ messageId: "compute" }] },
            // two delegating calls: the second is orchestration, wherever it nests
            { filename: HANDLER, code: door("await this.orders.open(input.orderId)\n        await this.orders.open(input.orderId)"), errors: [{ messageId: "many" }] },
            {
                filename: HANDLER,
                code: `import { OrderService } from "@modules/domain/order"
class Runner { constructor(readonly f: () => unknown) {} }
export class Door {
    constructor(private readonly orders: OrderService, private readonly runner: Runner) {}

    async handle(input: { orderId: string }): Promise<unknown> {
        return this.runner.run(() => this.orders.open(input.orderId))
    }
}`,
                errors: [{ messageId: "many" }],
            },
            // a modules function is the delegating call when it IS the statement - two of them is orchestration
            {
                filename: HANDLER,
                code: `import { label } from "@modules/domain/order/order.pause.policy"
import { OrderService } from "@modules/domain/order"
export class Door {
    constructor(private readonly orders: OrderService) {}

    handle(input: { orderId: string }): string {
        label(input.orderId)
        return this.orders.open(input.orderId)
    }
}`,
                errors: [{ messageId: "many" }],
            },
            // calls a thin file does not make: a global, a conversion, a method on a plain value
            { filename: HANDLER, code: door("const parsed = JSON.parse(input.orderId)\n        return this.orders.open(parsed)"), errors: [{ messageId: "call" }] },
            { filename: HANDLER, code: door("const n = Number(input.orderId)\n        return this.orders.open(String(n))"), errors: [{ messageId: "call" }, { messageId: "call" }] },
            { filename: HANDLER, code: door("const names = input.ids.map((id) => id)\n        return this.orders.open(input.orderId)", { params: "input: { ids: string[], orderId: string }" }), errors: [{ messageId: "call" }] },
            // a call on a member that is not injected is a call like any other
            {
                filename: HANDLER,
                code: `import { OrderService } from "@modules/domain/order"
export class Door {
    constructor(private readonly orders: OrderService) {}

    private readonly helper = { go: (id: string) => id }

    handle(input: { orderId: string }): string {
        return this.helper.go(input.orderId)
    }
}`,
                errors: [{ messageId: "call" }],
            },
            // a function imported from another feature file is not a modules call
            {
                filename: HANDLER,
                code: `import { StartCheckoutHandler } from "@features/api/checkout/application/start-checkout.handler"
import { OrderService } from "@modules/domain/order"
export class Door {
    constructor(private readonly orders: OrderService) {}

    handle(input: { orderId: string }): string {
        StartCheckoutHandler(input.orderId)
        return this.orders.open(input.orderId)
    }
}`,
                errors: [{ messageId: "call" }],
            },
            // a mapper may not call a service: only `*.mapper.ts` calls and `new`
            {
                filename: MAPPER,
                code: `import { OrderService } from "@modules/domain/order"
export const toOrder = (orders: OrderService, input: { id: string }) => orders.open(input.id)`,
                errors: [{ messageId: "call" }],
            },
            // a webhook calls `verify` and one delegate - anything else is a call
            { filename: WEBHOOK, code: WEBHOOK_DOOR(`this.signature.verify({ rawBody: body, signature })
        const parsed = JSON.parse(JSON.stringify(body))
        await this.payments.acceptNotification(parsed)`), errors: [{ messageId: "call" }, { messageId: "call" }] },
        ],
    })
})

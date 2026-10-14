/** Typed edge cases shared by the webhook-shape and feature-thin handoff checks. */
import test from "node:test"
import { BE_DECLARATION, at, typedTester } from "./fixtures/typed/tester.mjs"
import { hfsOf } from "./lib/hfs.mjs"
import { isWebhookDomainServiceType } from "./lib/webhook-verifiers.mjs"
import { webhookForbiddenReferences, webhookIntakeDispatchesCommand } from "./lib/webhook-handoff.mjs"

const tester = typedTester({ declaration: { ...BE_DECLARATION, patterns: ["webhooks"] } })
const DOOR = at("src/features/webhooks/sepay/transport/http/sepay.webhook.ts")
const MODULE = at("src/features/webhooks/sepay/transport/http/sepay-http.module.ts")
const SURFACE = "@modules/domain/payment/payment-dispatch.surface"

/** Exercise the shared checks without repeating webhook route and acknowledgement assertions. */
const handoff = {
    meta: { type: "problem", schema: [], messages: { reference: "Forbidden webhook bus or feature handler import.", dispatch: "Webhook intake dispatches a command." } },
    create(context) {
        const hfs = hfsOf(context)
        return {
            "Program:exit"(program) {
                for (const node of webhookForbiddenReferences(context, hfs, program)) context.report({ node, messageId: "reference" })
            },
            CallExpression(node) {
                if (node.callee.type !== "MemberExpression") return
                if (isWebhookDomainServiceType(context, hfs, node.callee.object) && webhookIntakeDispatchesCommand(context, hfs, node)) context.report({ node, messageId: "dispatch" })
            },
        }
    },
}

const intake = (method, service = "PaymentDispatchService") => `import { ${service} } from "@modules/domain/payment/payment-dispatch.service"
export class Door {
    constructor(private readonly payments: ${service}) {}
    async receive(body: object): Promise<void> { await this.payments.${method}(body) }
}`

test("webhook handoff preserves package/feature origin across every import spelling", () => {
    tester.run("webhook-handoff-imports", handoff, {
        valid: [
            { filename: MODULE, code: 'import { EventBus } from "@nestjs/cqrs"; export type Events = EventBus' },
            { filename: DOOR, code: `import { LocalEvents } from "${SURFACE}"; export type Events = LocalEvents` },
            { filename: DOOR, code: 'class CommandBus { execute(value: object): object { return value } }; export const bus = new CommandBus()' },
            { filename: DOOR, code: intake("recordDelivery") },
        ],
        invalid: [
            { filename: DOOR, code: 'import { CommandBus as Dispatcher } from "@nestjs/cqrs"; export type Bus = Dispatcher', errors: [{ messageId: "reference" }] },
            { filename: MODULE, code: 'import type { QueryBus } from "@nestjs/cqrs"; export type Bus = QueryBus', errors: [{ messageId: "reference" }] },
            { filename: DOOR, code: 'import * as CQRS from "@nestjs/cqrs"; export type Bus = CQRS.CommandBus', errors: [{ messageId: "reference" }] },
            { filename: MODULE, code: 'import CQRS from "@nestjs/cqrs"; export const bus = CQRS.CommandBus', errors: [{ messageId: "reference" }] },
            { filename: MODULE, code: 'export { CommandBus as Dispatcher } from "@nestjs/cqrs"', errors: [{ messageId: "reference" }] },
            { filename: MODULE, code: 'export * from "@nestjs/cqrs"', errors: [{ messageId: "reference" }] },
            { filename: DOOR, code: 'export const cqrs = import("@nestjs/cqrs")', errors: [{ messageId: "reference" }] },
            { filename: DOOR, code: `export const intake = import("${SURFACE}")`, errors: [{ messageId: "reference" }] },
            { filename: DOOR, code: 'export const cqrs = require("@nestjs/cqrs")', errors: [{ messageId: "reference" }] },
            { filename: MODULE, code: 'import CQRS = require("@nestjs/cqrs"); export const bus = CQRS', errors: [{ messageId: "reference" }] },
            { filename: DOOR, code: 'export type Bus = import("@nestjs/cqrs").CommandBus', errors: [{ messageId: "reference" }] },
            { filename: DOOR, code: `import { DispatchBus as Bus } from "${SURFACE}"; export type Dispatcher = Bus`, errors: [{ messageId: "reference" }] },
            { filename: DOOR, code: `import { PaymentCommandHandler } from "${SURFACE}"; export type Handler = PaymentCommandHandler`, errors: [{ messageId: "reference" }] },
            { filename: MODULE, code: `import * as Intake from "${SURFACE}"; export const providers = Intake`, errors: [{ messageId: "reference" }] },
            { filename: MODULE, code: `import Intake from "${SURFACE}"; export const providers = Intake`, errors: [{ messageId: "reference" }] },
            { filename: DOOR, code: 'import { RecordSepayHandler } from "../../application/record-sepay.handler"; export const handler = RecordSepayHandler', errors: [{ messageId: "reference" }] },
            { filename: DOOR, code: 'import { ProviderDispatchBus } from "@modules/domain/payment/payment-dispatch.service"; export type Bus = ProviderDispatchBus', errors: [{ messageId: "reference" }] },
            { filename: MODULE, code: 'import type { ProviderQueryBus } from "@modules/domain/payment/payment-dispatch.service"; export type Bus = ProviderQueryBus', errors: [{ messageId: "reference" }] },
            { filename: MODULE, code: '/// <reference path="./provider-global.d.ts" />\nexport class ProviderHttpModule { constructor(private readonly bus: ProviderGlobalBus) {} }', errors: [{ messageId: "reference" }] },
            { filename: MODULE, code: '/// <reference path="./provider-global.d.ts" />\nimport { Inject } from "@nestjs/common"\nexport class ProviderHttpModule { @Inject("bus") private readonly bus!: ProviderGlobalBus }', errors: [{ messageId: "reference" }] },
        ],
    })
})

test("webhook handoff inspects the resolved called intake body, including aliases and implementation declarations", () => {
    tester.run("webhook-handoff-intake", handoff, {
        valid: [{ filename: DOOR, code: intake("recordDelivery") }],
        invalid: [
            ...["dispatchNotification", "dispatchQueryNotification", "dispatchAliasedNotification", "dispatchComputedNotification", "dispatchOverloadedNotification", "dispatchArrowNotification", "dispatchCallbackNotification"].map((method) => ({ filename: DOOR, code: intake(method), errors: [{ messageId: "dispatch" }] })),
            { filename: DOOR, code: intake("dispatchNotification", "InheritedPaymentDispatchService"), errors: [{ messageId: "dispatch" }] },
        ],
    })
})

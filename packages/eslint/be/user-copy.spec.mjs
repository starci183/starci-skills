import test from "node:test"
import { at, typedTester } from "./fixtures/typed/tester.mjs"
import { userCopyThroughCatalog } from "./user-copy.mjs"

const tester = typedTester()
const SERVICE = at("src/modules/domain/order/order.service.ts")
const SPEC = at("src/modules/domain/order/order.service.spec.ts")
const CONTROLLER = at("src/features/checkout/transport/http/order.controller.ts")
const RESOLVER = at("src/features/checkout/transport/graphql/order.resolver.ts")
const PRELUDE = [
    'import type { MailerClient } from "@modules/integrations/mailer/mailer.client"',
    'import type { EventBus } from "@modules/platform/event-bus/event-bus.port"',
    'import type { Sender } from "@modules/domain/order/lookalike.service"',
    "declare const mailer: MailerClient",
    "declare const publisher: EventBus",
    "declare const sender: Sender",
    "declare const messages: { get(key: string, params?: object): string }",
    "class PlanNotFoundError extends Error {}",
    "class Refusal extends PlanNotFoundError {}",
    "class NotAnException { constructor(readonly text: string) {} }",
    "class FakeError { constructor(readonly text: string) {} }",
].join("\n")
const withPrelude = (body) => `${PRELUDE}\n${body}`

test("exception, notification and response copy come from the messages catalog", () => {
    tester.run("user-copy-through-catalog", userCopyThroughCatalog, {
        valid: [
            // a key, not copy
            { filename: SERVICE, code: withPrelude("throw new PlanNotFoundError('PLAN_NOT_FOUND')") },
            { filename: SERVICE, code: withPrelude("throw new PlanNotFoundError('pending')") },
            // built through the catalog
            { filename: SERVICE, code: withPrelude("throw new PlanNotFoundError(messages.get('plan.notFound', { id }))") },
            // a built-in error used for an internal invariant
            { filename: SERVICE, code: withPrelude("throw new Error('unreachable: index out of range')\nthrow new TypeError('bad input here')") },
            // a class that is not an Error is not an exception, whatever it is called
            { filename: SERVICE, code: withPrelude("new FakeError('Plan not found for this account')\nnew NotAnException('Plan not found for this account')") },
            { filename: SERVICE, code: withPrelude("mailer.send({ subject: messages.get('plan.subject'), body: 'PLAN_BODY' })") },
            // a receiver that is not an outbound port is not judged, however its method is spelled
            { filename: SERVICE, code: withPrelude("sender.send({ subject: 'Your plan has changed', body: 'x' })\nconsole.log({ message: 'Plan updated' })") },
            { filename: CONTROLLER, code: withPrelude("const found = { message: messages.get('plan.updated') }") },
            { filename: CONTROLLER, code: withPrelude("const found = { code: 'OK' }") },
            // outside a transport slot a `message` property is data, not a response
            { filename: SERVICE, code: withPrelude("const row = { message: 'Plan updated successfully' }") },
        ],
        invalid: [
            { filename: SERVICE, code: withPrelude("throw new PlanNotFoundError('Plan not found for this account')"), errors: [{ messageId: "exception" }] },
            // a subclass of a subclass, and an error that does not end in Error
            { filename: SERVICE, code: withPrelude("throw new Refusal('Plan not found for this account')"), errors: [{ messageId: "exception" }] },
            { filename: SERVICE, code: withPrelude("class Halt extends Error {}\nthrow new Halt('Plan not found for this account')"), errors: [{ messageId: "exception" }] },
            // an outbound port under any method name
            { filename: SERVICE, code: withPrelude("mailer.send({ subject: 'Your plan has changed', templateId: 'plan-x' })"), errors: [{ messageId: "notification" }] },
            { filename: SERVICE, code: withPrelude("publisher.publish({ title: 'Your plan has changed', text: 'Please review the new terms' })"), errors: [{ messageId: "notification" }, { messageId: "notification" }] },
            // transport slots: http and graphql
            { filename: CONTROLLER, code: withPrelude("const found = { message: 'Plan updated successfully' }"), errors: [{ messageId: "response" }] },
            { filename: RESOLVER, code: withPrelude("const found = { description: 'The plan of this account' }"), errors: [{ messageId: "response" }] },
            // specs get the same law
            { filename: SPEC, code: withPrelude("throw new PlanNotFoundError('Plan not found')"), errors: [{ messageId: "exception" }] },
        ],
    })
})

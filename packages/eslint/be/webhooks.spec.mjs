/**
 * Twin tests for the webhook kind (R182 `BE_WEBHOOK_SHAPE`, R183 `BE_WEBHOOK_UNVERIFIED`).
 *
 *   node --test webhooks.spec.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { BE_DECLARATION, at, typedTester } from "./fixtures/typed/tester.mjs"
import { rules, webhookShape, webhookVerifyFirst } from "./webhooks.mjs"

const tester = typedTester({ declaration: { ...BE_DECLARATION, patterns: ["webhooks", "realtime"] } })
const DOOR = at("src/features/webhooks/payment/transport/http/payment.webhook.ts")
const OTHER_SLOT = at("src/features/plan/transport/http/payment.webhook.ts")
const SPEC = at("src/features/webhooks/payment/transport/http/payment.webhook.spec.ts")

const HEAD = `import { Body, Controller, Get, Headers, Post, Query } from "@nestjs/common"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { Public, PublicReason } from "@modules/domain/identity"
import { PaymentService } from "@modules/domain/payment"
import { WebhookSignatureService } from "@modules/platform/http-security"
`

const LOOKALIKE = `${HEAD}import { WebhookSignatureService as Lookalike } from "@modules/domain/payment/webhook-signature.service"
@Controller("w")
export class W {
    constructor(private readonly signature: Lookalike, private readonly payments: PaymentService) {}
    @Post()
    @Public({ reason: PublicReason.SignedWebhook })
    async receive(@Body() body: object): Promise<void> {
        this.signature.verify({ rawBody: body })
        await this.payments.acceptNotification(body)
    }
}`

const PROVEN = "this.signature.verify({ rawBody: body, signature })"

/** A webhook class with the given constructor and handler body, a signed webhook by default. */
const door = ({ ctor = "private readonly signature: WebhookSignatureService, private readonly payments: PaymentService", body, decorators = "@Post()\n    @Public({ reason: PublicReason.SignedWebhook })", extra = "", imports = "", returned = "void" } = {}) => `${HEAD}${imports}
@Controller("webhooks/payment")
export class PaymentWebhook {
    constructor(${ctor}) {}

    ${decorators}
    async receive(@Headers("x-signature") signature: string, @Body() body: object): Promise<${returned}> {
        ${body ?? `${PROVEN}\n        await this.payments.acceptNotification(body)`}
    }
    ${extra}
}`

const DOMAIN_IMPORTS = `import { PaymentWebhookVerifier as DeliveryProof, PaymentWebhookverify as LowercaseProof } from "@modules/domain/payment/payment-verifier.service"
`
const MODULE_IMPORT = `import "./payment-http.module"
`
const DOMAIN_PROVEN = "this.proof.assertDelivery({ body, signature })"
const ASYNC_DOMAIN_PROVEN = "await this.proof.verifyDelivery({ body, signature })"

/** An aliased domain verifier and an intake: recognition comes from its declared type and method symbol. */
const domainDoor = (options = {}) => door({
    imports: DOMAIN_IMPORTS,
    ctor: "private readonly proof: DeliveryProof, private readonly payments: PaymentService",
    body: `${DOMAIN_PROVEN}\n        await this.payments.acceptNotification(body)`,
    ...options,
})

/** Every payment provider has its own combined verifying intake; each resolves the class behind its local alias. */
const PROVIDER_DOORS = [
    ["casso", "acceptCasso"],
    ["payos", "acceptPayos"],
    ["sepay", "acceptSepay"],
    ["sepay-feed", "acceptSepayFeed"],
    ["vietcombank", "acceptVietcombank"],
].map(([provider, method]) => ({
    filename: at(`src/features/webhooks/${provider}/transport/http/${provider}.webhook.ts`),
    code: domainDoor({
        ctor: "private readonly proof: DeliveryProof",
        body: `await this.proof.${method}({ connectionId: "primary", body, signature })`,
    }),
}))

const DOMAIN_DOORS = [
    // The proof's method name is unconstrained; the imported alias and receiver do not end in Verifier.
    { filename: DOOR, code: domainDoor() },
    { filename: DOOR, code: domainDoor({ body: `${ASYNC_DOMAIN_PROVEN}\n        await this.payments.acceptNotification(body)` }) },
    { filename: DOOR, code: domainDoor({ body: "await this.proof.syncOrAsync({ body, signature })\n        await this.payments.acceptNotification(body)" }) },
    { filename: DOOR, code: domainDoor({ ctor: "private readonly proof: LowercaseProof, private readonly payments: PaymentService", body: "this.proof.confirm({ body, signature })\n        await this.payments.acceptNotification(body)" }) },
    // A module declaration names the resolved method, even when the injected service import is aliased.
    { filename: DOOR, code: door({ imports: `${MODULE_IMPORT}import { PaymentService as BillingIntake } from "@modules/domain/payment"\n`, ctor: "private readonly billing: BillingIntake", body: "await this.billing.acceptVerifiedNotification({ connectionId: 'primary', body, signature })" }) },
    // An explicitly declared verifier may also precede a separate ordinary intake.
    { filename: DOOR, code: door({ imports: MODULE_IMPORT, ctor: "private readonly payments: PaymentService", body: "await this.payments.acceptVerifiedNotification({ body, signature })\n        await this.payments.acceptNotification(body)" }) },
    ...PROVIDER_DOORS,
]

const INTAKE = `${PROVEN}\n        await this.payments.acceptNotification(body)`
const ACK = "export const PROVIDER_ACK = { success: true } as const\n"

/** Meta uses the same provider endpoint for a subscription proof and signed delivery intake. */
const metaDoor = ({ challenge = "const echo = this.proof.challenge(query)\n        return echo", imports = "", post = "this.proof.verifyDelivery(body)\n        await this.payments.acceptNotification(body)\n        return PROVIDER_ACK" } = {}) => door({
    imports: `import { MetaWebhookVerifier } from "@modules/domain/payment/meta-verifier.service"\n${ACK}${imports}`,
    ctor: "private readonly proof: MetaWebhookVerifier, private readonly payments: PaymentService",
    returned: "typeof PROVIDER_ACK",
    body: post,
    extra: `@Get()\n    @Public({ reason: PublicReason.SignedWebhook })\n    async challenge(@Query() query: object): Promise<string> {\n        ${challenge}\n    }`,
})

const ACK_DOORS = [
    { filename: DOOR, code: door({ imports: ACK, body: `${INTAKE}\n        return PROVIDER_ACK`, returned: "typeof PROVIDER_ACK" }) },
    { filename: DOOR, code: door({ imports: 'export const PROVIDER_ACK = "accepted" as const\n', body: `${INTAKE}\n        return PROVIDER_ACK`, returned: "typeof PROVIDER_ACK" }) },
    { filename: DOOR, code: door({ imports: "export const PROVIDER_ACK: { readonly success: true } = { success: true }\n", body: `${INTAKE}\n        return PROVIDER_ACK`, returned: "typeof PROVIDER_ACK" }) },
    { filename: DOOR, code: door({ imports: "export const PROVIDER_ACK: Readonly<{ success: true }> = { success: true }\n", body: `${INTAKE}\n        return PROVIDER_ACK`, returned: "typeof PROVIDER_ACK" }) },
    { filename: DOOR, code: door({ imports: 'export const PROVIDER_ACK: "accepted" = "accepted"\n', body: `${INTAKE}\n        return PROVIDER_ACK`, returned: "typeof PROVIDER_ACK" }) },
    { filename: DOOR, code: door({ imports: "const PROVIDER_ACK = { success: true } as const\nexport { PROVIDER_ACK }\n", body: `${INTAKE}\n        return PROVIDER_ACK`, returned: "typeof PROVIDER_ACK" }) },
    { filename: DOOR, code: door({ imports: 'import { PROVIDER_ACK as ACK_BODY } from "./payment.webhook.ack"\n', body: `${INTAKE}\n        return ACK_BODY`, returned: "typeof ACK_BODY" }) },
    { filename: DOOR, code: door({ imports: "export const PROVIDER_ACK = { success: true, details: { received: null, values: [1, 'fixed', false] } } as const\n", body: `${INTAKE}\n        return PROVIDER_ACK`, returned: "typeof PROVIDER_ACK" }) },
]

const CHALLENGE_DOORS = [
    { filename: DOOR, code: metaDoor() },
    { filename: DOOR, code: metaDoor({ challenge: "const echo = await this.proof.asyncChallenge(query)\n        return echo" }) },
    { filename: DOOR, code: metaDoor({ challenge: "const echo = await this.proof.syncOrAsyncChallenge(query)\n        return echo" }) },
    { filename: DOOR, code: metaDoor({ challenge: "return this.proof.challenge(query)" }) },
    { filename: DOOR, code: metaDoor({ challenge: "return await this.proof.asyncChallenge(query)" }) },
    { filename: at("src/features/webhooks/meta/transport/http/meta.webhook.ts"), code: metaDoor({
        imports: 'import "./meta-http.module"\nimport { MetaSubscriptionService } from "@modules/domain/payment/meta-verifier.service"\n',
        post: `${INTAKE}\n        return PROVIDER_ACK`,
    }).replace("private readonly proof: MetaWebhookVerifier", "private readonly signature: WebhookSignatureService, private readonly proof: MetaSubscriptionService") },
]

test("every rule this law declares is exported under its published name", () => {
    for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("webhook-shape: a signed door with a shared or domain proof and one intake passes, everything else is refused", () => {
    tester.run("webhook-shape", webhookShape, {
        valid: [
            { filename: DOOR, code: door() },
            // the proof may be awaited when it is async, and the intake takes any argument
            { filename: DOOR, code: door({ body: `await ${PROVEN}\n        await this.payments.acceptNotification({ body })` }) },
            ...DOMAIN_DOORS,
            ...ACK_DOORS,
            ...CHALLENGE_DOORS,
            // HTTP decorator identity survives both named and namespace aliases.
            { filename: DOOR, code: metaDoor().replace("Get,", "Get as Subscribe,").replace("@Get()", "@Subscribe()") },
            { filename: DOOR, code: metaDoor({ imports: 'import * as Nest from "@nestjs/common"\n' }).replace("@Get()", "@Nest.Get()").replace("@Post()", "@Nest.Post()") },
            // a file outside the webhook slot is not judged by this rule (its own door laws apply)
            { filename: OTHER_SLOT, code: door({ ctor: "private readonly payments: PaymentService", body: "await this.payments.acceptNotification(body)\n        await this.payments.refund('x')" }) },
            // a spec is not a door
            { filename: SPEC, code: "export const a = 1" },
        ],
        invalid: [
            // injection: a bus next to the two allowed values, a lookalike signature service of a domain owner
            { filename: DOOR, code: door({ ctor: "private readonly signature: WebhookSignatureService, private readonly payments: PaymentService, @InjectCommandBus() private readonly bus: object" }), errors: [{ messageId: "injects" }] },
            { filename: DOOR, code: LOOKALIKE, errors: [{ messageId: "intakeCalls" }] },
            // the handler makes no domain call, or two
            { filename: DOOR, code: door({ body: PROVEN }), errors: [{ messageId: "intakeCalls" }] },
            { filename: DOOR, code: door({ body: `${PROVEN}\n        await this.payments.acceptNotification(body)\n        await this.payments.refund('x')` }), errors: [{ messageId: "intakeCalls" }] },
            // A declared domain proof is free only as the first unconditional, completed call.
            { filename: DOOR, code: domainDoor({ body: `await this.payments.acceptNotification(body)\n        ${DOMAIN_PROVEN}` }), errors: [{ messageId: "intakeCalls" }] },
            { filename: DOOR, code: domainDoor({ body: `const received = body\n        ${DOMAIN_PROVEN}\n        await this.payments.acceptNotification(received)` }), errors: [{ messageId: "intakeCalls" }] },
            { filename: DOOR, code: domainDoor({ body: "this.proof.verifyDelivery({ body, signature })\n        await this.payments.acceptNotification(body)" }), errors: [{ messageId: "intakeCalls" }] },
            { filename: DOOR, code: domainDoor({ body: "this.proof.syncOrAsync({ body, signature })\n        await this.payments.acceptNotification(body)" }), errors: [{ messageId: "intakeCalls" }] },
            { filename: DOOR, code: domainDoor({ body: "await this.proof.verifyDelivery({ notification: await this.payments.acceptNotification(body), signature })\n        await this.payments.acceptNotification(body)" }), errors: [{ messageId: "intakeCalls" }] },
            { filename: DOOR, code: domainDoor({ body: "this.proof.assertDelivery(new Map())\n        await this.payments.acceptNotification(body)" }), errors: [{ messageId: "intakeCalls" }] },
            { filename: DOOR, code: domainDoor({ body: "this.proof?.assertDelivery({ body, signature })\n        await this.payments.acceptNotification(body)" }), errors: [{ messageId: "intakeCalls" }] },
            { filename: DOOR, code: domainDoor({ body: "this.proof['assertDelivery']({ body, signature })\n        await this.payments.acceptNotification(body)" }), errors: [{ messageId: "call" }] },
            // The optional proof does not permit two ordinary intakes after it.
            { filename: DOOR, code: domainDoor({ body: `${DOMAIN_PROVEN}\n        await this.payments.acceptNotification(body)\n        await this.payments.refund('x')` }), errors: [{ messageId: "intakeCalls" }] },
            // The module declaration is method-specific: a different PaymentService method is still ordinary intake.
            { filename: DOOR, code: door({ imports: MODULE_IMPORT, ctor: "private readonly payments: PaymentService", body: "await this.payments.refund('x')\n        await this.payments.acceptNotification(body)" }), errors: [{ messageId: "intakeCalls" }] },
            // a decision and a try in the door
            { filename: DOOR, code: door({ body: `${PROVEN}\n        if (signature) await this.payments.acceptNotification(body)` }), errors: [{ messageId: "branch" }] },
            { filename: DOOR, code: door({ body: `${PROVEN}\n        try { await this.payments.acceptNotification(body) } catch { return }` }), errors: [{ messageId: "branch" }] },
            // parsing in the door is another call
            { filename: DOOR, code: door({ body: `${PROVEN}\n        await this.payments.acceptNotification(JSON.parse(String(body)))` }), errors: [{ messageId: "call" }, { messageId: "call" }] },
            // the door returns domain data
            { filename: DOOR, code: door({ body: `${PROVEN}\n        return await this.payments.acceptNotification(body)` }), errors: [{ messageId: "returns" }] },
            // A literal return is fixed only when declared as this feature's typed, exported provider contract.
            { filename: DOOR, code: door({ body: `${INTAKE}\n        return { success: true }` }), errors: [{ messageId: "returns" }] },
            { filename: DOOR, code: door({ imports: ACK, body: `${INTAKE}\n        return 'accepted-' + signature` }), errors: [{ messageId: "returns" }] },
            { filename: DOOR, code: door({ imports: ACK, body: `${INTAKE}\n        return String(signature)` }), errors: [{ messageId: "returns" }, { messageId: "call" }] },
            { filename: DOOR, code: door({ imports: ACK, body: `${INTAKE}\n        return \`accepted-\${signature}\`` }), errors: [{ messageId: "returns" }] },
            { filename: DOOR, code: door({ imports: 'import { PROVIDER_ACK } from "../../../other/transport/http/other.webhook.ack"\n', body: `${INTAKE}\n        return PROVIDER_ACK` }), errors: [{ messageId: "returns" }] },
            { filename: DOOR, code: door({ imports: "const input = true\nexport const PROVIDER_ACK = { success: input } as const\n", body: `${INTAKE}\n        return PROVIDER_ACK` }), errors: [{ messageId: "returns" }] },
            { filename: DOOR, code: door({ imports: "const input = { success: true }\nexport const PROVIDER_ACK = { ...input } as const\n", body: `${INTAKE}\n        return PROVIDER_ACK` }), errors: [{ messageId: "returns" }] },
            { filename: DOOR, code: door({ imports: "export const PROVIDER_ACK = { success: true }\n", body: `${INTAKE}\n        return PROVIDER_ACK` }), errors: [{ messageId: "returns" }] },
            { filename: DOOR, code: door({ imports: "const PROVIDER_ACK = { success: true } as const\n", body: `${INTAKE}\n        return PROVIDER_ACK` }), errors: [{ messageId: "returns" }] },
            { filename: DOOR, code: door({ imports: "export const PROVIDER_ACK: {} = { success: true }\n", body: `${INTAKE}\n        return PROVIDER_ACK` }), errors: [{ messageId: "returns" }] },
            { filename: DOOR, code: door({ imports: "type Readonly<T> = T\nexport const PROVIDER_ACK: Readonly<{ success: true }> = { success: true }\n", body: `${INTAKE}\n        return PROVIDER_ACK` }), errors: [{ messageId: "returns" }] },
            { filename: DOOR, code: door({ imports: ACK, body: `${INTAKE}\n        const PROVIDER_ACK = body\n        return PROVIDER_ACK` }), errors: [{ messageId: "returns" }] },
            // GET returns only the verifier result; copied, replaced, missing or re-evaluated echoes fail.
            { filename: DOOR, code: metaDoor({ challenge: "const echo = this.proof.challenge(query)\n        return 'other'" }), errors: [{ messageId: "returns" }] },
            { filename: DOOR, code: metaDoor({ challenge: "const echo = this.proof.challenge(query)\n        return PROVIDER_ACK" }), errors: [{ messageId: "returns" }] },
            { filename: DOOR, code: metaDoor({ challenge: "const echo = this.proof.challenge(query)\n        return" }), errors: [{ messageId: "returns" }] },
            { filename: DOOR, code: metaDoor({ challenge: "const echo = this.proof.challenge(query)" }), errors: [{ messageId: "returns" }] },
            { filename: DOOR, code: metaDoor({ challenge: "const echo = this.proof.challenge(query)\n        const copy = echo\n        return copy" }), errors: [{ messageId: "returns" }] },
            { filename: DOOR, code: metaDoor({ challenge: "const echo = this.proof.challenge(query)\n        return this.proof.challenge(query)" }), errors: [{ messageId: "returns" }, { messageId: "call" }] },
            { filename: DOOR, code: metaDoor({ challenge: "return 'unverified'" }), errors: [{ messageId: "returns" }] },
            // Importing a bus into the door/module is forbidden, and a resolvable domain intake cannot dispatch either.
            { filename: DOOR, code: door({ imports: 'import { CommandBus } from "@nestjs/cqrs"\n' }), errors: [{ messageId: "handoff" }] },
            { filename: at("src/features/webhooks/unsafe/transport/http/unsafe-http.module.ts"), code: 'import { QueryBus } from "@nestjs/cqrs"\nexport const bus = QueryBus', errors: [{ messageId: "handoff" }] },
            { filename: DOOR, code: door({ imports: 'import { PaymentDispatchService } from "@modules/domain/payment/payment-dispatch.service"\n', ctor: "private readonly signature: WebhookSignatureService, private readonly payments: PaymentDispatchService", body: `${PROVEN}\n        await this.payments.dispatchNotification(body)` }), errors: [{ messageId: "handoff" }] },
            // Separate delivery and subscription proofs cannot conceal business command dispatch.
            { filename: DOOR, code: metaDoor({ post: "this.proof.dispatchingProof(body)\n        await this.payments.acceptNotification(body)\n        return PROVIDER_ACK" }), errors: [{ messageId: "handoff" }] },
            { filename: DOOR, code: metaDoor({ challenge: "return this.proof.dispatchingChallenge(query)" }), errors: [{ messageId: "handoff" }] },
            // not a signed webhook: another public reason, or none
            { filename: DOOR, code: door({ decorators: "@Post()\n    @Public({ reason: PublicReason.Health })" }), errors: [{ messageId: "notPublic" }] },
            { filename: DOOR, code: door({ decorators: "@Post()" }), errors: [{ messageId: "notPublic" }] },
            // route shape: a second route, and a door with no @Post
            { filename: DOOR, code: door({ extra: `@Post("b")\n    @Public({ reason: PublicReason.SignedWebhook })\n    async other(@Body() body: object): Promise<void> {\n        ${PROVEN}\n        await this.payments.acceptNotification(body)\n    }` }), errors: [{ messageId: "route" }] },
            { filename: DOOR, code: door({ extra: "@Get() firstChallenge(): string { return 'one' }\n@Get() secondChallenge(): string { return 'two' }" }), errors: [{ messageId: "route" }] },
            { filename: DOOR, code: `${HEAD}import { Get } from "@nestjs/common"
@Controller("w")
export class W {
    constructor(private readonly signature: WebhookSignatureService, private readonly payments: PaymentService) {}
    @Get()
    @Public({ reason: PublicReason.SignedWebhook })
    async receive(): Promise<void> {}
}`, errors: [{ messageId: "route" }] },
            // the file holds no door, or two
            { filename: DOOR, code: "export class NotADoor {}", errors: [{ messageId: "noDoor" }] },
            { filename: DOOR, code: `${door()}\n@Controller("second")\nexport class Second {}`, errors: [{ messageId: "noDoor" }] },
        ],
    })
})

test("webhook-verify-first: the first statement is an unconditional, completed shared or declared domain proof", () => {
    tester.run("webhook-verify-first", webhookVerifyFirst, {
        valid: [
            { filename: DOOR, code: door() },
            { filename: DOOR, code: door({ body: `await ${PROVEN}\n        await this.payments.acceptNotification(body)` }) },
            ...DOMAIN_DOORS,
            ...ACK_DOORS,
            ...CHALLENGE_DOORS,
            // outside the webhook slot nothing is judged
            { filename: OTHER_SLOT, code: door({ body: "await this.payments.acceptNotification(body)" }) },
        ],
        invalid: [
            // A fixed provider ACK cannot excuse work before the proof.
            { filename: DOOR, code: door({ imports: ACK, body: `await this.payments.acceptNotification(body)\n        ${PROVEN}\n        return PROVIDER_ACK` }), errors: [{ messageId: "first" }] },
            // Subscription verification must be the first completed domain proof and must produce an echo value.
            { filename: DOOR, code: metaDoor({ challenge: "return 'unverified'" }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: metaDoor({ challenge: "const echo = this.proof.asyncChallenge(query)\n        return echo" }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: metaDoor({ challenge: "const echo = this.proof.syncOrAsyncChallenge(query)\n        return echo" }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: metaDoor({ challenge: "const input = query\n        return this.proof.challenge(input)" }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: metaDoor({ challenge: "const echo = this.proof.challenge(JSON.parse('query'))\n        return echo" }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: metaDoor({ challenge: "return this.proof.voidChallenge(query)" }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: metaDoor({ challenge: "let echo = this.proof.challenge(query)\n        return echo" }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: metaDoor({ challenge: "return this.payments.acceptNotification(query)" }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: door({ body: `await this.payments.acceptNotification(body)\n        ${PROVEN}` }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: door({ body: `const received = body\n        ${PROVEN}\n        await this.payments.acceptNotification(received)` }), errors: [{ messageId: "first" }] },
            // No domain intake, data call or even a declaration may precede the domain proof.
            { filename: DOOR, code: domainDoor({ body: `await this.payments.acceptNotification(body)\n        ${DOMAIN_PROVEN}` }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: domainDoor({ body: `const received = body\n        ${DOMAIN_PROVEN}\n        await this.payments.acceptNotification(received)` }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: domainDoor({ body: `await this.payments.refund('x')\n        ${DOMAIN_PROVEN}\n        await this.payments.acceptNotification(body)` }), errors: [{ messageId: "first" }] },
            // Argument evaluation cannot touch data or execute work before the verifier itself runs.
            { filename: DOOR, code: domainDoor({ body: "await this.proof.verifyDelivery({ notification: await this.payments.acceptNotification(body), signature })" }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: domainDoor({ body: "this.proof.assertDelivery(new Map())\n        await this.payments.acceptNotification(body)" }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: domainDoor({ body: "this.proof.assertDelivery({ sequence: (body as { sequence: number }).sequence++ })\n        await this.payments.acceptNotification(body)" }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: domainDoor({ body: "this.proof.assertDelivery({ cleared: delete (body as { signature?: string }).signature })\n        await this.payments.acceptNotification(body)" }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: door({ body: "this.signature.verify({ rawBody: JSON.parse(String(body)), signature })\n        await this.payments.acceptNotification(body)" }), errors: [{ messageId: "first" }] },
            // a verify guarded by a condition is not unconditional
            { filename: DOOR, code: door({ body: `if (signature) ${PROVEN}\n        await this.payments.acceptNotification(body)` }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: domainDoor({ body: `if (signature) ${DOMAIN_PROVEN}\n        await this.payments.acceptNotification(body)` }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: domainDoor({ body: `signature && ${DOMAIN_PROVEN}\n        await this.payments.acceptNotification(body)` }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: domainDoor({ body: "this.proof?.assertDelivery({ body, signature })\n        await this.payments.acceptNotification(body)" }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: domainDoor({ body: "this.proof.assertDelivery?.({ body, signature })\n        await this.payments.acceptNotification(body)" }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: domainDoor({ body: "this.proof['assertDelivery']({ body, signature })\n        await this.payments.acceptNotification(body)" }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: door({ body: "this.signature?.verify({ rawBody: body, signature })\n        await this.payments.acceptNotification(body)" }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: door({ body: "this.signature['verify']({ rawBody: body, signature })\n        await this.payments.acceptNotification(body)" }), errors: [{ messageId: "first" }] },
            // A thenable proof must be awaited, including a return type that is only sometimes a promise.
            { filename: DOOR, code: domainDoor({ body: "this.proof.verifyDelivery({ body, signature })\n        await this.payments.acceptNotification(body)" }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: domainDoor({ body: "this.proof.syncOrAsync({ body, signature })\n        await this.payments.acceptNotification(body)" }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: domainDoor({ ctor: "private readonly proof: DeliveryProof", body: "this.proof.acceptCasso({ connectionId: 'primary', body, signature })" }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: door({ imports: MODULE_IMPORT, ctor: "private readonly payments: PaymentService", body: "this.payments.acceptVerifiedNotification({ body, signature })" }), errors: [{ messageId: "first" }] },
            // a lookalike signature service of a domain owner proves nothing
            { filename: DOOR, code: LOOKALIKE, errors: [{ messageId: "first" }] },
            // Aliases, local receiver names and local classes do not declare a domain verifier.
            { filename: DOOR, code: door({ imports: `import { PaymentService as PaymentVerifier } from "@modules/domain/payment"\n`, ctor: "private readonly verifier: PaymentVerifier", body: "await this.verifier.acceptNotification(body)" }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: door({ imports: "type PaymentVerifier = PaymentService\n", ctor: "private readonly verifier: PaymentVerifier", body: "await this.verifier.acceptNotification(body)" }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: door({ imports: `import type { PaymentVerifier } from "@modules/domain/payment/payment-verifier.service"\n`, ctor: "private readonly verifier: PaymentVerifier, private readonly payments: PaymentService", body: "await this.verifier.refund('x')\n        await this.payments.acceptNotification(body)" }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: door({ imports: `import { CacheService as PaymentVerifier } from "@modules/platform/cache/cache.service"\n`, ctor: "private readonly verifier: PaymentVerifier, private readonly payments: PaymentService", body: "this.verifier.get(signature)\n        await this.payments.acceptNotification(body)" }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: door({ imports: "class PaymentVerifier { assertDelivery(_delivery: object): void {} }\n", ctor: "private readonly verifier: PaymentVerifier, private readonly payments: PaymentService", body: "this.verifier.assertDelivery({ body, signature })\n        await this.payments.acceptNotification(body)" }), errors: [{ messageId: "first" }] },
            // Only the adjacent module's exact exported method reference declares a general service verifier.
            { filename: DOOR, code: door({ imports: MODULE_IMPORT, ctor: "private readonly payments: PaymentService", body: "await this.payments.refund('x')\n        await this.payments.acceptNotification(body)" }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: door({ imports: `import "./other-http.module"\n`, ctor: "private readonly payments: PaymentService", body: "await this.payments.refund('x')\n        await this.payments.acceptNotification(body)" }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: door({ imports: "export const webhookVerifiers = [PaymentService.prototype.refund] as const\n", ctor: "private readonly payments: PaymentService", body: "await this.payments.refund('x')\n        await this.payments.acceptNotification(body)" }), errors: [{ messageId: "first" }] },
            { filename: at("src/features/webhooks/other/transport/http/other.webhook.ts"), code: door({ imports: `import "../../../payment/transport/http/payment-http.module"\n`, ctor: "private readonly payments: PaymentService", body: "await this.payments.acceptVerifiedNotification(body)" }), errors: [{ messageId: "first" }] },
            { filename: DOOR, code: door({ body: "" }), errors: [{ messageId: "first" }] },
        ],
    })
})

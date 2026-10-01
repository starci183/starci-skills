/**
 * The SePay fake: the payment intent API of the todo example (`POST /userapi/transactions/qr`, `GET
 * /userapi/transactions/details/{id}`, Bearer api key) and the webhook delivered to the app, in one of two styles:
 *
 * - `webhookStyle: "intent"` (default, what the todo integration reads): body `{ id, status, periodEnd }` and header
 *   `Authorization: Bearer <webhookSecret>`.
 * - `webhookStyle: "transaction"` (SePay's documented bank-transfer webhook): body `{ id, gateway, transactionDate,
 *   accountNumber, code, content, transferType: "in", transferAmount, accumulated, subAccount, referenceCode, description }`
 *   and header `Authorization: Apikey <webhookSecret>`; `code` is the payment code (the reference of the intent). SePay only
 *   reports money received, so a failure has no webhook in this style: `fail` and a failed `settle` answer `null`.
 *
 * Both styles also carry `x-sepay-signature: sha256=<hmac of the exact body>` (an extension, see `signature.ts`). In
 * transaction style a spec may settle a reference the app never created through the API: pass `amount` to `settle`.
 */
import type { FakeBridge, FakeClient, WebhookDelivery } from "../../framework/contracts"
import { FakeControlRejected } from "../../framework/failures"
import { defineHttpFake } from "../../framework/http-fake"
import type { FakeHttpReply, FakeHttpRequest, HttpFakeContext } from "../../framework/http-fake"
import { DeliveryBook, appUrl, controlNumber, controlRecord, controlString, normalizePath, paymentClient, secretFor } from "../payment-kit"
import type { PaymentClient } from "../payment-kit"
import { SEPAY_ERROR_BAD_REQUEST, SEPAY_ERROR_NOT_FOUND, SEPAY_ERROR_UNAUTHORIZED } from "./fixtures"
import type { DelayedSettleParams, SepayIntent, SettleParams } from "./payloads"
import { sepayCreateResponse, sepayIntentWebhook, sepayTransactionPending, sepayTransactionSettled, sepayTransactionWebhook } from "./payloads"
import { sepayApiKeyHeader, sepayBearerHeader, sepayBodySignature, sepayVerifyApiKey, sepayVerifyBearer } from "./signature"

export * from "./fixtures"
export * from "./payloads"
export * from "./signature"

const CREATE_INTENT_PATH = "/userapi/transactions/qr"
const TRANSACTION_PATH = "/userapi/transactions/details/"
const DEFAULT_WEBHOOK_PATH = "/webhooks/sepay"
const DEFAULT_PERIOD_MS = 30 * 86_400_000

/** What `sepayFake` is declared with. */
export interface SepayOptions {
    /** The API key the app authenticates its calls with (default: random, `values.apiKey`). */
    readonly apiKey?: string
    /** The secret the fake signs its webhook with (default: random, `values.webhookSecret`). */
    readonly webhookSecret?: string
    /** Where the app receives the webhook (default `/webhooks/sepay`). */
    readonly webhookPath?: string
    /** The body and header style of the webhook (default `"intent"`). */
    readonly webhookStyle?: "intent" | "transaction"
}

/** Settles a transaction by the reference the app sent instead of the id the fake handed out. */
export interface SepayReferenceSettle {
    readonly reference: string
    /** Default `paid`. */
    readonly status?: "paid" | "failed"
    /** The end of the paid period (intent style), ISO 8601; thirty days ahead when absent. */
    readonly periodEnd?: string
    /** The transferred amount, for a reference the app never created (transaction style). */
    readonly amount?: number
}

/** A settle, by the fake's id (the todo shape) or by reference. */
export type SepaySettleInput = SettleParams | SepayReferenceSettle
/** A settle delivered after `delayMs`. */
export type SepayDelayInput = (DelayedSettleParams | (SepayReferenceSettle & { readonly delayMs: number }))
/** What `fail` takes. */
export interface SepayFailParams {
    /** The reference or the id the fake handed out. */
    readonly reference: string
}

/** The handle of the fake. `settle` and `fail` answer null when the style has no webhook for the outcome. */
export interface SepayClient extends FakeClient {
    /** What the app created at the gateway, with what the gateway now reports. */
    intents(): Promise<ReadonlyArray<SepayIntent>>
    /** The webhooks delivered and what the app answered. */
    deliveries(): Promise<ReadonlyArray<WebhookDelivery>>
    /** Sets what the gateway reports and delivers the webhook now. */
    settle(params: SepaySettleInput): Promise<WebhookDelivery | null>
    /** The transaction failed at the gateway (intent style delivers `status: "failed"`). */
    fail(params: SepayFailParams): Promise<WebhookDelivery | null>
    /** Settles now, delivers the webhook after `delayMs`. */
    delayWebhook(params: SepayDelayInput): Promise<void>
    /** Sends the last webhook of an id or reference again, byte for byte. */
    replayWebhook(reference: string): Promise<WebhookDelivery>
}

type Base = PaymentClient<SepayIntent, SepaySettleInput, SepayFailParams, SepayDelayInput>

interface StoredIntent extends SepayIntent {
    /** A per-intent number for the transaction style `id`. */
    readonly number: number
}

interface SepayState {
    readonly intents: Map<string, StoredIntent>
    readonly book: DeliveryBook
    sequence: number
}

type Context = HttpFakeContext<SepayState, SepayOptions | undefined>

const apiKeyOf = (context: Context): string => context.options?.apiKey ?? context.secret("sepay-api-key")
const webhookSecretOf = (context: Context): string => context.options?.webhookSecret ?? context.secret("sepay-webhook-secret")
const webhookPathOf = (context: Context): string => normalizePath(context.options?.webhookPath ?? DEFAULT_WEBHOOK_PATH)
const styleOf = (context: Context): "intent" | "transaction" => context.options?.webhookStyle ?? "intent"

const publicIntent = (intent: StoredIntent): SepayIntent => ({
    gatewayIntentId: intent.gatewayIntentId,
    reference: intent.reference,
    amount: intent.amount,
    currency: intent.currency,
    checkoutUrl: intent.checkoutUrl,
    status: intent.status,
    periodEnd: intent.periodEnd,
})

/** The delivery reference: the reference of the app when there is one, else the id of the fake. */
const referenceOf = (intent: SepayIntent): string => (intent.reference === "" ? intent.gatewayIntentId : intent.reference)

const authorized = (request: FakeHttpRequest, context: Context): boolean => {
    const header = request.headers["authorization"]
    return sepayVerifyBearer(header, apiKeyOf(context)) || sepayVerifyApiKey(header, apiKeyOf(context))
}

const createIntent = (request: FakeHttpRequest, context: Context): FakeHttpReply => {
    const parsed = request.json()
    const body = typeof parsed === "object" && parsed !== null ? (parsed as Readonly<Record<string, unknown>>) : {}
    const { reference, amount, currency } = body
    if (typeof reference !== "string" || reference === "" || typeof amount !== "number" || typeof currency !== "string") {
        return { status: 400, body: SEPAY_ERROR_BAD_REQUEST }
    }
    context.state.sequence += 1
    const gatewayIntentId = `fake-sepay-${String(context.state.sequence).padStart(6, "0")}`
    const checkoutUrl = `${context.url}/checkout/${gatewayIntentId}`
    context.state.intents.set(gatewayIntentId, {
        gatewayIntentId,
        reference,
        amount,
        currency,
        checkoutUrl,
        status: "pending",
        periodEnd: null,
        number: context.state.sequence,
    })
    return { body: sepayCreateResponse(gatewayIntentId, checkoutUrl) }
}

const readTransaction = (request: FakeHttpRequest, context: Context): FakeHttpReply => {
    const id = decodeURIComponent(request.pathname.slice(TRANSACTION_PATH.length))
    const intent = context.state.intents.get(id)
    if (intent === undefined) return { status: 404, body: SEPAY_ERROR_NOT_FOUND }
    if (intent.status === "pending") return { body: sepayTransactionPending(id) }
    return { body: sepayTransactionSettled(id, intent.status, intent.periodEnd ?? "") }
}

const guarded =
    (handle: (request: FakeHttpRequest, context: Context) => FakeHttpReply) =>
    (request: FakeHttpRequest, context: Context): FakeHttpReply =>
        authorized(request, context) ? handle(request, context) : { status: 401, body: SEPAY_ERROR_UNAUTHORIZED }

/** Finds the intent by the id the fake handed out or by the reference of the app. */
const findIntent = (context: Context, key: string): StoredIntent | undefined =>
    context.state.intents.get(key) ?? [...context.state.intents.values()].find((intent) => intent.reference === key)

interface SettleRequest {
    readonly key: string
    readonly status: "paid" | "failed"
    readonly periodEnd?: string
    readonly amount?: number
    readonly deliverTo: string
}

const settleRequest = (body: unknown, action: string, defaultStatus: "paid" | "failed"): SettleRequest => {
    const input = controlRecord(body, action)
    const gatewayIntentId = input["gatewayIntentId"]
    const reference = input["reference"]
    const key = typeof gatewayIntentId === "string" && gatewayIntentId !== "" ? gatewayIntentId : typeof reference === "string" && reference !== "" ? reference : ""
    if (key === "") throw new FakeControlRejected(400, `${action} needs "gatewayIntentId" or "reference"`)
    return {
        key,
        status: input["status"] === "failed" ? "failed" : input["status"] === "paid" ? "paid" : defaultStatus,
        periodEnd: typeof input["periodEnd"] === "string" ? input["periodEnd"] : undefined,
        amount: typeof input["amount"] === "number" ? input["amount"] : undefined,
        deliverTo: controlString(input, "deliverTo", action),
    }
}

/** Sets what the gateway reports; creates the intent when the fake never saw it (the old todo behaviour, and transaction style). */
const applySettle = (context: Context, request: SettleRequest): StoredIntent => {
    const existing = findIntent(context, request.key)
    const periodEnd = request.periodEnd ?? new Date(context.start.now().getTime() + DEFAULT_PERIOD_MS).toISOString()
    if (existing === undefined) context.state.sequence += 1
    const settled: StoredIntent = {
        gatewayIntentId: existing?.gatewayIntentId ?? request.key,
        reference: existing?.reference ?? (styleOf(context) === "transaction" ? request.key : ""),
        amount: existing?.amount ?? request.amount ?? 0,
        currency: existing?.currency ?? "VND",
        checkoutUrl: existing?.checkoutUrl ?? "",
        status: request.status,
        periodEnd,
        number: existing?.number ?? context.state.sequence,
    }
    context.state.intents.set(settled.gatewayIntentId, settled)
    return settled
}

/** Delivers the webhook of a settled intent; null in transaction style when the outcome is a failure. */
const sendWebhook = async (context: Context, intent: StoredIntent, deliverTo: string): Promise<WebhookDelivery | null> => {
    const style = styleOf(context)
    if (style === "transaction" && intent.status !== "paid") return null
    const bad = context.takeBadSignature()
    const secret = secretFor(webhookSecretOf(context), bad)
    const body =
        style === "intent"
            ? JSON.stringify(sepayIntentWebhook(intent.gatewayIntentId, intent.status === "paid" ? "paid" : "failed", intent.periodEnd ?? ""))
            : JSON.stringify(
                  sepayTransactionWebhook({
                      id: intent.number,
                      code: referenceOf(intent),
                      amount: intent.amount,
                      transactionDate: context.start.now().toISOString().slice(0, 19).replace("T", " "),
                  }),
              )
    return context.state.book.deliver({
        reference: referenceOf(intent),
        method: "POST",
        url: appUrl(deliverTo, webhookPathOf(context)),
        body,
        headers: {
            "content-type": "application/json",
            authorization: style === "intent" ? sepayBearerHeader(secret) : sepayApiKeyHeader(secret),
            "x-sepay-signature": sepayBodySignature(body, secret),
        },
    })
}

/** The SePay fake; `sepayFake(options)` is what a `test-world.config.ts` declares. */
export const sepayFake = defineHttpFake<SepayClient, SepayOptions | undefined, SepayState>({
    state: () => ({ intents: new Map(), book: new DeliveryBook(), sequence: 0 }),
    values: (context) => ({
        baseUrl: context.url,
        apiKey: apiKeyOf(context),
        webhookSecret: webhookSecretOf(context),
    }),
    endpoints: (context) => ({ createIntentUrl: `${context.url}${CREATE_INTENT_PATH}` }),
    failureBody: () => ({ error: "server_error", message: "injected failure" }),
    routes: [
        { method: "POST", path: CREATE_INTENT_PATH, handle: guarded(createIntent) },
        { method: "GET", path: `${TRANSACTION_PATH}*`, handle: guarded(readTransaction) },
    ],
    handle: (request, context) =>
        authorized(request, context) ? { status: 404, body: SEPAY_ERROR_NOT_FOUND } : { status: 401, body: SEPAY_ERROR_UNAUTHORIZED },
    controlActions: {
        intents: (_body, context) => [...context.state.intents.values()].map(publicIntent),
        deliveries: (_body, context) => context.state.book.all(),
        settle: (body, context) => {
            const request = settleRequest(body, "settle", "paid")
            return sendWebhook(context, applySettle(context, request), request.deliverTo)
        },
        fail: (body, context) => {
            const request = settleRequest(body, "fail", "failed")
            return sendWebhook(context, applySettle(context, { ...request, status: "failed" }), request.deliverTo)
        },
        "delay-webhook": (body, context) => {
            const request = settleRequest(body, "delay-webhook", "paid")
            const delayMs = controlNumber(controlRecord(body, "delay-webhook"), "delayMs", "delay-webhook")
            const intent = applySettle(context, request)
            context.schedule(delayMs, () => sendWebhook(context, intent, request.deliverTo))
            return { scheduled: true }
        },
        "replay-webhook": async (body, context) => {
            const key = controlString(controlRecord(body, "replay-webhook"), "reference", "replay-webhook")
            const intent = findIntent(context, key)
            const delivery = (await context.state.book.replay(intent === undefined ? key : referenceOf(intent))) ?? (await context.state.book.replay(key))
            if (delivery === null) throw new FakeControlRejected(404, `nothing was delivered for "${key}"`)
            return delivery
        },
    },
    client: (bridge: FakeBridge, base: FakeClient): SepayClient => {
        const shared: Base = paymentClient(bridge, base)
        return {
            ...shared,
            settle: (params) => bridge.call("settle", { ...params, deliverTo: bridge.webhookTarget() }),
            fail: (params) => bridge.call("fail", { ...params, deliverTo: bridge.webhookTarget() }),
        }
    },
})

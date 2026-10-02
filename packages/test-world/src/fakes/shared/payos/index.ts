/**
 * The payOS v2 fake: `POST /v2/payment-requests` (client id, api key and body signature verified), `GET
 * /v2/payment-requests/{id}` (orderCode or paymentLinkId), `POST /v2/payment-requests/{id}/cancel`, `POST /confirm-webhook`
 * and the webhook (a signed POST of the transaction to the app). The real signature scheme lives in `signature.ts`.
 *
 * Auth failures are HTTP 401; business errors (bad signature, duplicate order code, not found) are HTTP 200 with a non-"00"
 * `code` in the envelope, as payOS answers. The webhook goes to `bridge.webhookTarget()` + `webhookPath`, whatever url was
 * sent to `/confirm-webhook` (which is answered and recorded only). payOS itself sends webhooks for paid transactions; the
 * `fail` webhook (`success: false`) is a test-only extension so a consumer's failure branch can be exercised.
 */
import { createHash } from "node:crypto"
import type { FakeBridge, FakeClient } from "../../framework/contracts"
import { FakeControlRejected } from "../../framework/failures"
import { defineHttpFake } from "../../framework/http-fake"
import type { FakeHttpReply, FakeHttpRequest, HttpFakeContext } from "../../framework/http-fake"
import { DeliveryBook, appUrl, controlNumber, controlRecord, controlString, normalizePath, paymentClient, secretFor } from "../payment-kit"
import type { PaymentClient, PaymentWebhookOptions } from "../payment-kit"
import {
    PAYOS_ERROR_BAD_REQUEST,
    PAYOS_ERROR_INVALID_SIGNATURE,
    PAYOS_ERROR_NOT_CANCELLABLE,
    PAYOS_ERROR_NOT_FOUND,
    PAYOS_ERROR_ORDER_EXISTS,
    PAYOS_ERROR_UNAUTHORIZED,
} from "./fixtures"
import type { PayosStatus } from "./fixtures"
import { payosEnvelope, payosGetData, payosPaymentData, payosWebhookBody } from "./payloads"
import { payosVerifyCreate } from "./signature"

export * from "./fixtures"
export * from "./payloads"
export * from "./signature"

/** What `payosFake` is declared with. */
export interface PayosOptions extends PaymentWebhookOptions {
    /** `x-client-id` the app sends (default: random, `values.clientId`). */
    readonly clientId?: string
    /** `x-api-key` the app sends (default: random, `values.apiKey`). */
    readonly apiKey?: string
    /** The checksum key the signatures use (default: random, `values.checksumKey`). */
    readonly checksumKey?: string
    /** Where the app receives the webhook (default `/payment/payos/webhook`). */
    readonly webhookPath?: string
}

/** A payment request the app created, as `intents()` shows it. */
export interface PayosIntent {
    /** The `orderCode`, as text. */
    readonly reference: string
    readonly orderCode: number
    readonly paymentLinkId: string
    readonly amount: number
    readonly description: string
    readonly returnUrl: string
    readonly cancelUrl: string
    readonly checkoutUrl: string
    readonly status: PayosStatus
    /** The bank reference of the transaction once paid. */
    readonly transactionReference: string | null
    readonly createdAt: string
}

/** What settling takes. */
export interface PayosSettleParams {
    /** The `orderCode` (number or text) or the `paymentLinkId`. */
    readonly reference: string
}

/** What failing takes. */
export interface PayosFailParams {
    readonly reference: string
    /** `data.code` of the failure webhook (default `01`). */
    readonly code?: string
}

/** Settle now, deliver the webhook after `delayMs`. */
export interface PayosDelayParams extends PayosSettleParams {
    readonly delayMs: number
}

/** The handle of the fake. */
export type PayosClient = PaymentClient<PayosIntent, PayosSettleParams, PayosFailParams, PayosDelayParams>

interface PayosOrder {
    readonly orderCode: number
    readonly paymentLinkId: string
    readonly amount: number
    readonly description: string
    readonly returnUrl: string
    readonly cancelUrl: string
    readonly checkoutUrl: string
    readonly createdAt: string
    status: PayosStatus
    transactionReference: string | null
    transactionDateTime: string | null
}

interface PayosState {
    readonly orders: Map<number, PayosOrder>
    readonly book: DeliveryBook
    sequence: number
}

type Context = HttpFakeContext<PayosState, PayosOptions | undefined>

const DEFAULT_WEBHOOK_PATH = "/payment/payos/webhook"
const CREATE_PATH = "/v2/payment-requests"
const CONFIRM_PATH = "/confirm-webhook"

const clientIdOf = (context: Context): string => context.options?.clientId ?? context.secret("payos-client-id")
const apiKeyOf = (context: Context): string => context.options?.apiKey ?? context.secret("payos-api-key")
const checksumKeyOf = (context: Context): string => context.options?.checksumKey ?? context.secret("payos-checksum-key")
const webhookPathOf = (context: Context): string => normalizePath(context.options?.webhookPath ?? DEFAULT_WEBHOOK_PATH)

const intentOf = (order: PayosOrder): PayosIntent => ({
    reference: String(order.orderCode),
    orderCode: order.orderCode,
    paymentLinkId: order.paymentLinkId,
    amount: order.amount,
    description: order.description,
    returnUrl: order.returnUrl,
    cancelUrl: order.cancelUrl,
    checkoutUrl: order.checkoutUrl,
    status: order.status,
    transactionReference: order.transactionReference,
    createdAt: order.createdAt,
})

const unauthorized = (request: FakeHttpRequest, context: Context): FakeHttpReply | null =>
    request.headers["x-client-id"] === clientIdOf(context) && request.headers["x-api-key"] === apiKeyOf(context)
        ? null
        : { status: 401, body: PAYOS_ERROR_UNAUTHORIZED }

/** The order named by an orderCode or a paymentLinkId. */
const lookup = (context: Context, id: string): PayosOrder | undefined => {
    if (/^\d+$/.test(id)) {
        const byCode = context.state.orders.get(Number(id))
        if (byCode !== undefined) return byCode
    }
    return [...context.state.orders.values()].find((order) => order.paymentLinkId === id)
}

const dataOf = (order: PayosOrder): ReturnType<typeof payosGetData> =>
    payosGetData({
        orderCode: order.orderCode,
        amount: order.amount,
        description: order.description,
        paymentLinkId: order.paymentLinkId,
        checkoutUrl: order.checkoutUrl,
        status: order.status,
        createdAt: order.createdAt,
        reference: order.transactionReference ?? undefined,
        transactionDateTime: order.transactionDateTime ?? undefined,
    })

const create = (request: FakeHttpRequest, context: Context): FakeHttpReply => {
    const denied = unauthorized(request, context)
    if (denied !== null) return denied
    const parsed = request.json()
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return { body: PAYOS_ERROR_BAD_REQUEST }
    const body = parsed as Readonly<Record<string, unknown>>
    const { orderCode, amount, description, cancelUrl, returnUrl, signature } = body
    if (
        typeof orderCode !== "number" ||
        !Number.isSafeInteger(orderCode) ||
        orderCode < 1 ||
        typeof amount !== "number" ||
        !Number.isInteger(amount) ||
        amount < 1 ||
        typeof description !== "string" ||
        typeof cancelUrl !== "string" ||
        typeof returnUrl !== "string" ||
        typeof signature !== "string"
    ) {
        return { body: PAYOS_ERROR_BAD_REQUEST }
    }
    if (!payosVerifyCreate({ orderCode, amount, description, cancelUrl, returnUrl }, signature, checksumKeyOf(context))) {
        return { body: PAYOS_ERROR_INVALID_SIGNATURE }
    }
    if (context.state.orders.has(orderCode)) return { body: PAYOS_ERROR_ORDER_EXISTS }
    const paymentLinkId = createHash("sha256").update(`${context.start.runId}:${orderCode}`).digest("hex").slice(0, 32)
    const checkoutUrl = `${context.url}/web/${paymentLinkId}`
    context.state.orders.set(orderCode, {
        orderCode,
        paymentLinkId,
        amount,
        description,
        returnUrl,
        cancelUrl,
        checkoutUrl,
        createdAt: context.start.now().toISOString(),
        status: "PENDING",
        transactionReference: null,
        transactionDateTime: null,
    })
    return { body: payosEnvelope(payosPaymentData({ orderCode, amount, description, paymentLinkId, checkoutUrl, status: "PENDING" }), checksumKeyOf(context)) }
}

const read = (request: FakeHttpRequest, context: Context): FakeHttpReply => {
    const denied = unauthorized(request, context)
    if (denied !== null) return denied
    const order = lookup(context, request.params["id"] ?? "")
    return order === undefined ? { body: PAYOS_ERROR_NOT_FOUND } : { body: payosEnvelope(dataOf(order), checksumKeyOf(context)) }
}

const cancel = (request: FakeHttpRequest, context: Context): FakeHttpReply => {
    const denied = unauthorized(request, context)
    if (denied !== null) return denied
    const order = lookup(context, request.params["id"] ?? "")
    if (order === undefined) return { body: PAYOS_ERROR_NOT_FOUND }
    if (order.status === "PAID") return { body: PAYOS_ERROR_NOT_CANCELLABLE }
    order.status = "CANCELLED"
    return { body: payosEnvelope(dataOf(order), checksumKeyOf(context)) }
}

const confirmWebhook = (request: FakeHttpRequest, context: Context): FakeHttpReply => {
    const denied = unauthorized(request, context)
    if (denied !== null) return denied
    const parsed = request.json()
    const webhookUrl = typeof parsed === "object" && parsed !== null ? (parsed as Readonly<Record<string, unknown>>)["webhookUrl"] : undefined
    if (typeof webhookUrl !== "string" || webhookUrl === "") return { body: PAYOS_ERROR_BAD_REQUEST }
    return {
        body: payosEnvelope(
            { webhookUrl, accountNumber: "0123456789", accountName: "CONG TY TEST", name: "Fake payOS channel", shortName: "FAKE" },
            checksumKeyOf(context),
        ),
    }
}

const findOrder = (context: Context, reference: string): PayosOrder => {
    const order = lookup(context, reference)
    if (order === undefined) throw new FakeControlRejected(404, `no payment request "${reference}" was created at the fake`)
    return order
}

const payosTime = (date: Date): string => {
    const shifted = new Date(date.getTime() + 7 * 3_600_000)
    return shifted.toISOString().slice(0, 19).replace("T", " ")
}

const sendWebhook = (context: Context, order: PayosOrder, deliverTo: string, dataCode: string | undefined) => {
    const bad = context.takeBadSignature()
    const body = payosWebhookBody(
        {
            orderCode: order.orderCode,
            amount: order.amount,
            description: order.description,
            paymentLinkId: order.paymentLinkId,
            reference: order.transactionReference ?? `TF${String(order.orderCode).padStart(10, "0")}`,
            transactionDateTime: order.transactionDateTime ?? payosTime(context.start.now()),
            dataCode,
        },
        secretFor(checksumKeyOf(context), bad),
    )
    return context.state.book.deliver({
        reference: String(order.orderCode),
        method: "POST",
        url: appUrl(deliverTo, webhookPathOf(context)),
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
    })
}

const markPaid = (context: Context, order: PayosOrder): void => {
    context.state.sequence += 1
    order.status = "PAID"
    order.transactionReference = `TF${String(context.state.sequence).padStart(10, "0")}`
    order.transactionDateTime = payosTime(context.start.now())
}

/** The payOS fake; `payosFake(options)` is what a `test-world.config.ts` declares. */
export const payosFake = defineHttpFake<PayosClient, PayosOptions | undefined, PayosState>({
    state: () => ({ orders: new Map(), book: new DeliveryBook(), sequence: 0 }),
    values: (context) => ({
        clientId: clientIdOf(context),
        apiKey: apiKeyOf(context),
        checksumKey: checksumKeyOf(context),
        baseUrl: context.url,
    }),
    endpoints: (context) => ({ createUrl: `${context.url}${CREATE_PATH}`, confirmWebhookUrl: `${context.url}${CONFIRM_PATH}` }),
    failureBody: (status) => ({ code: String(status), desc: "injected failure", data: null, signature: null }),
    routes: [
        { method: "POST", path: CREATE_PATH, handle: create },
        { method: "GET", path: `${CREATE_PATH}/:id`, handle: read },
        { method: "POST", path: `${CREATE_PATH}/:id/cancel`, handle: cancel },
        { method: "POST", path: CONFIRM_PATH, handle: confirmWebhook },
    ],
    handle: (request) => ({ status: 404, body: { code: "404", desc: `no route for ${request.method} ${request.pathname}`, data: null, signature: null } }),
    controlActions: {
        intents: (_body, context) => [...context.state.orders.values()].map(intentOf),
        deliveries: (_body, context) => context.state.book.all(),
        settle: (body, context) => {
            const input = controlRecord(body, "settle")
            const order = findOrder(context, controlString(input, "reference", "settle"))
            markPaid(context, order)
            return sendWebhook(context, order, controlString(input, "deliverTo", "settle"), undefined)
        },
        fail: (body, context) => {
            const input = controlRecord(body, "fail")
            const order = findOrder(context, controlString(input, "reference", "fail"))
            order.status = "CANCELLED"
            const code = typeof input["code"] === "string" && input["code"] !== "00" ? input["code"] : "01"
            return sendWebhook(context, order, controlString(input, "deliverTo", "fail"), code)
        },
        "delay-webhook": (body, context) => {
            const input = controlRecord(body, "delay-webhook")
            const order = findOrder(context, controlString(input, "reference", "delay-webhook"))
            const deliverTo = controlString(input, "deliverTo", "delay-webhook")
            markPaid(context, order)
            context.schedule(controlNumber(input, "delayMs", "delay-webhook"), () => sendWebhook(context, order, deliverTo, undefined))
            return { scheduled: true }
        },
        "replay-webhook": async (body, context) => {
            const reference = String(findOrder(context, controlString(controlRecord(body, "replay-webhook"), "reference", "replay-webhook")).orderCode)
            const delivery = await context.state.book.replay(reference)
            if (delivery === null) throw new FakeControlRejected(404, `nothing was delivered for "${reference}"`)
            return delivery
        },
    },
    client: (bridge: FakeBridge, base: FakeClient, options: PayosOptions | undefined): PayosClient => paymentClient(bridge, base, options),
})

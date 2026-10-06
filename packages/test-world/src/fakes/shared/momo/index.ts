/**
 * The MoMo Payment Gateway v2 (All-in-One) fake: `POST /v2/gateway/api/create` (signature verified, pay url answered),
 * `/v2/gateway/api/query`, `/v2/gateway/api/refund` and the IPN (a signed POST of JSON to the app, answered 204 by a
 * conforming app). The real signature scheme lives in `signature.ts`.
 *
 * Business errors are HTTP 200 with a non-zero `resultCode` (as MoMo does); a malformed body is HTTP 400 (resultCode 20). The
 * IPN goes to the app at `bridge.webhookTarget()` + `webhookPath`, not to the `ipnUrl` of the create call (which the app builds
 * from its own configuration); the `ipnUrl` the app sent is kept in `intents()`.
 */
import type { FakeBridge, FakeClient } from "../../framework/contracts"
import { FakeControlRejected } from "../../framework/failures"
import { defineHttpFake } from "../../framework/http-fake"
import type { FakeHttpReply, FakeHttpRequest, HttpFakeContext } from "../../framework/http-fake"
import { DeliveryBook, appUrl, controlNumber, controlRecord, controlString, normalizePath, paymentClient, secretFor } from "../payment-kit"
import type { PaymentClient, PaymentWebhookOptions } from "../payment-kit"
import {
    MOMO_ERROR_BAD_REQUEST,
    MOMO_ERROR_DUPLICATED_ORDER,
    MOMO_ERROR_INVALID_SIGNATURE,
    MOMO_ERROR_NOT_FOUND,
    MOMO_PENDING,
    MOMO_SUCCESS,
    MOMO_USER_DENIED,
    momoMessage,
} from "./fixtures"
import { momoCreateResponse, momoRefundResponse, momoResult } from "./payloads"
import { MOMO_CREATE_REQUEST_FIELDS, MOMO_QUERY_REQUEST_FIELDS, MOMO_REFUND_REQUEST_FIELDS, momoVerify } from "./signature"

export * from "./fixtures"
export * from "./payloads"
export * from "./signature"

/** What `momoFake` is declared with. */
export interface MomoOptions extends PaymentWebhookOptions {
    /** The partner code (default: random, `values.partnerCode`). */
    readonly partnerCode?: string
    /** The access key (default: random, `values.accessKey`). */
    readonly accessKey?: string
    /** The secret key the app signs with (default: random, `values.secretKey`). */
    readonly secretKey?: string
    /** Where the app receives the IPN (default `/payment/momo/ipn`). */
    readonly webhookPath?: string
}

/** A payment the app created, as `intents()` shows it. */
export interface MomoIntent {
    /** The `orderId`. */
    readonly reference: string
    readonly requestId: string
    readonly amount: number
    readonly orderInfo: string
    readonly requestType: string
    readonly extraData: string
    /** The `redirectUrl` and `ipnUrl` the app sent. */
    readonly redirectUrl: string
    readonly ipnUrl: string
    readonly payUrl: string
    readonly status: "pending" | "paid" | "failed"
    /** The `resultCode` reported now (1000 while pending). */
    readonly resultCode: number
    readonly transId: number | null
    /** Refunded so far. */
    readonly refunded: number
    readonly createdAt: string
}

/** What settling takes. */
export interface MomoSettleParams {
    /** The `orderId`. */
    readonly reference: string
    readonly payType?: string
}

/** What failing takes. */
export interface MomoFailParams {
    readonly reference: string
    /** `resultCode` (default 1006, denied by the user; 1005 expired, 1001 insufficient funds...). */
    readonly code?: number
}

/** Settle now, deliver the IPN after `delayMs`. */
export interface MomoDelayParams extends MomoSettleParams {
    readonly delayMs: number
}

/** The handle of the fake. */
export type MomoClient = PaymentClient<MomoIntent, MomoSettleParams, MomoFailParams, MomoDelayParams>

interface Order {
    readonly reference: string
    readonly requestId: string
    readonly amount: number
    readonly orderInfo: string
    readonly requestType: string
    readonly extraData: string
    readonly redirectUrl: string
    readonly ipnUrl: string
    readonly payUrl: string
    readonly createdAt: string
    status: "pending" | "paid" | "failed"
    resultCode: number
    transId: number | null
    payType: string
    refunded: number
}

interface MomoState {
    readonly orders: Map<string, Order>
    readonly book: DeliveryBook
    transSequence: number
}

type Context = HttpFakeContext<MomoState, MomoOptions | undefined>

const DEFAULT_WEBHOOK_PATH = "/payment/momo/ipn"
const CREATE_PATH = "/v2/gateway/api/create"
const QUERY_PATH = "/v2/gateway/api/query"
const REFUND_PATH = "/v2/gateway/api/refund"
const PAY_PAGE_PATH = "/v2/gateway/pay"

const partnerCodeOf = (context: Context): string => context.options?.partnerCode ?? `MOMO${context.secret("momo-partner-code").slice(0, 6).toUpperCase()}`
const accessKeyOf = (context: Context): string => context.options?.accessKey ?? context.secret("momo-access-key")
const secretKeyOf = (context: Context): string => context.options?.secretKey ?? context.secret("momo-secret-key")
const webhookPathOf = (context: Context): string => normalizePath(context.options?.webhookPath ?? DEFAULT_WEBHOOK_PATH)

const intentOf = (order: Order): MomoIntent => ({
    reference: order.reference,
    requestId: order.requestId,
    amount: order.amount,
    orderInfo: order.orderInfo,
    requestType: order.requestType,
    extraData: order.extraData,
    redirectUrl: order.redirectUrl,
    ipnUrl: order.ipnUrl,
    payUrl: order.payUrl,
    status: order.status,
    resultCode: order.resultCode,
    transId: order.transId,
    refunded: order.refunded,
    createdAt: order.createdAt,
})

const record = (request: FakeHttpRequest): Readonly<Record<string, unknown>> | null => {
    const parsed = request.json()
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Readonly<Record<string, unknown>>) : null
}

const asString = (value: unknown): string => (typeof value === "string" ? value : "")

/** Common gate of the three API calls: a JSON object, the partner code, a valid signature. */
const authenticate = (
    request: FakeHttpRequest,
    context: Context,
    fields: ReadonlyArray<string>,
): { readonly body: Readonly<Record<string, unknown>> } | { readonly reply: FakeHttpReply } => {
    const body = record(request)
    if (body === null) return { reply: { status: 400, body: MOMO_ERROR_BAD_REQUEST } }
    const auth = { accessKey: accessKeyOf(context) }
    if (body["partnerCode"] !== partnerCodeOf(context) || !momoVerify(body, fields, secretKeyOf(context), auth)) {
        return { reply: { body: { ...MOMO_ERROR_INVALID_SIGNATURE, partnerCode: asString(body["partnerCode"]), orderId: asString(body["orderId"]), requestId: asString(body["requestId"]) } } }
    }
    return { body }
}

const create = (request: FakeHttpRequest, context: Context): FakeHttpReply => {
    const gate = authenticate(request, context, MOMO_CREATE_REQUEST_FIELDS)
    if ("reply" in gate) return gate.reply
    const body = gate.body
    const orderId = asString(body["orderId"])
    const amount = body["amount"]
    if (orderId === "" || typeof amount !== "number" || !Number.isInteger(amount) || amount < 1000) {
        return { status: 400, body: { ...MOMO_ERROR_BAD_REQUEST, partnerCode: partnerCodeOf(context), orderId, requestId: asString(body["requestId"]) } }
    }
    if (context.state.orders.has(orderId)) {
        return { body: { ...MOMO_ERROR_DUPLICATED_ORDER, partnerCode: partnerCodeOf(context), orderId, requestId: asString(body["requestId"]) } }
    }
    const requestId = asString(body["requestId"])
    const payUrl = `${context.url}${PAY_PAGE_PATH}?orderId=${encodeURIComponent(orderId)}`
    context.state.orders.set(orderId, {
        reference: orderId,
        requestId,
        amount,
        orderInfo: asString(body["orderInfo"]),
        requestType: asString(body["requestType"]),
        extraData: asString(body["extraData"]),
        redirectUrl: asString(body["redirectUrl"]),
        ipnUrl: asString(body["ipnUrl"]),
        payUrl,
        createdAt: context.start.now().toISOString(),
        status: "pending",
        resultCode: MOMO_PENDING,
        transId: null,
        payType: "qr",
        refunded: 0,
    })
    return { body: momoCreateResponse({ partnerCode: partnerCodeOf(context), orderId, requestId, amount }, payUrl, context.start.now().getTime(), accessKeyOf(context), secretKeyOf(context)) }
}

const resultOf = (context: Context, order: Order, secret: string) =>
    momoResult(
        {
            partnerCode: partnerCodeOf(context),
            orderId: order.reference,
            requestId: order.requestId,
            amount: order.amount,
            orderInfo: order.orderInfo,
            extraData: order.extraData,
            transId: order.transId ?? 0,
            resultCode: order.resultCode,
            responseTime: context.start.now().getTime(),
            payType: order.payType,
        },
        accessKeyOf(context),
        secret,
    )

const query = (request: FakeHttpRequest, context: Context): FakeHttpReply => {
    const gate = authenticate(request, context, MOMO_QUERY_REQUEST_FIELDS)
    if ("reply" in gate) return gate.reply
    const order = context.state.orders.get(asString(gate.body["orderId"]))
    if (order === undefined) {
        return { body: { ...MOMO_ERROR_NOT_FOUND, partnerCode: partnerCodeOf(context), orderId: asString(gate.body["orderId"]), requestId: asString(gate.body["requestId"]) } }
    }
    return { body: resultOf(context, order, secretKeyOf(context)) }
}

const refund = (request: FakeHttpRequest, context: Context): FakeHttpReply => {
    const gate = authenticate(request, context, MOMO_REFUND_REQUEST_FIELDS)
    if ("reply" in gate) return gate.reply
    const body = gate.body
    const order = context.state.orders.get(asString(body["orderId"]))
    const identity = { partnerCode: partnerCodeOf(context), orderId: asString(body["orderId"]), requestId: asString(body["requestId"]) }
    if (order?.status !== "paid" || order?.transId !== body["transId"]) return { body: { ...MOMO_ERROR_NOT_FOUND, ...identity } }
    const amount = body["amount"]
    if (typeof amount !== "number" || amount < 1 || order.refunded + amount > order.amount) {
        return { body: { resultCode: 21, message: momoMessage(21), ...identity } }
    }
    order.refunded += amount
    return { body: momoRefundResponse({ ...identity, amount, transId: order.transId ?? 0 }, context.start.now().getTime()) }
}

const findOrder = (context: Context, reference: string): Order => {
    const order = context.state.orders.get(reference)
    if (order === undefined) throw new FakeControlRejected(404, `no order "${reference}" was created at the fake`)
    return order
}

const sendIpn = (context: Context, order: Order, deliverTo: string) => {
    const bad = context.takeBadSignature()
    const body = JSON.stringify(resultOf(context, order, secretFor(secretKeyOf(context), bad)))
    return context.state.book.deliver({
        reference: order.reference,
        method: "POST",
        url: appUrl(deliverTo, webhookPathOf(context)),
        body,
        headers: { "content-type": "application/json" },
    })
}

const finish = (context: Context, order: Order, resultCode: number, payType: string | undefined): void => {
    context.state.transSequence += 1
    order.status = resultCode === MOMO_SUCCESS ? "paid" : "failed"
    order.resultCode = resultCode
    order.transId = resultCode === MOMO_SUCCESS ? 2_820_000_000 + context.state.transSequence : null
    order.payType = payType ?? order.payType
}

/** The MoMo fake; `momoFake(options)` is what a `test-world.config.ts` declares. */
export const momoFake = defineHttpFake<MomoClient, MomoOptions | undefined, MomoState>({
    state: () => ({ orders: new Map(), book: new DeliveryBook(), transSequence: 0 }),
    values: (context) => ({
        partnerCode: partnerCodeOf(context),
        accessKey: accessKeyOf(context),
        secretKey: secretKeyOf(context),
        baseUrl: context.url,
        endpoint: `${context.url}${CREATE_PATH}`,
    }),
    endpoints: (context) => ({ createUrl: `${context.url}${CREATE_PATH}`, queryUrl: `${context.url}${QUERY_PATH}`, refundUrl: `${context.url}${REFUND_PATH}` }),
    failureBody: (status) => ({ resultCode: 99, message: `injected failure ${status}` }),
    routes: [
        { method: "POST", path: CREATE_PATH, handle: create },
        { method: "POST", path: QUERY_PATH, handle: query },
        { method: "POST", path: REFUND_PATH, handle: refund },
        {
            method: "GET",
            path: PAY_PAGE_PATH,
            handle: (request) => ({ headers: { "content-type": "text/html; charset=utf-8" }, body: `<html><body><h1>MoMo test wallet</h1><p>${request.query.get("orderId") ?? ""}</p></body></html>` }),
        },
    ],
    handle: (request) => ({ status: 404, body: { resultCode: 42, message: `no route for ${request.method} ${request.pathname}` } }),
    controlActions: {
        intents: (_body, context) => [...context.state.orders.values()].map(intentOf),
        deliveries: (_body, context) => context.state.book.all(),
        settle: (body, context) => {
            const input = controlRecord(body, "settle")
            const order = findOrder(context, controlString(input, "reference", "settle"))
            finish(context, order, MOMO_SUCCESS, typeof input["payType"] === "string" ? input["payType"] : undefined)
            return sendIpn(context, order, controlString(input, "deliverTo", "settle"))
        },
        fail: (body, context) => {
            const input = controlRecord(body, "fail")
            const order = findOrder(context, controlString(input, "reference", "fail"))
            const code = typeof input["code"] === "number" && input["code"] !== MOMO_SUCCESS ? input["code"] : MOMO_USER_DENIED
            finish(context, order, code, undefined)
            return sendIpn(context, order, controlString(input, "deliverTo", "fail"))
        },
        "delay-webhook": (body, context) => {
            const input = controlRecord(body, "delay-webhook")
            const order = findOrder(context, controlString(input, "reference", "delay-webhook"))
            const deliverTo = controlString(input, "deliverTo", "delay-webhook")
            finish(context, order, MOMO_SUCCESS, typeof input["payType"] === "string" ? input["payType"] : undefined)
            context.schedule(controlNumber(input, "delayMs", "delay-webhook"), () => sendIpn(context, order, deliverTo))
            return { scheduled: true }
        },
        "replay-webhook": async (body, context) => {
            const reference = controlString(controlRecord(body, "replay-webhook"), "reference", "replay-webhook")
            const delivery = await context.state.book.replay(reference)
            if (delivery === null) throw new FakeControlRejected(404, `nothing was delivered for "${reference}"`)
            return delivery
        },
    },
    client: (bridge: FakeBridge, base: FakeClient, options: MomoOptions | undefined): MomoClient => paymentClient(bridge, base, options),
})

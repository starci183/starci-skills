/**
 * The VNPAY-PAY 2.1.0 fake: the payment URL (`/paymentv2/vpcpay.html`, hash verified), the IPN (a signed GET to the app), the
 * return URL the payer's browser follows, and the merchant web api (`/merchant_webapi/api/transaction`: querydr and refund).
 * The real signature scheme lives in `signature.ts`; a wrong hash is refused exactly as VNPAY refuses it.
 *
 * The gateway learns about a payment when its pay URL is opened (VNPAY has no "create" call): a spec builds or reads the pay
 * URL from the app and does `fetch(payUrl)`; from then on `intents()` shows it, and `settle`/`fail` complete it.
 */
import type { FakeBridge, FakeClient } from "../../framework/contracts"
import { FakeControlRejected } from "../../framework/failures"
import { defineHttpFake } from "../../framework/http-fake"
import type { FakeHttpReply, FakeHttpRequest, HttpFakeContext } from "../../framework/http-fake"
import {
    DeliveryBook,
    appUrl,
    controlNumber,
    controlOptionalString,
    controlRecord,
    controlString,
    normalizePath,
    paymentClient,
    secretFor,
} from "../payment-kit"
import type { PaymentClient, PaymentWebhookOptions } from "../payment-kit"
import { VNPAY_INVALID_SIGNATURE_PAGE, VNPAY_TRANSACTION_STATUS, vnpayApiError } from "./fixtures"
import type { VnpayTransactionView } from "./payloads"
import { vnpayQuerydrResponse, vnpayRefundResponse, vnpayResultParams } from "./payloads"
import {
    VNPAY_QUERYDR_REQUEST_FIELDS,
    VNPAY_REFUND_REQUEST_FIELDS,
    vnpayEncode,
    vnpayPipeVerify,
    vnpayVerify,
} from "./signature"

export * from "./fixtures"
export * from "./payloads"
export * from "./signature"

/** What `vnpayFake` is declared with. */
export interface VnpayOptions extends PaymentWebhookOptions {
    /** The merchant code the app is configured with (default: a run-stable random one, exposed as `values.tmnCode`). */
    readonly tmnCode?: string
    /** The hash secret the app signs with (default: run-stable random, `values.hashSecret`). */
    readonly hashSecret?: string
    /** Where the app receives the IPN (default `/payment/vnpay/ipn`). */
    readonly webhookPath?: string
}

/** A payment the fake knows, as `intents()` shows it. */
export interface VnpayIntent {
    /** `vnp_TxnRef`. */
    readonly reference: string
    /** Amount in VND (`vnp_Amount` / 100). */
    readonly amount: number
    readonly orderInfo: string
    /** The `vnp_ReturnUrl` the app sent. */
    readonly returnUrl: string
    /** The pay URL that was opened. */
    readonly payUrl: string
    readonly status: "pending" | "paid" | "failed"
    /** `vnp_ResponseCode` once settled or failed, else null. */
    readonly responseCode: string | null
    readonly transactionNo: string | null
    /** `vnp_PayDate` (GMT+7, `yyyyMMddHHmmss`) once settled. */
    readonly payDate: string | null
    /** The signed URL the payer's browser returns to (return URL plus signed query), once settled or failed. */
    readonly signedReturnUrl: string | null
    /** Total refunded (VND). */
    readonly refunded: number
    readonly createdAt: string
}

/** What settling takes. */
export interface VnpaySettleParams {
    /** The `vnp_TxnRef`. */
    readonly reference: string
    readonly bankCode?: string
    readonly transactionNo?: string
}

/** What failing takes. */
export interface VnpayFailParams {
    readonly reference: string
    /** `vnp_ResponseCode` (default `24`, cancelled by the payer; `11` expired, `51` insufficient funds...). */
    readonly code?: string
}

/** Settle now, deliver the IPN after `delayMs`. */
export interface VnpayDelayParams extends VnpaySettleParams {
    readonly delayMs: number
}

/** The handle of the fake. */
export type VnpayClient = PaymentClient<VnpayIntent, VnpaySettleParams, VnpayFailParams, VnpayDelayParams>

interface Txn {
    readonly reference: string
    readonly amountRaw: string
    readonly orderInfo: string
    readonly returnUrl: string
    readonly payUrl: string
    readonly createdAt: string
    status: "pending" | "paid" | "failed"
    responseCode: string | null
    transactionNo: string | null
    payDate: string | null
    bankCode: string
    signedReturnUrl: string | null
    refunded: number
    refundIds: Array<string>
}

interface VnpayState {
    readonly txns: Map<string, Txn>
    readonly book: DeliveryBook
    transactionSequence: number
}

type Context = HttpFakeContext<VnpayState, VnpayOptions | undefined>

const DEFAULT_WEBHOOK_PATH = "/payment/vnpay/ipn"
const PAY_PATH = "/paymentv2/vpcpay.html"
const API_PATH = "/merchant_webapi/api/transaction"

const tmnCodeOf = (context: Context): string => context.options?.tmnCode ?? context.secret("vnpay-tmn-code").slice(0, 8).toUpperCase()
const hashSecretOf = (context: Context): string => context.options?.hashSecret ?? context.secret("vnpay-hash-secret")
const webhookPathOf = (context: Context): string => normalizePath(context.options?.webhookPath ?? DEFAULT_WEBHOOK_PATH)

const two = (value: number): string => String(value).padStart(2, "0")

/** `yyyyMMddHHmmss` in GMT+7, the time zone VNPAY uses. */
const vnpayTime = (date: Date): string => {
    const shifted = new Date(date.getTime() + 7 * 3_600_000)
    return `${shifted.getUTCFullYear()}${two(shifted.getUTCMonth() + 1)}${two(shifted.getUTCDate())}${two(shifted.getUTCHours())}${two(shifted.getUTCMinutes())}${two(shifted.getUTCSeconds())}`
}

const queryString = (params: Readonly<Record<string, string>>): string =>
    Object.entries(params)
        .map(([key, value]) => `${key}=${vnpayEncode(value)}`)
        .join("&")

const html = (status: number, body: string): FakeHttpReply => ({ status, headers: { "content-type": "text/html; charset=utf-8" }, body })

const intentOf = (txn: Txn): VnpayIntent => ({
    reference: txn.reference,
    amount: Number(txn.amountRaw) / 100,
    orderInfo: txn.orderInfo,
    returnUrl: txn.returnUrl,
    payUrl: txn.payUrl,
    status: txn.status,
    responseCode: txn.responseCode,
    transactionNo: txn.transactionNo,
    payDate: txn.payDate,
    signedReturnUrl: txn.signedReturnUrl,
    refunded: txn.refunded,
    createdAt: txn.createdAt,
})

const pay = (request: FakeHttpRequest, context: Context): FakeHttpReply => {
    const params = Object.fromEntries(request.query)
    if (!vnpayVerify(params, hashSecretOf(context))) return html(400, VNPAY_INVALID_SIGNATURE_PAGE)
    const reference = params["vnp_TxnRef"] ?? ""
    const amountRaw = params["vnp_Amount"] ?? ""
    if (params["vnp_TmnCode"] !== tmnCodeOf(context) || reference === "" || !/^\d+$/.test(amountRaw)) {
        return html(400, "<html><body><h1>Invalid parameters</h1></body></html>")
    }
    if (!context.state.txns.has(reference)) {
        context.state.txns.set(reference, {
            reference,
            amountRaw,
            orderInfo: params["vnp_OrderInfo"] ?? "",
            returnUrl: params["vnp_ReturnUrl"] ?? "",
            payUrl: `${context.url}${request.path}`,
            createdAt: context.start.now().toISOString(),
            status: "pending",
            responseCode: null,
            transactionNo: null,
            payDate: null,
            bankCode: params["vnp_BankCode"] ?? "NCB",
            signedReturnUrl: null,
            refunded: 0,
            refundIds: [],
        })
    }
    return html(200, `<html><body><h1>VNPAY sandbox</h1><p>Payment ${reference}: ${Number(amountRaw) / 100} VND</p></body></html>`)
}

const findTxn = (context: Context, reference: string): Txn => {
    const txn = context.state.txns.get(reference)
    if (txn === undefined) throw new FakeControlRejected(404, `no payment with vnp_TxnRef "${reference}" (open its pay url first)`)
    return txn
}

const returnParams = (context: Context, txn: Txn, secret: string): Record<string, string> =>
    vnpayResultParams(
        {
            tmnCode: tmnCodeOf(context),
            txnRef: txn.reference,
            amount: txn.amountRaw,
            orderInfo: txn.orderInfo,
            responseCode: txn.responseCode ?? "99",
            transactionNo: txn.transactionNo ?? "0",
            payDate: txn.payDate ?? "",
            bankCode: txn.bankCode,
        },
        secret,
    )

/** Moves the payment to its final state (the gateway reports it from now on) and builds the return URL. */
const finish = (context: Context, txn: Txn, responseCode: string, extra: { readonly transactionNo?: string; readonly bankCode?: string }): void => {
    context.state.transactionSequence += 1
    const success = responseCode === "00"
    txn.status = success ? "paid" : "failed"
    txn.responseCode = responseCode
    txn.transactionNo = success ? (extra.transactionNo ?? String(14_000_000 + context.state.transactionSequence)) : null
    txn.payDate = vnpayTime(context.start.now())
    txn.bankCode = extra.bankCode ?? txn.bankCode
    const query = queryString(returnParams(context, txn, hashSecretOf(context)))
    txn.signedReturnUrl = txn.returnUrl === "" ? null : `${txn.returnUrl}${txn.returnUrl.includes("?") ? "&" : "?"}${query}`
}

const sendIpn = (context: Context, txn: Txn, deliverTo: string) => {
    const bad = context.takeBadSignature()
    const query = queryString(returnParams(context, txn, secretFor(hashSecretOf(context), bad)))
    return context.state.book.deliver({
        reference: txn.reference,
        method: "GET",
        url: `${appUrl(deliverTo, webhookPathOf(context))}?${query}`,
        body: "",
        headers: { accept: "application/json" },
    })
}

const viewOf = (context: Context, txn: Txn): VnpayTransactionView => ({
    tmnCode: tmnCodeOf(context),
    txnRef: txn.reference,
    amount: txn.amountRaw,
    orderInfo: txn.orderInfo,
    transactionNo: txn.transactionNo ?? "0",
    payDate: txn.payDate ?? "",
    bankCode: txn.bankCode,
    responseCode: txn.responseCode ?? "",
    transactionStatus:
        txn.status === "paid" ? VNPAY_TRANSACTION_STATUS.success : txn.status === "failed" ? VNPAY_TRANSACTION_STATUS.failed : VNPAY_TRANSACTION_STATUS.pending,
})

const webApi = (request: FakeHttpRequest, context: Context): FakeHttpReply => {
    const parsed = request.json()
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return { body: vnpayApiError("malformed") }
    const body = parsed as Readonly<Record<string, unknown>>
    const secret = hashSecretOf(context)
    const command = body["vnp_Command"]
    const fields = command === "querydr" ? VNPAY_QUERYDR_REQUEST_FIELDS : command === "refund" ? VNPAY_REFUND_REQUEST_FIELDS : null
    if (fields === null) return { body: vnpayApiError("malformed") }
    if (!vnpayPipeVerify(body, fields, secret)) return { body: vnpayApiError("invalidSignature") }
    if (body["vnp_TmnCode"] !== tmnCodeOf(context)) return { body: vnpayApiError("merchantInvalid") }
    const txn = context.state.txns.get(String((body["vnp_TxnRef"] ?? "") as string))
    if (txn === undefined) return { body: vnpayApiError("orderNotFound") }
    const responseId = String((body["vnp_RequestId"] ?? "") as string)
    if (command === "querydr") return { body: vnpayQuerydrResponse(viewOf(context, txn), responseId, secret) }
    const amount = String((body["vnp_Amount"] ?? "") as string)
    if (txn.status !== "paid") return { body: vnpayApiError("orderNotFound") }
    if (txn.refundIds.includes(responseId)) return { body: vnpayApiError("duplicated") }
    if (!/^\d+$/.test(amount) || Number(amount) / 100 + txn.refunded > Number(txn.amountRaw) / 100) return { body: vnpayApiError("invalidAmount") }
    txn.refundIds.push(responseId)
    txn.refunded += Number(amount) / 100
    return {
        body: vnpayRefundResponse(
            viewOf(context, txn),
            { vnp_TransactionType: String((body["vnp_TransactionType"] ?? "02") as string), vnp_Amount: amount },
            responseId,
            secret,
        ),
    }
}

const settleBody = (body: unknown, action: string): { readonly txnRef: string; readonly deliverTo: string; readonly bankCode?: string; readonly transactionNo?: string; readonly code?: string } => {
    const record = controlRecord(body, action)
    return {
        txnRef: controlString(record, "reference", action),
        deliverTo: controlString(record, "deliverTo", action),
        bankCode: controlOptionalString(record, "bankCode"),
        transactionNo: controlOptionalString(record, "transactionNo"),
        code: controlOptionalString(record, "code"),
    }
}

/** The VNPAY fake; `vnpayFake(options)` is what a `test-world.config.ts` declares. */
export const vnpayFake = defineHttpFake<VnpayClient, VnpayOptions | undefined, VnpayState>({
    state: () => ({ txns: new Map(), book: new DeliveryBook(), transactionSequence: 0 }),
    values: (context) => ({
        tmnCode: tmnCodeOf(context),
        hashSecret: hashSecretOf(context),
        baseUrl: context.url,
        payUrl: `${context.url}${PAY_PATH}`,
        apiUrl: `${context.url}${API_PATH}`,
    }),
    endpoints: (context) => ({ payUrl: `${context.url}${PAY_PATH}`, apiUrl: `${context.url}${API_PATH}` }),
    failureBody: (status) => ({ vnp_ResponseCode: "99", vnp_Message: `injected failure ${status}` }),
    routes: [
        { method: "GET", path: PAY_PATH, handle: pay },
        { method: "POST", path: API_PATH, handle: webApi },
    ],
    handle: (request) => ({ status: 404, body: { vnp_ResponseCode: "99", vnp_Message: `no route for ${request.method} ${request.pathname}` } }),
    controlActions: {
        intents: (_body, context) => [...context.state.txns.values()].map(intentOf),
        deliveries: (_body, context) => context.state.book.all(),
        settle: async (body, context) => {
            const params = settleBody(body, "settle")
            const txn = findTxn(context, params.txnRef)
            finish(context, txn, "00", params)
            return sendIpn(context, txn, params.deliverTo)
        },
        fail: async (body, context) => {
            const params = settleBody(body, "fail")
            const txn = findTxn(context, params.txnRef)
            finish(context, txn, params.code ?? "24", params)
            return sendIpn(context, txn, params.deliverTo)
        },
        "delay-webhook": (body, context) => {
            const params = settleBody(body, "delay-webhook")
            const delayMs = controlNumber(controlRecord(body, "delay-webhook"), "delayMs", "delay-webhook")
            const txn = findTxn(context, params.txnRef)
            finish(context, txn, "00", params)
            context.schedule(delayMs, () => sendIpn(context, txn, params.deliverTo))
            return { scheduled: true }
        },
        "replay-webhook": async (body, context) => {
            const params = settleBody(body, "replay-webhook")
            const delivery = await context.state.book.replay(params.txnRef)
            if (delivery === null) throw new FakeControlRejected(404, `nothing was delivered for "${params.txnRef}"`)
            return delivery
        },
    },
    client: (bridge: FakeBridge, base: FakeClient, options: VnpayOptions | undefined): VnpayClient => paymentClient(bridge, base, options),
})

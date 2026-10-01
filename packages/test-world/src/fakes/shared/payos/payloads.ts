/**
 * Typed builders of every payOS body: create request/response, get/cancel response and the webhook (payOS v2). Signing is
 * delegated to `signature.ts`.
 */
import { payosSignCreate, payosSignData } from "./signature"
import type { PayosStatus } from "./fixtures"
import { PAYOS_PAID_DATA_CODE } from "./fixtures"

/** The body of `POST /v2/payment-requests`. */
export interface PayosCreateRequest {
    readonly orderCode: number
    readonly amount: number
    readonly description: string
    readonly cancelUrl: string
    readonly returnUrl: string
    readonly items?: ReadonlyArray<{ readonly name: string; readonly quantity: number; readonly price: number }>
    readonly buyerName?: string
    readonly buyerEmail?: string
    readonly buyerPhone?: string
    readonly expiredAt?: number
    readonly signature: string
}

/** A signed create request as an app sends it. */
export const payosCreateRequest = (input: Omit<PayosCreateRequest, "signature">, checksumKey: string): PayosCreateRequest => ({
    ...input,
    signature: payosSignCreate(input, checksumKey),
})

/** The `data` of a create response and of get/cancel. */
export interface PayosPaymentData {
    readonly bin: string
    readonly accountNumber: string
    readonly accountName: string
    readonly amount: number
    readonly description: string
    readonly orderCode: number
    readonly currency: string
    readonly paymentLinkId: string
    readonly status: PayosStatus
    readonly checkoutUrl: string
    readonly qrCode: string
}

/** What a payment data is built from. */
export interface PayosPaymentInput {
    readonly orderCode: number
    readonly amount: number
    readonly description: string
    readonly paymentLinkId: string
    readonly checkoutUrl: string
    readonly status: PayosStatus
}

/** The `data` of a payment request. */
export const payosPaymentData = (input: PayosPaymentInput): PayosPaymentData => ({
    bin: "970422",
    accountNumber: "0123456789",
    accountName: "CONG TY TEST",
    amount: input.amount,
    description: input.description,
    orderCode: input.orderCode,
    currency: "VND",
    paymentLinkId: input.paymentLinkId,
    status: input.status,
    checkoutUrl: input.checkoutUrl,
    qrCode: `00020101021238570010A000000727012700069704220113012345678900208QRIBFTTA53037045405${input.amount}5802VN62${input.description.length}`,
})

/** A payOS success envelope. */
export interface PayosEnvelope<TData> {
    readonly code: string
    readonly desc: string
    readonly data: TData
    readonly signature: string
}

/** The signed success envelope of a payment data (the response signature is over the sorted data). */
export const payosEnvelope = <TData extends object>(data: TData, checksumKey: string): PayosEnvelope<TData> => ({
    code: "00",
    desc: "success",
    data,
    signature: payosSignData(data as Readonly<Record<string, unknown>>, checksumKey),
})

/** The `data` of GET and cancel: the payment data plus what happened to it. */
export interface PayosGetData extends Readonly<Record<string, unknown>> {
    readonly id: string
    readonly orderCode: number
    readonly amount: number
    readonly amountPaid: number
    readonly amountRemaining: number
    readonly status: PayosStatus
    readonly createdAt: string
    readonly transactions: ReadonlyArray<Readonly<Record<string, unknown>>>
    readonly canceledAt: string | null
    readonly cancellationReason: string | null
}

/** The `data` of a webhook. */
export interface PayosWebhookData extends Readonly<Record<string, unknown>> {
    readonly orderCode: number
    readonly amount: number
    readonly description: string
    readonly accountNumber: string
    readonly reference: string
    readonly transactionDateTime: string
    readonly currency: string
    readonly paymentLinkId: string
    readonly code: string
    readonly desc: string
    readonly counterAccountBankId: string
    readonly counterAccountBankName: string
    readonly counterAccountName: string
    readonly counterAccountNumber: string
    readonly virtualAccountName: string
    readonly virtualAccountNumber: string
}

/** The body payOS POSTs to the webhook url. */
export interface PayosWebhookBody {
    readonly code: string
    readonly desc: string
    readonly success: boolean
    readonly data: PayosWebhookData
    readonly signature: string
}

/** What a webhook is built from. */
export interface PayosWebhookInput {
    readonly orderCode: number
    readonly amount: number
    readonly description: string
    readonly paymentLinkId: string
    readonly reference: string
    readonly transactionDateTime: string
    /** The `data.code`: `00` paid, other codes report a failure. */
    readonly dataCode?: string
    readonly dataDesc?: string
}

/** The signed webhook body. */
export const payosWebhookBody = (input: PayosWebhookInput, checksumKey: string): PayosWebhookBody => {
    const dataCode = input.dataCode ?? PAYOS_PAID_DATA_CODE.code
    const paid = dataCode === PAYOS_PAID_DATA_CODE.code
    const data: PayosWebhookData = {
        orderCode: input.orderCode,
        amount: input.amount,
        description: input.description,
        accountNumber: "0123456789",
        reference: input.reference,
        transactionDateTime: input.transactionDateTime,
        currency: "VND",
        paymentLinkId: input.paymentLinkId,
        code: dataCode,
        desc: input.dataDesc ?? (paid ? PAYOS_PAID_DATA_CODE.desc : "That bai"),
        counterAccountBankId: "",
        counterAccountBankName: "",
        counterAccountName: "",
        counterAccountNumber: "",
        virtualAccountName: "",
        virtualAccountNumber: "",
    }
    return { code: dataCode, desc: paid ? "success" : "failed", success: paid, data, signature: payosSignData(data, checksumKey) }
}

/** The `data` of a `GET /v2/payment-requests/{id}` answer. */
export const payosGetData = (
    input: PayosPaymentInput & { readonly createdAt: string; readonly reference?: string; readonly transactionDateTime?: string },
): PayosGetData => {
    const paid = input.status === "PAID"
    return {
        id: input.paymentLinkId,
        orderCode: input.orderCode,
        amount: input.amount,
        amountPaid: paid ? input.amount : 0,
        amountRemaining: paid ? 0 : input.amount,
        status: input.status,
        createdAt: input.createdAt,
        transactions: paid
            ? [
                  {
                      reference: input.reference ?? "",
                      amount: input.amount,
                      accountNumber: "0123456789",
                      description: input.description,
                      transactionDateTime: input.transactionDateTime ?? input.createdAt,
                  },
              ]
            : [],
        canceledAt: input.status === "CANCELLED" ? input.createdAt : null,
        cancellationReason: input.status === "CANCELLED" ? "Cancelled by merchant" : null,
    }
}

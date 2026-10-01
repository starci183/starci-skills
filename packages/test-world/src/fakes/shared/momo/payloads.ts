/**
 * Typed builders of every MoMo body (create, IPN, query, refund) of Payment Gateway v2. Signing is delegated to
 * `signature.ts`; the messages come from `fixtures.ts`.
 */
import { MOMO_CREATE_REQUEST_FIELDS, MOMO_CREATE_RESPONSE_FIELDS, MOMO_IPN_FIELDS, momoSign } from "./signature"
import { MOMO_PENDING, MOMO_SUCCESS, momoMessage } from "./fixtures"

/** The body of `POST /v2/gateway/api/create`. */
export interface MomoCreateRequest {
    readonly partnerCode: string
    readonly partnerName?: string
    readonly storeId?: string
    readonly requestId: string
    readonly amount: number
    readonly orderId: string
    readonly orderInfo: string
    readonly redirectUrl: string
    readonly ipnUrl: string
    /** `captureWallet`, `payWithATM`, `payWithCC`... */
    readonly requestType: string
    readonly extraData: string
    readonly lang: string
    readonly signature: string
}

/** The signed create request an app sends (the app's side, used by tests and by the fake's own checks). */
export const momoCreateRequest = (
    input: Omit<MomoCreateRequest, "signature" | "lang" | "extraData" | "requestType"> & Partial<Pick<MomoCreateRequest, "lang" | "extraData" | "requestType">>,
    accessKey: string,
    secretKey: string,
): MomoCreateRequest => {
    const unsigned = { requestType: "captureWallet", extraData: "", lang: "vi", ...input }
    return { ...unsigned, signature: momoSign(unsigned, MOMO_CREATE_REQUEST_FIELDS, secretKey, { accessKey }) }
}

/** The answer of create. */
export interface MomoCreateResponse {
    readonly partnerCode: string
    readonly orderId: string
    readonly requestId: string
    readonly amount: number
    readonly responseTime: number
    readonly message: string
    readonly resultCode: number
    readonly payUrl: string
    readonly deeplink: string
    readonly qrCodeUrl: string
    readonly signature: string
}

/** The signed create answer with a pay url on the fake. */
export const momoCreateResponse = (
    request: Pick<MomoCreateRequest, "partnerCode" | "orderId" | "requestId" | "amount">,
    payUrl: string,
    responseTime: number,
    accessKey: string,
    secretKey: string,
): MomoCreateResponse => {
    const body = {
        partnerCode: request.partnerCode,
        orderId: request.orderId,
        requestId: request.requestId,
        amount: request.amount,
        responseTime,
        message: momoMessage(MOMO_SUCCESS),
        resultCode: MOMO_SUCCESS,
        payUrl,
        deeplink: `momo://app?action=payWithApp&orderId=${encodeURIComponent(request.orderId)}`,
        qrCodeUrl: `${payUrl}&qr=1`,
    }
    return { ...body, signature: momoSign(body, MOMO_CREATE_RESPONSE_FIELDS, secretKey, { accessKey }) }
}

/** The body MoMo POSTs to `ipnUrl` and returns from query. */
export interface MomoResult {
    readonly partnerCode: string
    readonly orderId: string
    readonly requestId: string
    readonly amount: number
    readonly orderInfo: string
    readonly orderType: string
    readonly transId: number
    readonly resultCode: number
    readonly message: string
    readonly payType: string
    readonly responseTime: number
    readonly extraData: string
    readonly signature: string
}

/** What a result is built from. */
export interface MomoResultInput {
    readonly partnerCode: string
    readonly orderId: string
    readonly requestId: string
    readonly amount: number
    readonly orderInfo: string
    readonly extraData: string
    readonly transId: number
    readonly resultCode: number
    readonly responseTime: number
    readonly payType?: string
    readonly orderType?: string
}

/** The signed IPN body (also the shape of the query answer). */
export const momoResult = (input: MomoResultInput, accessKey: string, secretKey: string): MomoResult => {
    const body = {
        partnerCode: input.partnerCode,
        orderId: input.orderId,
        requestId: input.requestId,
        amount: input.amount,
        orderInfo: input.orderInfo,
        orderType: input.orderType ?? "momo_wallet",
        transId: input.resultCode === MOMO_SUCCESS ? input.transId : 0,
        resultCode: input.resultCode,
        message: momoMessage(input.resultCode),
        payType: input.payType ?? "qr",
        responseTime: input.responseTime,
        extraData: input.extraData,
    }
    return { ...body, signature: momoSign(body, MOMO_IPN_FIELDS, secretKey, { accessKey }) }
}

/** The query answer of a transaction that is still waiting for the payer. */
export const momoPendingResult = (input: Omit<MomoResultInput, "resultCode" | "transId">, accessKey: string, secretKey: string): MomoResult =>
    momoResult({ ...input, resultCode: MOMO_PENDING, transId: 0 }, accessKey, secretKey)

/** The refund answer (unsigned, like the gateway). */
export interface MomoRefundResponse {
    readonly partnerCode: string
    readonly orderId: string
    readonly requestId: string
    readonly amount: number
    readonly transId: number
    readonly resultCode: number
    readonly message: string
    readonly responseTime: number
}

/** The refund answer for an accepted refund. */
export const momoRefundResponse = (
    request: { readonly partnerCode: string; readonly orderId: string; readonly requestId: string; readonly amount: number; readonly transId: number },
    responseTime: number,
): MomoRefundResponse => ({
    partnerCode: request.partnerCode,
    orderId: request.orderId,
    requestId: request.requestId,
    amount: request.amount,
    transId: request.transId,
    resultCode: MOMO_SUCCESS,
    message: momoMessage(MOMO_SUCCESS),
    responseTime,
})

/**
 * Typed builders of every VNPAY body: the pay URL the app builds, the return/IPN query the gateway sends, and the querydr
 * and refund bodies (VNPAY-PAY 2.1.0). Signing is delegated to `signature.ts`.
 */
import { VNPAY_QUERYDR_RESPONSE_FIELDS, VNPAY_REFUND_RESPONSE_FIELDS, vnpayEncode, vnpayPipeSign, vnpaySign } from "./signature"
import type { VnpayParams } from "./signature"
import { VNPAY_RESPONSE_CODES, VNPAY_TRANSACTION_STATUS } from "./fixtures"

/** What the app puts in a payment URL (the subset the fake reads). */
export interface VnpayPaymentRequest {
    readonly vnp_Version: string
    readonly vnp_Command: string
    readonly vnp_TmnCode: string
    /** Amount in VND multiplied by 100. */
    readonly vnp_Amount: string
    readonly vnp_CreateDate: string
    readonly vnp_CurrCode: string
    readonly vnp_IpAddr: string
    readonly vnp_Locale: string
    readonly vnp_OrderInfo: string
    readonly vnp_OrderType: string
    readonly vnp_ReturnUrl: string
    readonly vnp_TxnRef: string
    readonly vnp_BankCode?: string
    readonly vnp_ExpireDate?: string
}

/** The payment request with defaults for what the merchant rarely varies. */
export const vnpayPaymentRequest = (
    input: Pick<VnpayPaymentRequest, "vnp_TmnCode" | "vnp_TxnRef" | "vnp_ReturnUrl"> & Partial<VnpayPaymentRequest> & { readonly vnp_Amount: string },
): VnpayPaymentRequest => ({
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_CreateDate: "20260101120000",
    vnp_CurrCode: "VND",
    vnp_IpAddr: "127.0.0.1",
    vnp_Locale: "vn",
    vnp_OrderInfo: `Thanh toan ${input.vnp_TxnRef}`,
    vnp_OrderType: "other",
    ...input,
})

/** The pay URL an app builds: sorted, url-encoded query plus `vnp_SecureHashType` and `vnp_SecureHash`. */
export const vnpayPayUrl = (baseUrl: string, params: VnpayParams, hashSecret: string): string => {
    const entries = Object.entries(params)
        .filter((entry): entry is [string, string | number] => entry[1] !== undefined && String(entry[1]) !== "")
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    const query = entries.map(([key, value]) => `${key}=${vnpayEncode(String(value))}`).join("&")
    return `${baseUrl}/paymentv2/vpcpay.html?${query}&vnp_SecureHash=${vnpaySign(params, hashSecret)}`
}

/** What a payment result (return URL and IPN) carries before signing. */
export interface VnpayResultInput {
    readonly tmnCode: string
    readonly txnRef: string
    /** Already multiplied by 100, as VNPAY sends it. */
    readonly amount: string
    readonly orderInfo: string
    readonly responseCode: string
    readonly transactionNo: string
    readonly payDate: string
    readonly bankCode?: string
    readonly bankTranNo?: string
    readonly cardType?: string
}

/** The signed query of the return URL and of the IPN (both carry the same parameters). */
export const vnpayResultParams = (input: VnpayResultInput, hashSecret: string): Record<string, string> => {
    const success = input.responseCode === "00"
    const base: Record<string, string> = {
        vnp_Amount: input.amount,
        vnp_BankCode: input.bankCode ?? "NCB",
        vnp_BankTranNo: input.bankTranNo ?? `VNP${input.transactionNo}`,
        vnp_CardType: input.cardType ?? "ATM",
        vnp_OrderInfo: input.orderInfo,
        vnp_PayDate: input.payDate,
        vnp_ResponseCode: input.responseCode,
        vnp_TmnCode: input.tmnCode,
        vnp_TransactionNo: success ? input.transactionNo : "0",
        vnp_TransactionStatus: success ? VNPAY_TRANSACTION_STATUS.success : VNPAY_TRANSACTION_STATUS.failed,
        vnp_TxnRef: input.txnRef,
    }
    return { ...base, vnp_SecureHashType: "HmacSHA512", vnp_SecureHash: vnpaySign(base, hashSecret) }
}

/** The querydr request body an app sends (unsigned fields; the app adds `vnp_SecureHash`). */
export interface VnpayQuerydrRequest {
    readonly vnp_RequestId: string
    readonly vnp_Version: string
    readonly vnp_Command: "querydr"
    readonly vnp_TmnCode: string
    readonly vnp_TxnRef: string
    readonly vnp_OrderInfo: string
    readonly vnp_TransactionDate: string
    readonly vnp_CreateDate: string
    readonly vnp_IpAddr: string
    readonly vnp_SecureHash?: string
}

/** The refund request body an app sends. */
export interface VnpayRefundRequest {
    readonly vnp_RequestId: string
    readonly vnp_Version: string
    readonly vnp_Command: "refund"
    readonly vnp_TmnCode: string
    /** 02 full refund, 03 partial. */
    readonly vnp_TransactionType: string
    readonly vnp_TxnRef: string
    readonly vnp_Amount: string
    readonly vnp_OrderInfo: string
    readonly vnp_TransactionNo?: string
    readonly vnp_TransactionDate: string
    readonly vnp_CreateBy: string
    readonly vnp_CreateDate: string
    readonly vnp_IpAddr: string
    readonly vnp_SecureHash?: string
}

/** What the fake knows of a transaction, to answer querydr. */
export interface VnpayTransactionView {
    readonly tmnCode: string
    readonly txnRef: string
    readonly amount: string
    readonly orderInfo: string
    readonly transactionNo: string
    readonly payDate: string
    readonly bankCode: string
    readonly responseCode: string
    /** `vnp_TransactionStatus`. */
    readonly transactionStatus: string
}

/** The signed querydr answer. */
export const vnpayQuerydrResponse = (view: VnpayTransactionView, responseId: string, hashSecret: string): Record<string, string> => {
    const body: Record<string, string> = {
        vnp_ResponseId: responseId,
        vnp_Command: "querydr",
        vnp_ResponseCode: "00",
        vnp_Message: "QueryDR Success",
        vnp_TmnCode: view.tmnCode,
        vnp_TxnRef: view.txnRef,
        vnp_Amount: view.amount,
        vnp_BankCode: view.bankCode,
        vnp_PayDate: view.payDate,
        vnp_TransactionNo: view.transactionNo,
        vnp_TransactionType: "01",
        vnp_TransactionStatus: view.transactionStatus,
        vnp_OrderInfo: view.orderInfo,
        vnp_PromotionCode: "",
        vnp_PromotionAmount: "",
    }
    return { ...body, vnp_SecureHash: vnpayPipeSign(body, VNPAY_QUERYDR_RESPONSE_FIELDS, hashSecret) }
}

/** The signed refund answer (`vnp_ResponseCode` 00 accepted). */
export const vnpayRefundResponse = (
    view: VnpayTransactionView,
    request: Pick<VnpayRefundRequest, "vnp_TransactionType" | "vnp_Amount">,
    responseId: string,
    hashSecret: string,
): Record<string, string> => {
    const body: Record<string, string> = {
        vnp_ResponseId: responseId,
        vnp_Command: "refund",
        vnp_ResponseCode: "00",
        vnp_Message: "Refund Success",
        vnp_TmnCode: view.tmnCode,
        vnp_TxnRef: view.txnRef,
        vnp_Amount: request.vnp_Amount,
        vnp_BankCode: view.bankCode,
        vnp_PayDate: view.payDate,
        vnp_TransactionNo: view.transactionNo,
        vnp_TransactionType: request.vnp_TransactionType,
        vnp_TransactionStatus: "05",
        vnp_OrderInfo: view.orderInfo,
    }
    return { ...body, vnp_SecureHash: vnpayPipeSign(body, VNPAY_REFUND_RESPONSE_FIELDS, hashSecret) }
}

/** The human meaning of a `vnp_ResponseCode`. */
export const vnpayResponseMessage = (code: string): string =>
    (VNPAY_RESPONSE_CODES as Readonly<Record<string, string>>)[code] ?? VNPAY_RESPONSE_CODES["99"]

/**
 * MoMo fixtures: result codes of Payment Gateway v2 and the static error bodies the fake answers. Typed objects, not JSON
 * files, because tsc does not copy JSON into `dist`.
 */

/** `resultCode` of MoMo v2 with the documented meaning. */
export const MOMO_RESULT_CODES = {
    0: "Successful.",
    9: "Transaction is being processed.",
    10: "The system is under maintenance.",
    11: "Access denied.",
    12: "Unsupported API version.",
    13: "Merchant authentication failed.",
    20: "Bad format request.",
    21: "Invalid amount.",
    22: "Amount out of range.",
    40: "Duplicated requestId.",
    41: "Duplicated orderId.",
    42: "Invalid orderId or order not found.",
    43: "Request conflicts with another transaction being processed.",
    1000: "Transaction initiated, waiting for user confirmation.",
    1001: "Transaction failed due to insufficient funds.",
    1002: "Transaction rejected by the issuer.",
    1003: "Transaction cancelled after authorization.",
    1004: "Transaction failed because the amount exceeds the limit.",
    1005: "Transaction failed because the url or QR code expired.",
    1006: "Transaction failed because the user denied confirmation.",
    1007: "Transaction rejected because the user account is not active.",
    9000: "Transaction authorized.",
} as const

/** The result codes the fake produces. */
export const MOMO_SUCCESS = 0
/** The payer denied the payment. */
export const MOMO_USER_DENIED = 1006
/** The pay url expired. */
export const MOMO_EXPIRED = 1005
/** Authorized (two-step capture). */
export const MOMO_AUTHORIZED = 9000
/** Waiting for the payer. */
export const MOMO_PENDING = 1000

/** The human meaning of a `resultCode`; unknown codes read "Unknown". */
export const momoMessage = (resultCode: number): string => (MOMO_RESULT_CODES as Readonly<Record<number, string>>)[resultCode] ?? "Unknown."

/** The body MoMo answers a request with a wrong signature (resultCode 13). */
export const MOMO_ERROR_INVALID_SIGNATURE = { resultCode: 13, message: MOMO_RESULT_CODES[13] } as const

/** The body MoMo answers an unknown order (resultCode 42). */
export const MOMO_ERROR_NOT_FOUND = { resultCode: 42, message: MOMO_RESULT_CODES[42] } as const

/** The body MoMo answers with an unknown partner or access key (resultCode 11, "unauthorized"). */
export const MOMO_ERROR_UNAUTHORIZED = { resultCode: 11, message: MOMO_RESULT_CODES[11] } as const

/** The body MoMo answers a malformed request (resultCode 20). */
export const MOMO_ERROR_BAD_REQUEST = { resultCode: 20, message: MOMO_RESULT_CODES[20] } as const

/** The body of a duplicated orderId (resultCode 41). */
export const MOMO_ERROR_DUPLICATED_ORDER = { resultCode: 41, message: MOMO_RESULT_CODES[41] } as const

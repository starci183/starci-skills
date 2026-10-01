/**
 * payOS fixtures: the envelope codes and the static error bodies of payOS v2. Typed objects, not JSON files, because tsc does
 * not copy JSON into `dist`. Error envelopes carry `data: null` and `signature: null` as the gateway does.
 */

/** A payOS error envelope. */
export interface PayosErrorBody {
    readonly code: string
    readonly desc: string
    readonly data: null
    readonly signature: null
}

const error = (code: string, desc: string): PayosErrorBody => ({ code, desc, data: null, signature: null })

/** Missing or wrong `x-client-id` / `x-api-key`. */
export const PAYOS_ERROR_UNAUTHORIZED: PayosErrorBody = error("401", "Unauthorized")
/** The signature of the create request does not verify. */
export const PAYOS_ERROR_INVALID_SIGNATURE: PayosErrorBody = error("201", "Chu ky khong hop le (Invalid signature)")
/** The payment request does not exist. */
export const PAYOS_ERROR_NOT_FOUND: PayosErrorBody = error("101", "Khong tim thay lenh thanh toan (Payment request not found)")
/** The orderCode already exists. */
export const PAYOS_ERROR_ORDER_EXISTS: PayosErrorBody = error("231", "orderCode da ton tai (Order code already exists)")
/** Invalid parameters. */
export const PAYOS_ERROR_BAD_REQUEST: PayosErrorBody = error("20", "Tham so khong hop le (Invalid parameters)")
/** The payment was already paid and cannot be cancelled. */
export const PAYOS_ERROR_NOT_CANCELLABLE: PayosErrorBody = error("112", "Khong the huy lenh da thanh toan")
/** The webhook url of `confirm-webhook` did not answer 2xx. */
export const PAYOS_ERROR_WEBHOOK_UNREACHABLE: PayosErrorBody = error("20", "Webhook url invalid (must answer 2xx)")

/** The `status` values of a payment request. */
export type PayosStatus = "PENDING" | "PROCESSING" | "PAID" | "CANCELLED" | "EXPIRED"

/** The webhook `code`/`desc` of a paid transaction. */
export const PAYOS_PAID_DATA_CODE = { code: "00", desc: "Thanh cong" } as const

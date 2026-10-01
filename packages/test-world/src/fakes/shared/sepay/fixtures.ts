/**
 * SePay fixtures: the static bodies of the todo example's fake (`error-unauthorized`, `error-not-found`) as typed objects, and
 * the documented SePay webhook answers. Typed objects, not JSON files, because tsc does not copy JSON into `dist`.
 */

/** The API answer for a missing or wrong API key. */
export const SEPAY_ERROR_UNAUTHORIZED = { error: "unauthorized", message: "Invalid API key" } as const

/** The API answer for an unknown transaction or route. */
export const SEPAY_ERROR_NOT_FOUND = { error: "not_found", message: "Transaction not found" } as const

/** The API answer for a malformed create request. */
export const SEPAY_ERROR_BAD_REQUEST = { error: "bad_request", message: "reference, amount and currency are required" } as const

/** The answer an app gives SePay's webhook when it accepted the transaction (`success: true`, HTTP 200 or 201). */
export const SEPAY_WEBHOOK_ACK = { success: true } as const

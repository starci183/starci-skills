import type { OrderReceiptQuery, OrderReceiptQueryVariables } from "../../__generated__/graphql"

/** The receipt link and when it expires. */
export type QueryOrderReceiptResponse = OrderReceiptQuery["orderReceipt"]

/** The input of `orderReceipt`. */
export type QueryOrderReceiptRequest = OrderReceiptQueryVariables["input"]

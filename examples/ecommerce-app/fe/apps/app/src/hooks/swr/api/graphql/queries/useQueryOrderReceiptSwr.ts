import useSWRMutation from "swr/mutation"
import { queryOrderReceipt } from "@/modules/api/graphql/queries/query-order-receipt"

/** The SWR key of the receipt link query; the order is its identity. */
const QUERY_ORDER_RECEIPT_SWR_KEY = "QUERY_ORDER_RECEIPT_SWR"

/**
 * The receipt link of one order (order `orderReceipt`), asked on demand: each press needs a fresh presigned URL, so the
 * read is triggered rather than cached.
 */
export const useQueryOrderReceiptSwr = (orderId: string) =>
    useSWRMutation([QUERY_ORDER_RECEIPT_SWR_KEY, orderId], () => queryOrderReceipt({ request: { orderId } }))

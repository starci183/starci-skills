import useSWR from "swr"
import { readOrder } from "@/modules/sales"
import type { Order } from "@/modules/types"
import { QUERY_ORDER_SWR_KEY } from "./sales.shared"

/** What a caller must say about the order it wants. */
interface UseQueryOrderSwrParams {
    handoffId?: string
}

/**
 * Reads the order a handoff carries. One api, one slot.
 * No id, no fetch: `null` is SWR's own "not yet".
 */
export const useQueryOrderSwr = ({ handoffId }: UseQueryOrderSwrParams = {}) =>
    useSWR<Order>(
        handoffId === undefined ? null : [QUERY_ORDER_SWR_KEY, handoffId],
        ([, id]: readonly [string, string]) => readOrder(id),
    )

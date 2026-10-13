import useSWR from "swr"
import { getOrder } from "@/modules/api"
import type { Order } from "@/modules/types"

/** The key of every read of this call; the handoff is its identity. */
const QUERY_ORDER_SWR_KEY = "QUERY_ORDER_SWR"

/** What a caller must say about the handoff it wants. */
interface UseGetOrderSwrParams {
    readonly handoffId?: string
}

/** Reads the order a handoff carries. One api, one slot. No id, no request: `null` is SWR's own "not yet". */
export const useGetOrderSwr = ({ handoffId }: UseGetOrderSwrParams = {}) =>
    useSWR<Order>(
        handoffId === undefined ? null : [QUERY_ORDER_SWR_KEY, handoffId],
        ([, id]: readonly [string, string]) => getOrder(id),
    )

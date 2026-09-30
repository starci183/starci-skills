"use client"

import useSWR from "swr"
import { getOrder } from "@/modules/api"
import type { Order } from "@/modules/types"

/** What a caller must say about the order it wants. */
interface UseQueryOrderSwrParams {
    handoffId?: string
}

/** The key prefix, so a mutation can revalidate every order read at once. */
export const QUERY_ORDER_SWR_KEY = "QUERY_ORDER_SWR"

/**
 * Reads the order a handoff carries. One api, one slot.
 * No id, no fetch: `null` is SWR's own "not yet".
 */
export const useQueryOrderSwr = ({ handoffId }: UseQueryOrderSwrParams = {}) =>
    useSWR<Order>(handoffId === undefined ? null : [QUERY_ORDER_SWR_KEY, handoffId], () => getOrder(handoffId as string))

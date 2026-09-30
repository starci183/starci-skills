"use client"

import useSWR from "swr"
import { getHandoff } from "@/modules/api"
import type { Handoff } from "@/modules/types"

/** What a caller must say about the handoff it wants. */
interface UseQueryHandoffSwrParams {
    handoffId?: string
}

/** The key prefix, so a mutation can revalidate every handoff read at once. */
export const QUERY_HANDOFF_SWR_KEY = "QUERY_HANDOFF_SWR"

/** Reads the handoff itself. One api, one slot. */
export const useQueryHandoffSwr = ({ handoffId }: UseQueryHandoffSwrParams = {}) =>
    useSWR<Handoff>(handoffId === undefined ? null : [QUERY_HANDOFF_SWR_KEY, handoffId], () => getHandoff(handoffId as string))

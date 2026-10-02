import useSWR from "swr"
import { readHandoff } from "@/modules/sales"
import type { Handoff } from "@/modules/types"
import { QUERY_HANDOFF_SWR_KEY } from "./sales.shared"

/** What a caller must say about the handoff it wants. */
interface UseQueryHandoffSwrParams {
    handoffId?: string
}

/** Reads the handoff itself. One api, one slot. */
export const useQueryHandoffSwr = ({ handoffId }: UseQueryHandoffSwrParams = {}) =>
    useSWR<Handoff>(
        handoffId === undefined ? null : [QUERY_HANDOFF_SWR_KEY, handoffId],
        ([, id]: readonly [string, string]) => readHandoff(id),
    )

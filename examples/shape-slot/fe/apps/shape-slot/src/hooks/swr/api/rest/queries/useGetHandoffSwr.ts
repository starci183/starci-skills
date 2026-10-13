import useSWR from "swr"
import { getHandoff } from "@/modules/api"
import type { Handoff } from "@/modules/types"

/** The key of every read of this call; the handoff is its identity. */
const QUERY_HANDOFF_SWR_KEY = "QUERY_HANDOFF_SWR"

/** What a caller must say about the handoff it wants. */
interface UseGetHandoffSwrParams {
    readonly handoffId?: string
}

/** Reads the handoff itself. One api, one slot. No id, no request: `null` is SWR's own "not yet". */
export const useGetHandoffSwr = ({ handoffId }: UseGetHandoffSwrParams = {}) =>
    useSWR<Handoff>(
        handoffId === undefined ? null : [QUERY_HANDOFF_SWR_KEY, handoffId],
        ([, id]: readonly [string, string]) => getHandoff(id),
    )

import useSWR from "swr"
import { getSendAttempts } from "@/modules/api"
import type { SendAttempt } from "@/modules/types"

/** The key of every read of this call; the handoff is its identity. */
const QUERY_SEND_ATTEMPTS_SWR_KEY = "QUERY_SEND_ATTEMPTS_SWR"

/** What a caller must say about the handoff it wants. */
interface UseGetSendAttemptsSwrParams {
    readonly handoffId?: string
}

/** Reads the send attempts of a handoff. One api, one slot. No id, no request: `null` is SWR's own "not yet". */
export const useGetSendAttemptsSwr = ({ handoffId }: UseGetSendAttemptsSwrParams = {}) =>
    useSWR<ReadonlyArray<SendAttempt>>(
        handoffId === undefined ? null : [QUERY_SEND_ATTEMPTS_SWR_KEY, handoffId],
        ([, id]: readonly [string, string]) => getSendAttempts(id),
    )

import useSWR from "swr"
import { readSendAttempts } from "@/modules/sales"
import type { SendAttempt } from "@/modules/types"
import { QUERY_SEND_ATTEMPTS_SWR_KEY } from "./sales.shared"

/** What a caller must say about the attempts it wants. */
interface UseQuerySendAttemptsSwrParams {
    handoffId?: string
}

/** Reads the send attempts of a handoff. One api, one slot. */
export const useQuerySendAttemptsSwr = ({ handoffId }: UseQuerySendAttemptsSwrParams = {}) =>
    useSWR<ReadonlyArray<SendAttempt>>(
        handoffId === undefined ? null : [QUERY_SEND_ATTEMPTS_SWR_KEY, handoffId],
        ([, id]: readonly [string, string]) => readSendAttempts(id),
    )

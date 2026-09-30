"use client"

import useSWR from "swr"
import { getSendAttempts } from "@/modules/api"
import type { SendAttempt } from "@/modules/types"

/** What a caller must say about the attempts it wants. */
interface UseQuerySendAttemptsSwrParams {
    handoffId?: string
}

/** The key prefix, so a mutation can revalidate every attempts read at once. */
export const QUERY_SEND_ATTEMPTS_SWR_KEY = "QUERY_SEND_ATTEMPTS_SWR"

/** Reads the send attempts of a handoff. One api, one slot. */
export const useQuerySendAttemptsSwr = ({ handoffId }: UseQuerySendAttemptsSwrParams = {}) =>
    useSWR<ReadonlyArray<SendAttempt>>(
        handoffId === undefined ? null : [QUERY_SEND_ATTEMPTS_SWR_KEY, handoffId],
        () => getSendAttempts(handoffId as string),
    )

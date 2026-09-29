"use client"

import { useSWRConfig } from "swr"
import useSWRMutation from "swr/mutation"
import { sendHandoff, type Handoff, type SendInput } from "@/modules/api/sales"
import { QUERY_HANDOFF_SWR_KEY } from "./useQueryHandoffSwr"
import { QUERY_SEND_ATTEMPTS_SWR_KEY } from "./useQuerySendAttemptsSwr"

/** The key prefix of the send command. */
export const MUTATE_SEND_HANDOFF_SWR_KEY = "MUTATE_SEND_HANDOFF_SWR"

/** The trigger argument: the exact revision the sender saw. */
export type MutateSendHandoffSwrArg = SendInput

/**
 * Sends a handoff to accounting. On success it revalidates the two reads it made stale,
 * by key prefix, so every block showing them refreshes and none keeps the old answer.
 */
export const useMutateSendHandoffSwr = (handoffId?: string) => {
    const { mutate } = useSWRConfig()
    return useSWRMutation<Handoff, Error, readonly [string, string] | null, MutateSendHandoffSwrArg>(
        handoffId === undefined ? null : [MUTATE_SEND_HANDOFF_SWR_KEY, handoffId],
        async (key, { arg }) => sendHandoff(key[1], arg),
        {
            onSuccess: () => {
                const stale = (key: unknown) =>
                    Array.isArray(key) && key[1] === handoffId && (key[0] === QUERY_HANDOFF_SWR_KEY || key[0] === QUERY_SEND_ATTEMPTS_SWR_KEY)
                void mutate(stale)
            },
        },
    )
}

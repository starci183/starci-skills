import useSWRMutation from "swr/mutation"
import { postSendHandoff } from "@/modules/api"
import type { Handoff, SendInput } from "@/modules/types"

/** The key of the send command; the handoff is its identity. */
const MUTATE_SEND_HANDOFF_SWR_KEY = "MUTATE_SEND_HANDOFF_SWR"

/** What one trigger of the command carries: the exact revision the sender saw. */
type Trigger = { readonly arg: SendInput }

/** Sends a handoff to accounting; the caller revalidates the reads the send changed. */
export const usePostSendHandoffSwr = (handoffId?: string) =>
    useSWRMutation<Handoff, Error, readonly [string, string] | null, SendInput>(
        handoffId === undefined ? null : [MUTATE_SEND_HANDOFF_SWR_KEY, handoffId],
        (key: readonly [string, string], { arg }: Trigger) => postSendHandoff(key[1], arg),
    )

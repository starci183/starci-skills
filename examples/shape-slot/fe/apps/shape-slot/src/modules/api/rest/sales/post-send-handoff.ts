import { restClient } from "../client/axios"
import { handoffSchema } from "./sales.mapper"
import type { Handoff, SendInput } from "@/modules/types"

/**
 * Sends a handoff to accounting at the revision the sender saw (`POST /sales/handoffs/:id/send`); the answer is the
 * handoff after the send, validated against its wire schema.
 */
export const postSendHandoff = async (handoffId: string, input: SendInput, signal?: AbortSignal): Promise<Handoff> => {
    const response = await restClient.post<unknown>(
        `/sales/handoffs/${handoffId}/send`,
        input,
        signal === undefined ? {} : { signal },
    )
    return handoffSchema.parse(response.data)
}

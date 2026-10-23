import { restClient } from "../client/axios"
import { sendAttemptsSchema } from "./sales.mapper"
import type { SendAttempt } from "@/modules/types"

/** Reads the send attempts of a handoff (`GET /sales/handoffs/:id/attempts`), validated against their wire schema. */
export const getSendAttempts = async (handoffId: string, signal?: AbortSignal): Promise<ReadonlyArray<SendAttempt>> => {
    const response = await restClient.get<unknown>(`/sales/handoffs/${handoffId}/attempts`, signal === undefined ? {} : { signal })
    return sendAttemptsSchema.parse(response.data)
}

import { restClient } from "../client/axios"
import { handoffSchema } from "./sales.mapper"
import type { Handoff } from "@/modules/types"

/** Reads the handoff itself (`GET /sales/handoffs/:id`), validated against its wire schema. */
export const getHandoff = async (handoffId: string, signal?: AbortSignal): Promise<Handoff> => {
    const response = await restClient.get<unknown>(`/sales/handoffs/${handoffId}`, { signal })
    return handoffSchema.parse(response.data)
}

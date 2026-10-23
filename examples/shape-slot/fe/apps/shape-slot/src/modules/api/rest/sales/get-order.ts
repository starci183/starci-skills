import { restClient } from "../client/axios"
import { orderSchema } from "./sales.mapper"
import type { Order } from "@/modules/types"

/** Reads the order a handoff carries (`GET /sales/handoffs/:id/order`), validated against its wire schema. */
export const getOrder = async (handoffId: string, signal?: AbortSignal): Promise<Order> => {
    const response = await restClient.get<unknown>(
        `/sales/handoffs/${handoffId}/order`,
        signal === undefined ? {} : { signal },
    )
    return orderSchema.parse(response.data)
}

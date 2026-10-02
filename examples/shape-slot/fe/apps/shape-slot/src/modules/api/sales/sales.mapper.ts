import { z } from "zod"
import type { Handoff, Order, SendAttempt } from "@/modules/types"

/** The wire shape of one order line. */
const orderLineSchema = z.object({ sku: z.string(), qty: z.number() })

/** The wire shape of the order a handoff carries. */
export const orderSchema: z.ZodType<Order> = z.object({
    code: z.string(),
    customer: z.string(),
    amount: z.number(),
    lines: z.array(orderLineSchema),
})

/** The wire shape of a sales handoff. */
export const handoffSchema: z.ZodType<Handoff> = z.object({
    status: z.enum(["prepared", "sent", "returned"]),
    fingerprint: z.string(),
    revision: z.number(),
    receiptId: z.string().optional(),
    reason: z.string().optional(),
})

/** The wire shape of the recorded send attempts. */
export const sendAttemptsSchema: z.ZodType<ReadonlyArray<SendAttempt>> = z.array(
    z.object({ id: z.string(), at: z.string(), result: z.string() }),
)

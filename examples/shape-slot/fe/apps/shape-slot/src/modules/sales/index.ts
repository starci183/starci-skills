import type { z } from "zod"
import { appConfig } from "../config"
import {
    handoffSchema,
    orderSchema,
    request,
    sendAttemptsSchema,
    statusOfOutcome,
    type RequestInput,
} from "@/modules/api"
import type { Handoff, Order, SendAttempt, SendInput } from "@/modules/types"

/** A failed call, carrying only the status `toSlot` reads. */
type ApiError = { readonly status: number }

/** The base every sales call takes: the configured API origin plus the path. */
const salesUrl = (path: string) => `${appConfig.apiBaseUrl}${path}`

/**
 * One call to the sales API: through the one client, so every answer is an `Outcome`; a not-ok answer throws
 * only its status, and an ok answer is validated against its wire schema before it reaches a hook. A payload
 * the schema refuses throws too: the wire said something the app cannot draw, and that is an error like any other.
 */
const callSales = async <T>(input: RequestInput, schema: z.ZodType<T>): Promise<T> => {
    const outcome = await request({ ...input, url: salesUrl(input.url) })
    if (outcome.kind !== "ok") {
        const error: ApiError = { status: statusOfOutcome(outcome) }
        throw error
    }
    return schema.parse(outcome.value)
}

/** Reads the order a handoff carries. */
export const readOrder = (handoffId: string) => callSales({ url: `/sales/handoffs/${handoffId}/order` }, orderSchema)

/** Reads the handoff itself. */
export const readHandoff = (handoffId: string) => callSales({ url: `/sales/handoffs/${handoffId}` }, handoffSchema)

/** Reads the send attempts of a handoff. */
export const readSendAttempts = (handoffId: string) =>
    callSales({ url: `/sales/handoffs/${handoffId}/attempts` }, sendAttemptsSchema)

/** Sends a handoff to accounting at the revision the sender saw. */
export const sendHandoff = (handoffId: string, input: SendInput): Promise<Handoff> =>
    callSales({ url: `/sales/handoffs/${handoffId}/send`, method: "POST", body: input }, handoffSchema)

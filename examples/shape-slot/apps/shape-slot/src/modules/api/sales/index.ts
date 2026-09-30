import { request, type RequestInput } from "../client"
import { statusOfOutcome } from "../outcome"
import type { Handoff, Order, SendAttempt, SendInput } from "@/modules/types"

/** A failed request, carrying only its HTTP status. */
type ApiError = { readonly status: number }

/** Reads through the one client and hands SWR a value or a thrown status, the shape `toSlot` reads. */
const read = async <T,>(input: RequestInput): Promise<T> => {
    const outcome = await request<T>(input)
    if (outcome.kind === "ok") return outcome.value
    const error: ApiError = { status: statusOfOutcome(outcome) }
    throw error
}

/** Reads the order a handoff carries. */
export const getOrder = (handoffId: string) => read<Order>({ path: `/sales/handoffs/${handoffId}/order` })

/** Reads the handoff itself. */
export const getHandoff = (handoffId: string) => read<Handoff>({ path: `/sales/handoffs/${handoffId}` })

/** Reads the send attempts of a handoff. */
export const getSendAttempts = (handoffId: string) =>
    read<ReadonlyArray<SendAttempt>>({ path: `/sales/handoffs/${handoffId}/attempts` })

/** Sends a handoff to accounting at the revision the sender saw. */
export const sendHandoff = (handoffId: string, input: SendInput) =>
    read<Handoff>({ path: `/sales/handoffs/${handoffId}/send`, method: "POST", body: input })

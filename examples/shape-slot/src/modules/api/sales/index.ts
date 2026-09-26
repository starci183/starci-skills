/** One order line as the sales API returns it. */
export type OrderLine = { readonly sku: string; readonly qty: number }

/** The order a handoff carries. */
export type Order = {
    readonly code: string
    readonly customer: string
    readonly amount: number
    readonly lines: ReadonlyArray<OrderLine>
}

/** Where a handoff stands; each value is one drawn shape of HandoffBlock. */
export type HandoffStatus = "prepared" | "sent" | "returned"

/** A sales handoff to accounting. */
export type Handoff = {
    readonly status: HandoffStatus
    readonly fingerprint: string
    readonly revision: number
    readonly receiptId?: string
    readonly reason?: string
}

/** One recorded send attempt. */
export type SendAttempt = { readonly id: string; readonly at: string; readonly result: string }

/** What a send needs: the exact revision the sender saw. */
export type SendInput = { readonly fingerprint: string; readonly revision: number }

/** A failed request, carrying only its HTTP status. */
export type ApiError = { readonly status: number }

const request = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(`/api${path}`, init)
    if (!response.ok) {
        const error: ApiError = { status: response.status }
        throw error
    }
    return (await response.json()) as T
}

/** Reads the order a handoff carries. */
export const getOrder = (handoffId: string) => request<Order>(`/sales/handoffs/${handoffId}/order`)

/** Reads the handoff itself. */
export const getHandoff = (handoffId: string) => request<Handoff>(`/sales/handoffs/${handoffId}`)

/** Reads the send attempts of a handoff. */
export const getSendAttempts = (handoffId: string) =>
    request<ReadonlyArray<SendAttempt>>(`/sales/handoffs/${handoffId}/attempts`)

/** Sends a handoff to accounting at the revision the sender saw. */
export const sendHandoff = (handoffId: string, input: SendInput) =>
    request<Handoff>(`/sales/handoffs/${handoffId}/send`, { method: "POST", body: JSON.stringify(input) })

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

/**
 * The data status of ONE api. Every field is an atom, so a slot may cross into a pure Base.
 * A block with three apis carries three slots, and each renders its own status independently.
 */
export type Slot<T> = {
    readonly isLoading?: boolean
    readonly isForbidden?: boolean
    readonly isError?: boolean
    readonly items?: T
}

/** Resolved copy of the data-status recipe for one slot. */
export type SlotLabels = {
    readonly empty: string
    readonly forbidden: string
    readonly error: string
    readonly retry: string
}

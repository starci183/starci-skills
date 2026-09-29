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

/** The part of a query result a slot is derived from. */
export type SlotSource<T> = {
    readonly data?: T
    readonly isLoading: boolean
    readonly error?: { readonly status?: number }
}

/** Folds a query result into a slot; 403 is its own status, never a generic error. */
export const toSlot = <T,>(source: SlotSource<T>): Slot<T> => ({
    isLoading: source.isLoading,
    isForbidden: source.error?.status === 403,
    isError: source.error !== undefined && source.error.status !== 403,
    items: source.data,
})

/** Resolved copy of the data-status recipe for one slot. */
export type SlotLabels = {
    readonly empty: string
    readonly forbidden: string
    readonly error: string
    readonly retry: string
}

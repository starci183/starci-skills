import type { Slot } from "@/modules/types"

/** The part of a query result a slot is derived from. */
type SlotSource<T> = {
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

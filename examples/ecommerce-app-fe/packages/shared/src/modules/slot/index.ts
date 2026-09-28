/** Settled data status of one server read, separate from the page's drawn shape. */
export type Slot<T> =
    | { readonly status: "error" }
    | { readonly status: "empty" }
    | { readonly status: "ready"; readonly items: T }

/** Fold a successful collection or a failed read into one settled slot. */
export const collectionSlot = <T,>(items: ReadonlyArray<T> | null): Slot<ReadonlyArray<T>> => {
    if (items === null) return { status: "error" }
    if (items.length === 0) return { status: "empty" }
    return { status: "ready", items }
}

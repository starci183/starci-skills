import type { ReactNode } from "react"
import { StateBlock } from "../../leaves/StateBlock"

/** Settled data status of one server read, separate from the page's drawn shape. */
export type Slot<T> =
    { readonly status: "error" } | { readonly status: "empty" } | { readonly status: "ready"; readonly items: T }

/** Fold a successful collection or a failed read into one settled slot. */
export const collectionSlot = <T,>(items: ReadonlyArray<T> | null): Slot<ReadonlyArray<T>> => {
    if (items === null) return { status: "error" }
    if (items.length === 0) return { status: "empty" }
    return { status: "ready", items }
}

/** The words a settled data slot says when it is empty and when its read failed. */
export type SlotLabels = {
    readonly emptyTitle: string
    readonly emptyDescription: string
    readonly errorTitle: string
    readonly errorDescription: string
}

/** The words and optional empty action for one settled data slot. */
export type SlotViewProps<T> = {
    readonly slot: Slot<T>
    readonly labels: SlotLabels
    readonly emptyMascot?: boolean
    readonly emptyAction?: ReactNode
    readonly children: (items: T) => ReactNode
}

/** Shared data status recipe; each page supplies only its ready tree and resolved copy. */
export const SlotView = <T,>(props: SlotViewProps<T>) => {
    const { slot, labels, emptyMascot, emptyAction, children } = props
    if (slot.status === "error") {
        return <StateBlock title={labels.errorTitle} description={labels.errorDescription} />
    }
    if (slot.status === "empty") {
        return (
            <StateBlock mascot={emptyMascot} title={labels.emptyTitle} description={labels.emptyDescription}>
                {emptyAction}
            </StateBlock>
        )
    }
    return <>{children(slot.items)}</>
}

"use client"

import type { ReactNode } from "react"
import { StateBlock } from "../../leaves/StateBlock"
import type { Slot } from "../../../modules/slot"

/** The words and optional empty action for one settled data slot. */
export type SlotViewProps<T> = {
    readonly slot: Slot<T>
    readonly labels: {
        readonly emptyTitle: string
        readonly emptyDescription: string
        readonly errorTitle: string
        readonly errorDescription: string
    }
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
        return <StateBlock mascot={emptyMascot} title={labels.emptyTitle} description={labels.emptyDescription}>{emptyAction}</StateBlock>
    }
    return <>{children(slot.items)}</>
}

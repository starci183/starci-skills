"use client"

import type { CSSProperties, DragEventHandler, ReactNode } from "react"

export type DragItemProps = {
    /** Include a published control that provides the same operation without dragging. */
    readonly children: ReactNode
    readonly isDisabled?: boolean
    readonly onDragStart?: DragEventHandler<HTMLDivElement>
    readonly onDragEnd?: DragEventHandler<HTMLDivElement>
    readonly isSelected?: boolean
    readonly isInvalid?: boolean
    readonly isDashed?: boolean
    /** Caller-owned category colour; never the only indication of category or validity. */
    readonly leadingColor?: string
}

/** A native drag source with Grammar-owned state paint; its child control supplies keyboard operation. */
export const DragItem = ({ children, isDisabled = false, onDragStart, onDragEnd, isSelected = false, isInvalid = false, isDashed = false, leadingColor }: DragItemProps) => (
    <div
        className="starci-core-drag-item"
        data-component="DragItem"
        data-tier="branch"
        data-grammar-selected={isSelected ? "true" : "false"}
        data-grammar-invalid={isInvalid ? "true" : "false"}
        data-grammar-dashed={isDashed ? "true" : "false"}
        draggable={!isDisabled}
        {...(leadingColor === undefined ? {} : { style: { "--starci-drag-item-leading": leadingColor } as CSSProperties })}
        {...(isDisabled || onDragStart === undefined ? {} : { onDragStart })}
        {...(isDisabled || onDragEnd === undefined ? {} : { onDragEnd })}
    >
        {children}
    </div>
)

"use client"

import { Tag as HeroTag, TagGroup as HeroTagGroup, type Selection } from "@heroui/react"
import type { ReactNode } from "react"
import { navigationClassName } from "../../navigationClassNames.js"

export type TagGroupItem = {
    readonly id: string
    readonly label: string
    readonly leading?: ReactNode
    readonly isDisabled?: boolean
}

type TagGroupRemoval = {
    /** Present only for removable chips. Delete/Backspace on a focused chip also removes it. */
    readonly onRemove: (ids: ReadonlyArray<string>) => void
    /** App-owned accessible name of a chip's remove button, e.g. "Remove Design". */
    readonly removeLabel: (label: string) => string
} | {
    readonly onRemove?: undefined
    readonly removeLabel?: undefined
}

export type TagGroupProps = TagGroupRemoval & {
    /** Names the set of tags/chips, e.g. "Filters". */
    readonly label: string
    readonly items: ReadonlyArray<TagGroupItem>
    /** `none` renders static chips; `single`/`multiple` make them selectable filter chips. */
    readonly selectionMode?: "none" | "single" | "multiple"
    readonly selectedIds?: ReadonlyArray<string>
    readonly defaultSelectedIds?: ReadonlyArray<string>
    readonly onSelectionChange?: (ids: ReadonlyArray<string>) => void
    /** Shown when no items remain. */
    readonly emptyContent?: ReactNode
    readonly size?: "sm" | "md" | "lg"
    readonly className?: string
}

const toIds = (selection: Selection, items: ReadonlyArray<TagGroupItem>): ReadonlyArray<string> => selection === "all"
    ? items.map((item) => item.id)
    : [...selection].map(String)

/**
 * Chips/tags: static labels, selectable filters, or removable tokens.
 *
 * Built on the vendor TagGroup, so arrow keys move between chips, Space/Enter toggle selection
 * and Delete/Backspace remove. Each chip exposes `data-grammar-selected`; chips wrap onto new lines
 * at narrow widths instead of overflowing.
 */
export const TagGroup = ({
    label,
    items,
    selectionMode = "none",
    selectedIds,
    defaultSelectedIds,
    onSelectionChange,
    onRemove,
    removeLabel,
    emptyContent,
    size = "md",
    className,
}: TagGroupProps) => (
    <HeroTagGroup
        aria-label={label}
        className={navigationClassName("starci-core-tag-group", className)}
        data-component="TagGroup"
        data-tier="composite"
        data-grammar-tag-selection={selectionMode}
        data-grammar-tag-removable={onRemove === undefined ? "false" : "true"}
        selectionMode={selectionMode}
        size={size}
        {...(selectedIds === undefined ? {} : { selectedKeys: new Set(selectedIds) })}
        {...(defaultSelectedIds === undefined ? {} : { defaultSelectedKeys: new Set(defaultSelectedIds) })}
        {...(onSelectionChange === undefined ? {} : { onSelectionChange: (selection: Selection) => onSelectionChange(toIds(selection, items)) })}
        {...(onRemove === undefined ? {} : { onRemove: (keys: Set<string | number>) => onRemove([...keys].map(String)) })}
    >
        <HeroTagGroup.List
            className="starci-core-tag-list"
            {...(emptyContent === undefined ? {} : { renderEmptyState: () => <span className="starci-core-tag-empty" data-grammar-tag-empty="true">{emptyContent}</span> })}
        >
            {items.map((item) => (
                <HeroTag
                    key={item.id}
                    id={item.id}
                    className="starci-core-tag"
                    data-grammar-tag="true"
                    textValue={item.label}
                    {...(item.isDisabled === undefined ? {} : { isDisabled: item.isDisabled })}
                >
                    {({ isSelected, allowsRemoving }) => <>
                        <span className="starci-core-tag-label" data-grammar-tag-label="true" data-grammar-selected={isSelected ? "true" : "false"}>
                            {item.leading === undefined ? null : <span aria-hidden="true" className="starci-core-tag-leading">{item.leading}</span>}
                            {item.label}
                        </span>
                        {allowsRemoving ? <HeroTag.RemoveButton aria-label={removeLabel?.(item.label) ?? item.label} className="starci-core-tag-remove" data-grammar-tag-remove="true" /> : null}
                    </>}
                </HeroTag>
            ))}
        </HeroTagGroup.List>
    </HeroTagGroup>
)

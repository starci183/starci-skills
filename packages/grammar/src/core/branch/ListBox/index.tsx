"use client"

import { ListBox as HeroListBox, type Selection } from "@heroui/react"
import type { ReactNode } from "react"
import { navigationClassName } from "../../navigationClassNames.js"

export type ListBoxItem = {
    readonly id: string
    readonly label: string
    readonly description?: ReactNode
    readonly leading?: ReactNode
    readonly trailing?: ReactNode
    readonly isDisabled?: boolean
}

export type ListBoxProps = {
    /** Names the list, e.g. "Members". */
    readonly label: string
    readonly items: ReadonlyArray<ListBoxItem>
    /** `none` makes an actionable (not selectable) list; rows then only fire `onAction`. */
    readonly selectionMode?: "none" | "single" | "multiple"
    readonly selectedIds?: ReadonlyArray<string>
    readonly defaultSelectedIds?: ReadonlyArray<string>
    readonly onSelectionChange?: (ids: ReadonlyArray<string>) => void
    readonly onAction?: (id: string) => void
    readonly emptyContent?: ReactNode
    readonly className?: string
}

/**
 * A list of selectable or actionable rows (`role="listbox"`). Arrow keys, Home/End and typeahead
 * move between rows; Space/Enter select. Each row exposes `data-grammar-selected` and the
 * vendor `aria-selected`; long labels truncate and descriptions wrap at narrow widths.
 * Contract: list FOCUS-2 CONTROL-STATE-3, empty STATE-3, leading glyph ICON-6.
 */
export const ListBox = ({
    label,
    items,
    selectionMode = "single",
    selectedIds,
    defaultSelectedIds,
    onSelectionChange,
    onAction,
    emptyContent,
    className,
}: ListBoxProps) => (
    <HeroListBox
        aria-label={label}
        className={navigationClassName("starci-core-list-box", className)}
        data-component="ListBox"
        data-contract="FOCUS-2 CONTROL-STATE-3"
        data-tier="branch"
        data-grammar-list-selection={selectionMode}
        selectionMode={selectionMode}
        {...(selectedIds === undefined ? {} : { selectedKeys: new Set(selectedIds) })}
        {...(defaultSelectedIds === undefined ? {} : { defaultSelectedKeys: new Set(defaultSelectedIds) })}
        {...(onSelectionChange === undefined ? {} : {
            onSelectionChange: (selection: Selection) => onSelectionChange(selection === "all" ? items.map((item) => item.id) : [...selection].map(String)),
        })}
        {...(onAction === undefined ? {} : { onAction: (key: string | number) => onAction(String(key)) })}
        {...(emptyContent === undefined ? {} : { renderEmptyState: () => <div className="starci-core-list-box-empty" data-contract="STATE-3" data-grammar-list-empty="true">{emptyContent}</div> })}
    >
        {items.map((item) => (
            <HeroListBox.Item
                key={item.id}
                id={item.id}
                className="starci-core-list-box-item"
                data-grammar-list-item="true"
                textValue={item.label}
                {...(item.isDisabled === undefined ? {} : { isDisabled: item.isDisabled })}
            >
                {({ isSelected }: { readonly isSelected: boolean }) => (
                    <span className="starci-core-list-box-row" data-grammar-selected={isSelected ? "true" : "false"}>
                        {item.leading === undefined ? null : <span aria-hidden="true" className="starci-core-list-box-leading" data-contract="ICON-6">{item.leading}</span>}
                        <span className="starci-core-list-box-copy">
                            <span className="starci-core-list-box-label">{item.label}</span>
                            {item.description === undefined ? null : <span className="starci-core-list-box-description">{item.description}</span>}
                        </span>
                        {item.trailing === undefined ? null : <span className="starci-core-list-box-trailing">{item.trailing}</span>}
                        {selectionMode === "none" ? null : <HeroListBox.ItemIndicator className="starci-core-list-box-indicator" />}
                    </span>
                )}
            </HeroListBox.Item>
        ))}
    </HeroListBox>
)

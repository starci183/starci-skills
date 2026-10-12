"use client"

import { ListBox as HeroListBox, type Selection } from "@heroui/react"
import type { ComponentPropsWithRef, ReactNode } from "react"
import { navigationClassName } from "../../navigationClassNames.js"
import { Skeleton } from "../../primitive/Skeleton/index.js"

export type ListBoxItem = {
    readonly id: string
    readonly label: string
    readonly description?: ReactNode
    readonly leading?: ReactNode
    readonly trailing?: ReactNode
    readonly isDisabled?: boolean
}

const clampRows = (rows: number) => Math.min(12, Math.max(1, Math.floor(Number.isFinite(rows) ? rows : 3)))

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
    /**
     * The options are loading (knowledge STATE-8). With no `items` it draws `loadingRows` skeleton options (a label line and a
     * description line, `aria-hidden`) inside the same named list, which is `aria-busy`; real `items` win, and loading beats
     * `emptyContent`.
     */
    readonly isLoading?: boolean
    /** How many skeleton options a loading list draws (default 3, 1 to 12). */
    readonly loadingRows?: number
    readonly className?: string
}

/**
 * A list of selectable or actionable rows (`role="listbox"`). Arrow keys, Home/End and typeahead
 * move between rows; Space/Enter select. Each row exposes `data-grammar-selected` and the
 * vendor `aria-selected`; long labels truncate and descriptions wrap at narrow widths.
 * Contract: list FOCUS-2 STATE-1, empty STATE-3, leading glyph A11Y-2.
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
    isLoading = false,
    loadingRows = 3,
    className,
}: ListBoxProps) => (
    <HeroListBox
        aria-label={label}
        className={navigationClassName("starci-core-list-box", className)}
        data-component="ListBox"
        data-contract="FOCUS-2 STATE-1"
        data-tier="branch"
        data-loading={String(isLoading)}
        {...(isLoading ? { render: (domProps: ComponentPropsWithRef<"div">) => <div {...domProps} aria-busy="true" /> } : {})}
        data-grammar-list-selection={selectionMode}
        selectionMode={selectionMode}
        {...(selectedIds === undefined ? {} : { selectedKeys: new Set(selectedIds) })}
        {...(defaultSelectedIds === undefined ? {} : { defaultSelectedKeys: new Set(defaultSelectedIds) })}
        {...(onSelectionChange === undefined ? {} : {
            onSelectionChange: (selection: Selection) => onSelectionChange(selection === "all" ? items.map((item) => item.id) : [...selection].map(String)),
        })}
        {...(onAction === undefined ? {} : { onAction: (key: string | number) => onAction(String(key)) })}
        {...(isLoading
            ? {
                renderEmptyState: () => (
                    <div className="starci-core-list-box-skeleton" data-grammar-list-skeleton="true">
                        {Array.from({ length: clampRows(loadingRows) }, (_, index) => (
                            <div key={index} aria-hidden="true" className="starci-core-list-box-item starci-core-list-box-skeleton-option" data-grammar-skeleton="true">
                                <span className="starci-core-list-box-copy">
                                    <span className="starci-core-list-box-label"><Skeleton shape="text" /></span>
                                    <span className="starci-core-list-box-description"><Skeleton shape="text" /></span>
                                </span>
                            </div>
                        ))}
                    </div>
                ),
            }
            : emptyContent === undefined ? {} : { renderEmptyState: () => <div className="starci-core-list-box-empty" data-contract="STATE-3" data-grammar-list-empty="true">{emptyContent}</div> })}
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
                        {item.leading === undefined ? null : <span aria-hidden="true" className="starci-core-list-box-leading" data-contract="A11Y-2">{item.leading}</span>}
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

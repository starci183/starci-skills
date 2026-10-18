"use client"

import { Checkbox as HeroCheckbox, Table as HeroTable, type Selection, type SortDescriptor } from "@heroui/react"
import { useState, type CSSProperties, type DragEventHandler, type KeyboardEvent, type MouseEvent, type ReactNode } from "react"
import { Skeleton } from "../../primitive/Skeleton/index.js"
import { navigationClassName } from "../../navigationClassNames.js"

export type DataTableColumn = {
    readonly id: string
    readonly label: string
    /** The column that names each row for assistive technology. Defaults to the first column. */
    readonly isRowHeader?: boolean
    readonly allowsSorting?: boolean
    readonly align?: "start" | "end"
}

export type DataTableSort = {
    readonly columnId: string
    readonly direction: "ascending" | "descending"
}

export type DataTableRow = { readonly id: string }

/** Cell effects belong to the caller; the table owns cell semantics, focus and activation. */
export type DataTableCellInteraction = {
    /** Invoked by a cell click or Enter/Space on the focused cell, excluding nested controls. */
    readonly onAction?: () => void
    readonly onDragOver?: DragEventHandler<HTMLTableCellElement>
    readonly onDragLeave?: DragEventHandler<HTMLTableCellElement>
    readonly onDrop?: DragEventHandler<HTMLTableCellElement>
    readonly isHighlighted?: boolean
    readonly tone?: "neutral" | "muted"
}

export type DataTableProps<Row extends DataTableRow> = {
    /** Names the table, e.g. "Invoices". */
    readonly label: string
    readonly columns: ReadonlyArray<DataTableColumn>
    readonly rows: ReadonlyArray<Row>
    readonly renderCell: (row: Row, columnId: string) => ReactNode
    /** Optional cell actions and native drop events. An actionable cell receives arrow-key focus itself. */
    readonly getCellInteraction?: (row: Row, columnId: string) => DataTableCellInteraction | undefined
    /** Controlled sort. Sorting the rows stays with the app; the table announces `aria-sort`. */
    readonly sort?: DataTableSort
    readonly onSortChange?: (sort: DataTableSort) => void
    readonly selectionMode?: "none" | "single" | "multiple"
    readonly selectedIds?: ReadonlyArray<string> | "all"
    readonly defaultSelectedIds?: ReadonlyArray<string> | "all"
    readonly onSelectionChange?: (ids: ReadonlyArray<string> | "all") => void
    /** App-owned accessible names of the selection checkboxes in multiple mode. */
    readonly selectAllLabel?: string
    readonly selectRowLabel?: (row: Row) => string
    /**
     * Marks the table busy and replaces the rows (knowledge STATE-8). With no `loadingContent` the real column headers stay
     * and the body draws `loadingRows` skeleton rows; `loadingContent` replaces the body with that content instead.
     */
    readonly isLoading?: boolean
    /** Skeleton rows drawn while loading without `loadingContent` (default 3, 1 to 12). */
    readonly loadingRows?: number
    readonly loadingContent?: ReactNode
    /** Shown when there are no rows and the table is not loading. */
    readonly emptyContent: ReactNode
    /** Keep the column header visible while the body scrolls inside `maxBlockSize`. */
    readonly stickyHeader?: boolean
    /** Bounds the body so the table owns vertical scroll, e.g. "24rem". */
    readonly maxBlockSize?: string
    readonly onRowAction?: (id: string) => void
    readonly className?: string
}

/** The row primitive filters aria-hidden out of its props, so the skeleton rows take it by ref (knowledge STATE-8). */
const hideFromAssistiveTechnology = (node: HTMLElement | null) => node?.setAttribute("aria-hidden", "true")

const SELECTION_COLUMN = "starci-data-table-selection"

// Labels activate their associated inputs; editable content, media and ARIA widgets own their gestures too.
const CELL_CONTROL_SELECTOR = [
    "button", "a", "input", "select", "textarea", "label", "summary",
    "audio[controls]", "video[controls]", '[contenteditable]:not([contenteditable="false"])',
    '[tabindex]:not([tabindex="-1"])',
    ...["button", "link", "checkbox", "combobox", "listbox", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "radio", "searchbox", "slider", "spinbutton", "switch", "tab", "textbox", "treeitem"].map((role) => `[role="${role}"]`),
].join(",")

const isNestedCellControl = (target: EventTarget, cell: HTMLTableCellElement): boolean => {
    if (!(target instanceof Element)) return false
    const control = target.closest(CELL_CONTROL_SELECTOR)
    return control !== null && control !== cell && cell.contains(control)
}

const toSortDescriptor = (sort: DataTableSort): SortDescriptor => ({ column: sort.columnId, direction: sort.direction })

const toIds = (selection: Selection): ReadonlyArray<string> | "all" => selection === "all" ? "all" : [...selection].map(String)

const toSelection = (ids: ReadonlyArray<string> | "all"): Selection => ids === "all" ? "all" : new Set(ids)

const SelectionCheckbox = ({ label }: { readonly label: string | undefined }) => (
    <HeroCheckbox className="starci-core-data-table-checkbox" slot="selection" {...(label === undefined ? {} : { "aria-label": label })}>
        <HeroCheckbox.Content>
            <HeroCheckbox.Control>
                <HeroCheckbox.Indicator />
            </HeroCheckbox.Control>
        </HeroCheckbox.Content>
    </HeroCheckbox>
)

/*
 * Consumer hooks: `starci-core-data-table-sort`, `starci-core-data-table-body`,
 * `starci-core-data-table-checkbox` name HeroUI parts whose vendor paint Common leaves as it is. No
 * shipped sheet paints them; the Grammar name lets a consumer or family select those parts without
 * reaching for vendor class names.
 */

/**
 * Tabular data with sortable columns (`aria-sort`), row selection (`aria-selected`,
 * `data-grammar-selected`), empty and loading states, an optional sticky header, and its own
 * horizontal scroll so a wide table never widens a 360px page.
 * Contract: scroll LAYOUT-3, grid FOCUS-2 STATE-1, row FOCUS-1, empty STATE-3.
 */
export const DataTable = <Row extends DataTableRow>({
    label,
    columns,
    rows,
    renderCell,
    getCellInteraction,
    sort,
    onSortChange,
    selectionMode = "none",
    selectedIds,
    defaultSelectedIds,
    onSelectionChange,
    selectAllLabel,
    selectRowLabel,
    isLoading = false,
    loadingContent,
    loadingRows = 3,
    emptyContent,
    stickyHeader = false,
    maxBlockSize,
    onRowAction,
    className,
}: DataTableProps<Row>) => {
    const rowHeaderId = columns.find((column) => column.isRowHeader)?.id ?? columns[0]?.id
    const multiple = selectionMode === "multiple"
    // Selection is always held here so every row can expose its own `data-grammar-selected`.
    const [uncontrolledSelection, setUncontrolledSelection] = useState<ReadonlyArray<string> | "all">(defaultSelectedIds ?? [])
    const selection = selectedIds ?? uncontrolledSelection
    const isRowSelected = (id: string) => selection === "all" || selection.includes(id)
    const isSkeleton = isLoading && loadingContent === undefined
    const skeletonRows = isSkeleton ? Array.from({ length: Math.min(12, Math.max(1, Math.floor(Number.isFinite(loadingRows) ? loadingRows : 3))) }, (_, index) => ({ id: `starci-skeleton-${index}` })) : []
    const visibleRows = isLoading ? [] : rows
    const state = isLoading ? "loading" : rows.length === 0 ? "empty" : "ready"
    const scrollStyle = maxBlockSize === undefined ? undefined : { "--starci-core-data-table-max-block-size": maxBlockSize } as CSSProperties
    return (
        <HeroTable
            aria-busy={isLoading || undefined}
            className={navigationClassName("starci-core-data-table", className)}
            data-component="DataTable"
            data-tier="branch"
            data-grammar-table-state={state}
            data-grammar-table-sticky={stickyHeader ? "true" : "false"}
            data-grammar-table-bounded={maxBlockSize === undefined ? "false" : "true"}
        >
            <HeroTable.ScrollContainer className="starci-core-data-table-scroll" data-contract="LAYOUT-3" data-grammar-table-scroll="true" style={scrollStyle}>
                <HeroTable.Content
                    aria-label={label}
                    {...(getCellInteraction === undefined ? {} : { keyboardNavigationBehavior: "arrow" as const })}
                    className="starci-core-data-table-content"
                    data-contract="FOCUS-2 STATE-1"
                    selectionMode={isSkeleton ? "none" : selectionMode}
                    {...(sort === undefined ? {} : { sortDescriptor: toSortDescriptor(sort) })}
                    {...(onSortChange === undefined ? {} : {
                        onSortChange: (descriptor: SortDescriptor) => onSortChange({ columnId: String(descriptor.column), direction: descriptor.direction }),
                    })}
                    selectedKeys={toSelection(selection)}
                    onSelectionChange={(next: Selection) => {
                        const ids = toIds(next)
                        if (selectedIds === undefined) setUncontrolledSelection(ids)
                        onSelectionChange?.(ids)
                    }}
                    {...(onRowAction === undefined ? {} : { onRowAction: (key: string | number) => onRowAction(String(key)) })}
                >
                    <HeroTable.Header className="starci-core-data-table-header">
                        {multiple ? (
                            <HeroTable.Column className="starci-core-data-table-column" data-grammar-table-selection="true" id={SELECTION_COLUMN}>
                                <SelectionCheckbox label={selectAllLabel} />
                            </HeroTable.Column>
                        ) : null}
                        {columns.map((column) => (
                            <HeroTable.Column
                                key={column.id}
                                id={column.id}
                                allowsSorting={column.allowsSorting === true}
                                className="starci-core-data-table-column"
                                data-grammar-table-align={column.align ?? "start"}
                                isRowHeader={column.id === rowHeaderId}
                                textValue={column.label}
                            >
                                {({ sortDirection }: { readonly sortDirection: "ascending" | "descending" | undefined }) => column.allowsSorting === true
                                    ? <HeroTable.SortableColumnHeader className="starci-core-data-table-sort" {...(sortDirection === undefined ? {} : { sortDirection })}>{column.label}</HeroTable.SortableColumnHeader>
                                    : column.label}
                            </HeroTable.Column>
                        ))}
                    </HeroTable.Header>
                    <HeroTable.Body
                        className="starci-core-data-table-body"
                        renderEmptyState={() => isLoading
                            ? <div className="starci-core-data-table-placeholder" data-grammar-table-loading="true" role="status">{loadingContent}</div>
                            : <div className="starci-core-data-table-placeholder" data-contract="STATE-3" data-grammar-table-empty="true">{emptyContent}</div>}
                    >
                        {skeletonRows.map((row) => (
                            <HeroTable.Row key={row.id} id={row.id} ref={hideFromAssistiveTechnology} className="starci-core-data-table-row" data-grammar-table-row="true" data-grammar-skeleton="true" data-grammar-selected="false">
                                {multiple ? <HeroTable.Cell className="starci-core-data-table-cell" data-grammar-table-selection="true">{null}</HeroTable.Cell> : null}
                                {columns.map((column) => (
                                    <HeroTable.Cell key={column.id} className="starci-core-data-table-cell" data-grammar-table-align={column.align ?? "start"}><Skeleton shape="text" /></HeroTable.Cell>
                                ))}
                            </HeroTable.Row>
                        ))}
                        {visibleRows.map((row) => (
                            <HeroTable.Row
                                key={row.id}
                                id={row.id}
                                className="starci-core-data-table-row"
                                data-contract="FOCUS-1"
                                data-grammar-table-row="true"
                                data-grammar-selected={selectionMode !== "none" && isRowSelected(row.id) ? "true" : "false"}
                            >
                                {multiple ? (
                                        <HeroTable.Cell className="starci-core-data-table-cell" data-grammar-table-selection="true">
                                            <SelectionCheckbox label={selectRowLabel?.(row)} />
                                        </HeroTable.Cell>
                                    ) : null}
                                    {columns.map((column) => {
                                        const interaction = getCellInteraction?.(row, column.id)
                                        return <HeroTable.Cell
                                            key={column.id}
                                            className="starci-core-data-table-cell"
                                            data-grammar-table-align={column.align ?? "start"}
                                            data-grammar-cell-highlighted={interaction?.isHighlighted ? "true" : "false"}
                                            data-grammar-cell-tone={interaction?.tone ?? "neutral"}
                                            {...(interaction?.onAction === undefined ? {} : {
                                                focusMode: "cell" as const,
                                                onClick: (event: MouseEvent<HTMLTableCellElement>) => {
                                                    // Descendant controls keep their own actions; plain cell content activates the cell.
                                                    if (isNestedCellControl(event.target, event.currentTarget)) return
                                                    event.stopPropagation()
                                                    interaction.onAction?.()
                                                },
                                                onKeyDown: (event: KeyboardEvent<HTMLTableCellElement>) => {
                                                    if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return
                                                    event.preventDefault()
                                                    event.stopPropagation()
                                                    if (!event.repeat) interaction.onAction?.()
                                                },
                                            })}
                                            {...(interaction?.onDragOver === undefined ? {} : { onDragOver: interaction.onDragOver })}
                                            {...(interaction?.onDragLeave === undefined ? {} : { onDragLeave: interaction.onDragLeave })}
                                            {...(interaction?.onDrop === undefined ? {} : { onDrop: interaction.onDrop })}
                                        >
                                            {renderCell(row, column.id)}
                                        </HeroTable.Cell>
                                    })}
                            </HeroTable.Row>
                        ))}
                    </HeroTable.Body>
                </HeroTable.Content>
            </HeroTable.ScrollContainer>
        </HeroTable>
    )
}

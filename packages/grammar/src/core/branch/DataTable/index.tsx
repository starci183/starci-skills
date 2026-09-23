"use client"

import { Checkbox as HeroCheckbox, Table as HeroTable, type Selection, type SortDescriptor } from "@heroui/react"
import { useState, type CSSProperties, type ReactNode } from "react"
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

export type DataTableProps<Row extends DataTableRow> = {
    /** Names the table, e.g. "Invoices". */
    readonly label: string
    readonly columns: ReadonlyArray<DataTableColumn>
    readonly rows: ReadonlyArray<Row>
    readonly renderCell: (row: Row, columnId: string) => ReactNode
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
    /** Replaces the rows with `loadingContent` and marks the table busy. */
    readonly isLoading?: boolean
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

const SELECTION_COLUMN = "starci-data-table-selection"

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

/**
 * Tabular data with sortable columns (`aria-sort`), row selection (`aria-selected`,
 * `data-grammar-selected`), empty and loading states, an optional sticky header, and its own
 * horizontal scroll so a wide table never widens a 360px page.
 */
export const DataTable = <Row extends DataTableRow>({
    label,
    columns,
    rows,
    renderCell,
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
            <HeroTable.ScrollContainer className="starci-core-data-table-scroll" data-grammar-table-scroll="true" style={scrollStyle}>
                <HeroTable.Content
                    aria-label={label}
                    className="starci-core-data-table-content"
                    selectionMode={selectionMode}
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
                                {({ sortDirection }: { readonly sortDirection?: "ascending" | "descending" | undefined }) => column.allowsSorting === true
                                    ? <HeroTable.SortableColumnHeader className="starci-core-data-table-sort" {...(sortDirection === undefined ? {} : { sortDirection })}>{column.label}</HeroTable.SortableColumnHeader>
                                    : column.label}
                            </HeroTable.Column>
                        ))}
                    </HeroTable.Header>
                    <HeroTable.Body
                        className="starci-core-data-table-body"
                        renderEmptyState={() => isLoading
                            ? <div className="starci-core-data-table-placeholder" data-grammar-table-loading="true" role="status">{loadingContent}</div>
                            : <div className="starci-core-data-table-placeholder" data-grammar-table-empty="true">{emptyContent}</div>}
                    >
                        {visibleRows.map((row) => (
                            <HeroTable.Row
                                key={row.id}
                                id={row.id}
                                className="starci-core-data-table-row"
                                data-grammar-table-row="true"
                                data-grammar-selected={selectionMode !== "none" && isRowSelected(row.id) ? "true" : "false"}
                            >
                                {multiple ? (
                                        <HeroTable.Cell className="starci-core-data-table-cell" data-grammar-table-selection="true">
                                            <SelectionCheckbox label={selectRowLabel?.(row)} />
                                        </HeroTable.Cell>
                                    ) : null}
                                    {columns.map((column) => (
                                        <HeroTable.Cell key={column.id} className="starci-core-data-table-cell" data-grammar-table-align={column.align ?? "start"}>
                                            {renderCell(row, column.id)}
                                        </HeroTable.Cell>
                                    ))}
                            </HeroTable.Row>
                        ))}
                    </HeroTable.Body>
                </HeroTable.Content>
            </HeroTable.ScrollContainer>
        </HeroTable>
    )
}

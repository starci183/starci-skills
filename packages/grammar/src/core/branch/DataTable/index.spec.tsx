// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { useState } from "react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { FAMILY_ROOTS, expectedFamilyScope, installVendorDomStubs } from "../../../__test__/navigationFamilies.js"
import { DataTable, type DataTableSort } from "./index.js"

beforeAll(installVendorDomStubs)
afterEach(cleanup)

type Invoice = { readonly id: string; readonly customer: string; readonly amount: number }

const rows: ReadonlyArray<Invoice> = [
    { id: "a", customer: "Acme", amount: 30 },
    { id: "b", customer: "Globex", amount: 10 },
    { id: "c", customer: "Initech", amount: 20 },
]

const columns = [
    { id: "customer", label: "Customer", allowsSorting: true },
    { id: "amount", label: "Amount", allowsSorting: true, align: "end" as const },
]

const cell = (row: Invoice, columnId: string) => columnId === "customer" ? row.customer : String(row.amount)

const tableFrame = () => document.querySelector("[data-component='DataTable']")

describe.each(FAMILY_ROOTS)("DataTable under %s", (family, wrap) => {
    it("renders a named table with header, row headers and its own scroll owner", () => {
        render(wrap(<DataTable label="Invoices" columns={columns} rows={rows} renderCell={cell} emptyContent="None" stickyHeader maxBlockSize="20rem" />))
        expect(screen.getByTestId("grammar-root").getAttribute("data-grammar-family")).toBe(expectedFamilyScope(family))
        const table = screen.getByRole("grid", { name: "Invoices" })
        expect(within(table).getAllByRole("columnheader").map((node) => node.textContent)).toEqual(["Customer", "Amount"])
        expect(within(table).getAllByRole("rowheader").map((node) => node.textContent)).toEqual(["Acme", "Globex", "Initech"])
        const frame = tableFrame()
        expect(frame?.getAttribute("data-grammar-table-state")).toBe("ready")
        expect(frame?.getAttribute("data-grammar-table-sticky")).toBe("true")
        expect(frame?.getAttribute("data-grammar-table-bounded")).toBe("true")
        const scroll = frame?.querySelector<HTMLElement>("[data-grammar-table-scroll]")
        expect(scroll?.style.getPropertyValue("--starci-core-data-table-max-block-size")).toBe("20rem")
        expect(frame?.querySelector("[data-grammar-table-align='end']")).not.toBeNull()
    })

    it("announces aria-sort and reports sort changes from header presses", () => {
        const Sorted = () => {
            const [sort, setSort] = useState<DataTableSort>({ columnId: "amount", direction: "ascending" })
            const sorted = [...rows].sort((left, right) => {
                const delta = sort.columnId === "amount" ? left.amount - right.amount : left.customer.localeCompare(right.customer)
                return sort.direction === "ascending" ? delta : -delta
            })
            return <DataTable label="Invoices" columns={columns} rows={sorted} renderCell={cell} emptyContent="None" sort={sort} onSortChange={setSort} />
        }
        render(wrap(<Sorted />))
        const amount = screen.getByRole("columnheader", { name: "Amount" })
        expect(amount.getAttribute("aria-sort")).toBe("ascending")
        expect(screen.getByRole("columnheader", { name: "Customer" }).getAttribute("aria-sort")).toBe("none")
        expect(screen.getAllByRole("rowheader").map((node) => node.textContent)).toEqual(["Globex", "Initech", "Acme"])
        fireEvent.click(amount)
        expect(screen.getByRole("columnheader", { name: "Amount" }).getAttribute("aria-sort")).toBe("descending")
        expect(screen.getAllByRole("rowheader").map((node) => node.textContent)).toEqual(["Acme", "Initech", "Globex"])
    })

    it("selects rows with checkboxes and mirrors selection on data-grammar-selected", () => {
        const onSelectionChange = vi.fn()
        render(wrap(<DataTable label="Invoices" columns={columns} rows={rows} renderCell={cell} emptyContent="None"
            selectionMode="multiple" defaultSelectedIds={["b"]} onSelectionChange={onSelectionChange}
            selectAllLabel="Select all" selectRowLabel={(row) => `Select ${row.customer}`} />))
        const selectedHooks = () => [...document.querySelectorAll("[data-grammar-table-row]")].map((node) => node.getAttribute("data-grammar-selected"))
        expect(selectedHooks()).toEqual(["false", "true", "false"])
        expect(screen.getByRole("checkbox", { name: "Select all" })).not.toBeNull()
        fireEvent.click(screen.getByRole("checkbox", { name: /^Select Acme/ }))
        expect(onSelectionChange).toHaveBeenLastCalledWith(expect.arrayContaining(["a", "b"]))
        expect(selectedHooks()).toEqual(["true", "true", "false"])
        const acme = screen.getAllByRole("row").find((row) => row.textContent?.includes("Acme"))
        expect(acme?.getAttribute("aria-selected")).toBe("true")
    })

    it("draws the empty state when there are no rows", () => {
        render(wrap(<DataTable label="Invoices" columns={columns} rows={[]} renderCell={cell} emptyContent="No invoices yet" />))
        expect(tableFrame()?.getAttribute("data-grammar-table-state")).toBe("empty")
        expect(document.querySelector("[data-grammar-table-empty]")?.textContent).toBe("No invoices yet")
    })

    it("replaces rows with a busy loading state", () => {
        render(wrap(<DataTable label="Invoices" columns={columns} rows={rows} renderCell={cell} emptyContent="None" isLoading loadingContent="Loading invoices" />))
        expect(tableFrame()?.getAttribute("data-grammar-table-state")).toBe("loading")
        expect(tableFrame()?.getAttribute("aria-busy")).toBe("true")
        expect(screen.getByRole("status").textContent).toBe("Loading invoices")
        expect(document.querySelectorAll("[data-grammar-table-row]")).toHaveLength(0)
    })
})

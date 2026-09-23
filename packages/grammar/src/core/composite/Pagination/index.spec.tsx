// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { FAMILY_ROOTS, expectedFamilyScope, installVendorDomStubs } from "../../../__test__/navigationFamilies.js"
import { Pagination, paginationTokens } from "./index.js"

beforeAll(installVendorDomStubs)
afterEach(cleanup)

const labels = { previousLabel: "Previous", nextLabel: "Next", pageLabel: (page: number) => `Page ${page}` }

describe("paginationTokens", () => {
    it("shows every page when they fit and collapses distant gaps otherwise", () => {
        expect(paginationTokens(1, 5)).toEqual([1, 2, 3, 4, 5])
        expect(paginationTokens(1, 10)).toEqual([1, 2, 3, 4, 5, "end-ellipsis", 10])
        expect(paginationTokens(5, 10)).toEqual([1, "start-ellipsis", 4, 5, 6, "end-ellipsis", 10])
        expect(paginationTokens(10, 10)).toEqual([1, "start-ellipsis", 6, 7, 8, 9, 10])
        expect(paginationTokens(3, 0)).toEqual([])
    })
})

describe.each(FAMILY_ROOTS)("Pagination under %s", (family, wrap) => {
    it("is a named navigation landmark whose current page carries aria-current", () => {
        render(wrap(<Pagination label="Results pages" page={5} pageCount={10} onPageChange={() => {}} {...labels} summary="41-50 of 94" />))
        expect(screen.getByTestId("grammar-root").getAttribute("data-grammar-family")).toBe(expectedFamilyScope(family))
        const nav = screen.getByRole("navigation", { name: "Results pages" })
        expect(nav.getAttribute("data-component")).toBe("Pagination")
        const current = screen.getByRole("button", { name: "Page 5" })
        expect(current.getAttribute("aria-current")).toBe("page")
        expect(current.getAttribute("data-grammar-current")).toBe("true")
        expect(screen.getByRole("button", { name: "Page 4" }).getAttribute("aria-current")).toBeNull()
        expect(nav.querySelectorAll("[data-grammar-pagination-gap]")).toHaveLength(2)
        expect(nav.querySelector("[data-grammar-pagination-summary]")?.textContent).toBe("41-50 of 94")
        const distances = [...nav.querySelectorAll("[data-grammar-page-distance]")].map((node) => node.getAttribute("data-grammar-page-distance"))
        expect(distances).toEqual(["2", "1", "0", "1", "2"])
        expect(nav.querySelector("[data-grammar-page-edge='true']")?.textContent).toBe("1")
    })

    it("moves by page, previous and next, and disables the unavailable edge", () => {
        const onPageChange = vi.fn()
        render(wrap(<Pagination label="Pages" page={1} pageCount={3} onPageChange={onPageChange} {...labels} />))
        expect(screen.getByRole("button", { name: "Previous" }).hasAttribute("disabled") || screen.getByRole("button", { name: "Previous" }).getAttribute("data-disabled") === "true").toBe(true)
        fireEvent.click(screen.getByRole("button", { name: "Next" }))
        fireEvent.click(screen.getByRole("button", { name: "Page 3" }))
        fireEvent.click(screen.getByRole("button", { name: "Page 1" }))
        expect(onPageChange.mock.calls.map(([page]) => page)).toEqual([2, 3])
    })

    it("follows a controlled page with the keyboard", () => {
        const Controlled = () => {
            const [page, setPage] = useState(2)
            return <Pagination label="Pages" page={page} pageCount={4} onPageChange={setPage} {...labels} />
        }
        render(wrap(<Controlled />))
        const next = screen.getByRole("button", { name: "Next" })
        next.focus()
        expect(document.activeElement).toBe(next)
        fireEvent.keyDown(next, { key: "Enter" })
        fireEvent.keyUp(next, { key: "Enter" })
        expect(screen.getByRole("button", { name: "Page 3" }).getAttribute("aria-current")).toBe("page")
    })
})

// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { FAMILY_WRAPS, installDomShims } from "../__test__/grammarRoots.js"
import { DataTable } from "./branch/DataTable/index.js"
import { FlowGraph } from "./branch/FlowGraph/index.js"
import { SurfaceListCard } from "./branch/SurfaceListCard/index.js"
import { DescriptionList } from "./composite/DescriptionList/index.js"
import { ListRow } from "./composite/ListRow/index.js"
import { StaticStateRow } from "./composite/StaticStateRow/index.js"

beforeAll(installDomShims)
afterEach(cleanup)

const columns = [{ id: "name", label: "Name", isRowHeader: true }, { id: "count", label: "Count", align: "end" as const }]
const skeletonCount = (root: ParentNode) => root.querySelectorAll('[data-component="Skeleton"]').length

describe.each(FAMILY_WRAPS)("knowledge STATE-8 loading views under %s", (_family, wrap) => {
    describe("ListRow isSkeleton", () => {
        it("draws the four parts as aria-hidden geometry and renders no real content or control", () => {
            const { container } = render(wrap(<ul><ListRow isSkeleton title="Real title" description="Real line" leading={<b>L</b>} actions={<button type="button">Open</button>} badges={<i>B</i>}>Detail</ListRow></ul>))
            const row = container.querySelector("li")!
            expect(row.getAttribute("aria-hidden")).toBe("true")
            expect(row.getAttribute("data-grammar-skeleton")).toBe("true")
            expect(row.querySelector('[data-shape="circle"]')).not.toBeNull()
            expect(row.querySelectorAll('[data-shape="text"]')).toHaveLength(2)
            expect(row.querySelector('[data-shape="rect"]')).not.toBeNull()
            expect(row.textContent).toBe("")
            expect(row.querySelector("button")).toBeNull()
        })

        it("draws only the parts that are passed", () => {
            const { container } = render(wrap(<ul><ListRow isSkeleton title="Only title" /></ul>))
            expect(skeletonCount(container)).toBe(1)
        })
    })

    describe("SurfaceListCard isLoading", () => {
        it("draws 3 skeleton rows by default, aria-hidden, and marks the collection busy", () => {
            const { container } = render(wrap(<SurfaceListCard label="Saved" isLoading />))
            const rows = container.querySelectorAll('li[data-grammar-skeleton="true"]')
            expect(rows).toHaveLength(3)
            for (const row of rows) expect(row.getAttribute("aria-hidden")).toBe("true")
            expect(container.querySelector('[data-grammar-list="true"]')?.getAttribute("aria-busy")).toBe("true")
            expect(container.querySelector("h3")?.textContent).toBe("Saved")
        })

        it("honours loadingRows and clamps it to 1..12", () => {
            const rowsFor = (loadingRows: number) => {
                const { container, unmount } = render(wrap(<SurfaceListCard label="Saved" isLoading loadingRows={loadingRows} />))
                const count = container.querySelectorAll('li[data-grammar-skeleton="true"]').length
                unmount()
                return count
            }
            expect(rowsFor(5)).toBe(5)
            expect(rowsFor(40)).toBe(12)
            expect(rowsFor(0)).toBe(1)
        })

        it("lets real children win, and prefers the skeleton to the empty notice while loading", () => {
            const real = render(wrap(<SurfaceListCard label="Saved" isLoading><StaticStateRow item={{ id: "a", label: "Ada" }} /></SurfaceListCard>))
            expect(real.container.querySelectorAll('li[data-grammar-skeleton="true"]')).toHaveLength(0)
            expect(real.container.textContent).toContain("Ada")
            real.unmount()
            const loadingEmpty = render(wrap(<SurfaceListCard label="Saved" isLoading empty={<p>Nothing saved</p>} />))
            expect(loadingEmpty.container.querySelectorAll('li[data-grammar-skeleton="true"]')).toHaveLength(3)
            expect(loadingEmpty.container.textContent).not.toContain("Nothing saved")
        })

        it("is not busy when it is not loading", () => {
            const { container } = render(wrap(<SurfaceListCard label="Saved"><StaticStateRow item={{ id: "a", label: "Ada" }} /></SurfaceListCard>))
            expect(container.querySelector('[data-grammar-list="true"]')?.hasAttribute("aria-busy")).toBe(false)
        })
    })

    describe("DescriptionList isLoading", () => {
        it("keeps terms real and turns descriptions into skeletons, aria-busy on the root", () => {
            const { container } = render(wrap(<DescriptionList isLoading items={[{ id: "a", term: "Owner", description: "Ada" }, { id: "b", term: "Plan", description: "Pro" }]} />))
            const list = container.querySelector("dl")!
            expect(list.getAttribute("aria-busy")).toBe("true")
            expect([...list.querySelectorAll("dt")].map((term) => term.textContent)).toEqual(["Owner", "Plan"])
            expect(list.textContent).not.toContain("Ada")
            expect(list.querySelectorAll("dd")).toHaveLength(2)
            expect(skeletonCount(list)).toBe(2)
        })

        it("covers the stat-strip figure and meta, and drops the unit", () => {
            const { container } = render(wrap(<DescriptionList layout="stat-strip" isLoading items={[{ id: "a", term: "Revenue", description: "1,200", unit: "USD", meta: "Updated now" }, { id: "b", term: "Users", description: "40" }]} />))
            const list = container.querySelector("dl")!
            expect(list.getAttribute("aria-busy")).toBe("true")
            expect([...list.querySelectorAll("dt")].map((term) => term.textContent)).toEqual(["Revenue", "Users"])
            expect(list.textContent).not.toMatch(/1,200|USD|Updated now|40/)
            expect(skeletonCount(list)).toBe(3)
        })

        it("is not busy when loaded", () => {
            const { container } = render(wrap(<DescriptionList items={[{ id: "a", term: "Owner", description: "Ada" }]} />))
            expect(container.querySelector("dl")?.hasAttribute("aria-busy")).toBe(false)
        })
    })

    describe("DataTable isLoading", () => {
        const cell = () => "x"
        it("keeps the real headers and draws 3 aria-hidden skeleton rows by default instead of the empty state", () => {
            const { container } = render(wrap(<DataTable label="Invoices" columns={columns} rows={[]} renderCell={cell} emptyContent="None" isLoading />))
            expect([...container.querySelectorAll("th")].map((header) => header.textContent)).toEqual(["Name", "Count"])
            const rows = container.querySelectorAll('[data-grammar-table-row][data-grammar-skeleton="true"]')
            expect(rows).toHaveLength(3)
            for (const row of rows) expect(row.getAttribute("aria-hidden")).toBe("true")
            expect(container.querySelector('[data-component="DataTable"]')?.getAttribute("aria-busy")).toBe("true")
            expect(container.querySelector("[data-grammar-table-empty]")).toBeNull()
            expect(skeletonCount(container)).toBe(6)
        })

        it("honours loadingRows, and loadingContent still replaces the body", () => {
            const five = render(wrap(<DataTable label="Invoices" columns={columns} rows={[]} renderCell={cell} emptyContent="None" isLoading loadingRows={5} />))
            expect(five.container.querySelectorAll('[data-grammar-skeleton="true"]')).toHaveLength(5)
            five.unmount()
            const custom = render(wrap(<DataTable label="Invoices" columns={columns} rows={[]} renderCell={cell} emptyContent="None" isLoading loadingContent="Loading invoices" />))
            expect(custom.container.querySelectorAll('[data-grammar-skeleton="true"]')).toHaveLength(0)
            expect(custom.container.textContent).toContain("Loading invoices")
        })
    })

    describe("FlowGraph isLoading", () => {
        it("draws the frame with a skeleton, mounts no React Flow, and is busy", () => {
            const { container } = render(wrap(<FlowGraph label="Second brain" height="lg" isLoading nodes={[{ id: "a", label: "Root" }]} edges={[]} />))
            const figure = container.querySelector('[data-component="FlowGraph"]')!
            expect(figure.getAttribute("aria-busy")).toBe("true")
            expect(figure.getAttribute("aria-label")).toBe("Second brain")
            expect(figure.getAttribute("data-grammar-flow-height")).toBe("lg")
            expect(figure.querySelector('[data-shape="rect"]')).not.toBeNull()
            expect(container.querySelector(".react-flow")).toBeNull()
            expect(container.querySelector("[data-grammar-flow-fallback]")).toBeNull()
        })
    })
})

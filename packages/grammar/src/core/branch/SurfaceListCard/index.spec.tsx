// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { GRAMMAR_ROOT_CASES, expectInFamilyScope, installDomShims } from "../../../__test__/grammarRoots.js"
import { EmptyNotice } from "../../composite/EmptyNotice/index.js"
import { StaticStateRow } from "../../composite/StaticStateRow/index.js"
import { SurfaceListCard } from "./index.js"

installDomShims()
afterEach(cleanup)

const rows = [
    <StaticStateRow key="a" item={{ id: "a", label: "Email verified", state: "affirmative" }} />,
    <StaticStateRow key="b" item={{ id: "b", label: "Backup", state: "pending" }} />,
]

describe.each(GRAMMAR_ROOT_CASES)("Common SurfaceListCard under $name", ({ Root, family }) => {
    it("gives every StaticStateRow a real list parent", () => {
        render(<Root><SurfaceListCard label="Checks">{rows}</SurfaceListCard></Root>)
        const list = screen.getByRole("list")
        expect(list.tagName).toBe("UL")
        expect(list.getAttribute("data-grammar-list")).toBe("true")
        const items = within(list).getAllByRole("listitem")
        expect(items).toHaveLength(2)
        for (const item of items) {
            expect(item.tagName).toBe("LI")
            expect(item.parentElement).toBe(list)
        }
        expectInFamilyScope(list, family)
    })

    it("keeps the list semantics on a contained scroll region, which is a named Tab stop", () => {
        render(<Root><SurfaceListCard label="History" isScrollable>{rows}</SurfaceListCard></Root>)
        const list = screen.getByRole("list", { name: "History" })
        expect(list.getAttribute("data-grammar-scroll-region")).toBe("vertical")
        expect(list.getAttribute("tabindex")).toBe("0")
        expect(within(list).getAllByRole("listitem")).toHaveLength(2)
    })

    it("names a label-hidden scrolling list by its aria label", () => {
        render(<Root><SurfaceListCard ariaLabel="Every state" labelHidden isScrollable>{rows}</SurfaceListCard></Root>)
        expect(screen.getByRole("list", { name: "Every state" }).getAttribute("tabindex")).toBe("0")
    })

    it("draws the empty slot as plain content, not as a list", () => {
        render(<Root><SurfaceListCard label="Saved" empty={<EmptyNotice message="Nothing saved yet." />} /></Root>)
        expect(screen.queryByRole("list")).toBeNull()
        expect(screen.getByText("Nothing saved yet.").closest("[data-grammar-list=\"true\"]")).not.toBeNull()
    })

    it("draws rows, not the empty slot, once rows exist", () => {
        render(<Root><SurfaceListCard label="Saved" empty={<EmptyNotice message="Nothing saved yet." />}>{rows}</SurfaceListCard></Root>)
        expect(screen.getAllByRole("listitem")).toHaveLength(2)
        expect(screen.queryByText("Nothing saved yet.")).toBeNull()
    })

    it("names itself with an h3 by default and takes the page heading level", () => {
        const { unmount } = render(<Root><SurfaceListCard label="Checks">{rows}</SurfaceListCard></Root>)
        expect(screen.getByRole("heading", { name: "Checks" }).tagName).toBe("H3")
        unmount()
        render(<Root><SurfaceListCard label="Checks" headingLevel={2}>{rows}</SurfaceListCard></Root>)
        const heading = screen.getByRole("heading", { name: "Checks", level: 2 })
        expect(heading.getAttribute("data-grammar-label")).toBe("true")
        expect(screen.getByRole("list").closest("[aria-labelledby]")?.getAttribute("aria-labelledby")).toBe(heading.id)
    })
})

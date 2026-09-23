// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { GRAMMAR_ROOT_CASES, expectInFamilyScope } from "../../../__test__/grammarRoots.js"
import { Rail } from "./index.js"

afterEach(cleanup)

describe.each(GRAMMAR_ROOT_CASES)("Common Rail under $name", ({ Root, family }) => {
    it("makes its scrolling body a keyboard-reachable region named by the rail heading", () => {
        render(<Root><Rail label="Details"><p>Plain facts, nothing focusable.</p></Rail></Root>)
        const rail = screen.getByRole("complementary", { name: "Details" })
        expectInFamilyScope(rail, family)
        const body = within(rail).getByRole("region", { name: "Details" })
        expect(body.getAttribute("data-grammar-rail-body")).toBe("true")
        expect(body.getAttribute("tabindex")).toBe("0")
    })

    it("adds no Tab stop when the body clips (height=fill) or holds its own navigation", () => {
        const { container } = render(<Root>
            <Rail label="Filled" height="fill"><p>Fill</p></Rail>
            <Rail landmark="content-navigation"><nav aria-label="Sections"><a href="#a">A</a></nav></Rail>
        </Root>)
        const bodies = container.querySelectorAll("[data-grammar-rail-body]")
        expect(bodies).toHaveLength(2)
        for (const body of bodies) {
            expect(body.hasAttribute("tabindex")).toBe(false)
            expect(body.hasAttribute("role")).toBe(false)
        }
    })

    it("names itself with an h2 by default and takes a deeper level", () => {
        const { unmount } = render(<Root><Rail label="Details">x</Rail></Root>)
        expect(screen.getByRole("heading", { name: "Details", level: 2 })).toBeTruthy()
        unmount()
        render(<Root><Rail label="Details" headingLevel={3}>x</Rail></Root>)
        expect(screen.getByRole("heading", { name: "Details", level: 3 })).toBeTruthy()
    })
})

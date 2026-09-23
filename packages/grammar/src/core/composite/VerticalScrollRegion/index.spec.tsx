// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { GRAMMAR_ROOT_CASES, expectInFamilyScope, installDomShims } from "../../../__test__/grammarRoots.js"
import { HorizontalScrollRegion } from "../HorizontalScrollRegion/index.js"
import { VerticalScrollRegion } from "./index.js"

installDomShims()
afterEach(cleanup)

describe.each(GRAMMAR_ROOT_CASES)("Common scroll regions under $name", ({ Root, family }) => {
    it("makes a scrolling vertical region a Tab stop and, when named, a region", () => {
        render(<Root><VerticalScrollRegion isScrollable aria-label="Transcript"><p>Text</p></VerticalScrollRegion></Root>)
        const region = screen.getByRole("region", { name: "Transcript" })
        expect(region.getAttribute("tabindex")).toBe("0")
        expect(region.getAttribute("data-grammar-scroll-region")).toBe("vertical")
        expectInFamilyScope(region, family)
    })

    it("keeps an owner's role and adds a Tab stop even when unnamed", () => {
        const { container } = render(<Root>
            <VerticalScrollRegion isScrollable role="list" aria-label="Rows"><li>Row</li></VerticalScrollRegion>
            <VerticalScrollRegion isScrollable data-testid="unnamed"><p>Text</p></VerticalScrollRegion>
        </Root>)
        expect(screen.getByRole("list", { name: "Rows" }).getAttribute("tabindex")).toBe("0")
        const unnamed = container.querySelector("[data-testid=\"unnamed\"]")
        expect(unnamed?.getAttribute("tabindex")).toBe("0")
        expect(unnamed?.hasAttribute("role")).toBe(false)
    })

    it("adds nothing when the region does not scroll, and renders the owner's list element", () => {
        const { container } = render(<Root><VerticalScrollRegion isScrollable={false} as="ul" role="list"><li>Row</li></VerticalScrollRegion></Root>)
        const list = screen.getByRole("list")
        expect(list.tagName).toBe("UL")
        expect(container.querySelector("[tabindex]")).toBeNull()
    })

    it("lets an owner whose content is focusable opt out of the extra stop", () => {
        const { container } = render(<Root><VerticalScrollRegion isScrollable isFocusable={false} aria-label="Links"><a href="#a">A</a></VerticalScrollRegion></Root>)
        const region = container.querySelector("[data-grammar-scroll-region]")
        expect(region?.hasAttribute("tabindex")).toBe(false)
        expect(region?.hasAttribute("role")).toBe(false)
    })

    it("makes a horizontal strip a named Tab stop, with the same opt-out", () => {
        const { container } = render(<Root>
            <HorizontalScrollRegion aria-label="Lessons"><span>One</span></HorizontalScrollRegion>
            <HorizontalScrollRegion isFocusable={false} data-testid="tabs"><button type="button">Tab</button></HorizontalScrollRegion>
        </Root>)
        expect(screen.getByRole("region", { name: "Lessons" }).getAttribute("tabindex")).toBe("0")
        expect(container.querySelector("[data-testid=\"tabs\"]")?.hasAttribute("tabindex")).toBe(false)
    })
})

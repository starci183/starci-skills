// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { GRAMMAR_ROOT_CASES, expectInFamilyScope, installDomShims } from "../../../__test__/grammarRoots.js"
import { SurfaceCard } from "./index.js"

installDomShims()
afterEach(cleanup)

describe.each(GRAMMAR_ROOT_CASES)("Common SurfaceCard under $name", ({ Root, family }) => {
    it("names itself with an h3 by default", () => {
        render(<Root><SurfaceCard label="This week"><p>Body</p></SurfaceCard></Root>)
        expectInFamilyScope(screen.getByRole("heading", { name: "This week", level: 3 }), family)
    })

    it.each([2, 4, 5, 6] as const)("takes heading level %i so the outline never skips", (level) => {
        render(<Root><SurfaceCard label="This week" headingLevel={level}><p>Body</p></SurfaceCard></Root>)
        expect(screen.getByRole("heading", { name: "This week" }).tagName).toBe(`H${level}`)
    })

    it("makes contained content a named, keyboard-reachable scroll region", () => {
        render(<Root><SurfaceCard label="Notes" scroll="contained"><p>Body</p></SurfaceCard></Root>)
        const region = screen.getByRole("region", { name: "Notes" })
        expect(region.getAttribute("data-grammar-scroll-region")).toBe("vertical")
        expect(region.getAttribute("tabindex")).toBe("0")
    })

    it("names a label-less contained region by its aria label", () => {
        render(<Root><SurfaceCard ariaLabel="Transcript" isScrollable><p>Body</p></SurfaceCard></Root>)
        expect(screen.getByRole("region", { name: "Transcript" }).getAttribute("tabindex")).toBe("0")
    })

    it("adds no Tab stop to page-scrolled content", () => {
        const { container } = render(<Root><SurfaceCard label="Static"><p>Body</p></SurfaceCard></Root>)
        expect(container.querySelector("[tabindex=\"0\"]")).toBeNull()
        expect(screen.queryByRole("region")).toBeNull()
    })
})

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

/** The ink band (0.6.0): a painted signature surface with a decorative artwork zone and an optional orbit motif. */
describe.each(GRAMMAR_ROOT_CASES)("Common SurfaceCard ink band under $name", ({ Root, family }) => {
    it("marks the ink treatment on the card and its bounded surface, and always draws a shell", () => {
        const { container } = render(<Root><SurfaceCard ariaLabel="Workspace" treatment="ink" frame="frameless" composition="joined"><p>Body</p></SurfaceCard></Root>)
        const card = container.querySelector("[data-grammar-surface-card]")!
        expect(card.getAttribute("data-component")).toBe("SurfaceCard")
        expect(card.getAttribute("data-grammar-surface-treatment")).toBe("ink")
        const surface = container.querySelector(".starci-core-surface[data-grammar-surface-treatment=\"ink\"]")!
        // `frame="frameless"` is ignored: the ink band IS a painted ground.
        expect(surface.getAttribute("data-grammar-frame")).toBe("bounded")
        expect(surface.classList.contains("starci-core-frameless-surface")).toBe(false)
        expectInFamilyScope(card, family)
    })

    it("renders the artwork and the orbit in one aria-hidden zone before the content", () => {
        const { container } = render(<Root>
            <SurfaceCard ariaLabel="Workspace" treatment="ink" motif="orbit" artwork={<img alt="" src="/art.png" />}>
                <p>Body copy</p>
            </SurfaceCard>
        </Root>)
        const zone = container.querySelector(".starci-core-surface-artwork")!
        expect(zone.getAttribute("aria-hidden")).toBe("true")
        expect(zone.getAttribute("data-grammar-surface-artwork")).toBe("art")
        expect(zone.getAttribute("data-grammar-surface-motif")).toBe("orbit")
        const orbit = zone.querySelector("svg.starci-core-surface-orbit")!
        expect(orbit.getAttribute("aria-hidden")).toBe("true")
        expect(orbit.getAttribute("focusable")).toBe("false")
        expect(orbit.querySelectorAll("ellipse")).toHaveLength(3)
        expect(orbit.querySelectorAll("circle").length).toBeGreaterThan(0)
        // Static: the motif never animates, so reduced motion has nothing to stop.
        expect(orbit.querySelector("animate, animateTransform, animateMotion")).toBeNull()
        expect(zone.querySelector("img")).toBeTruthy()
        // The zone precedes the content region and never holds it.
        const content = container.querySelector("[data-grammar-surface-content]")!
        expect(zone.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(zone.contains(content)).toBe(false)
        expect(screen.getByText("Body copy").closest(".starci-core-surface-artwork")).toBeNull()
    })

    it("draws no artwork zone on the plain surface or on an ink band with neither art nor motif", () => {
        const { container } = render(<Root>
            <SurfaceCard ariaLabel="Plain"><p>Body</p></SurfaceCard>
            <SurfaceCard ariaLabel="Bare ink" treatment="ink"><p>Body</p></SurfaceCard>
        </Root>)
        expect(container.querySelector(".starci-core-surface-artwork")).toBeNull()
        expect(container.querySelector("[data-grammar-surface-card]")!.getAttribute("data-grammar-surface-treatment")).toBe("surface")
    })
})

// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { GRAMMAR_ROOT_CASES, expectInFamilyScope } from "../../../__test__/grammarRoots.js"
import { Skeleton } from "./index.js"

afterEach(cleanup)

const css = readFileSync(resolve(process.cwd(), "src/common/components-overlays.css"), "utf8")
const skeletonOf = (container: HTMLElement) => container.querySelector("[data-component=\"Skeleton\"]")

describe.each(GRAMMAR_ROOT_CASES)("Common Skeleton under $name", ({ Root, family }) => {
    it("draws inert text lines with a shorter last line", () => {
        const { container } = render(<Root><Skeleton lines={3} /></Root>)
        const skeleton = skeletonOf(container)

        expect(skeleton?.getAttribute("aria-hidden")).toBe("true")
        expect(skeleton?.getAttribute("data-shape")).toBe("text")
        const lines = skeleton?.querySelectorAll("[data-grammar-skeleton-line]") ?? []
        expect(lines).toHaveLength(3)
        expect(lines[2]?.getAttribute("data-grammar-skeleton-line")).toBe("last")
        expectInFamilyScope(skeleton, family)
    })

    it("draws rect and circle geometry", () => {
        const { container, rerender } = render(<Root><Skeleton shape="rect" ratio="square" /></Root>)
        expect(skeletonOf(container)?.getAttribute("data-shape")).toBe("rect")
        expect(skeletonOf(container)?.getAttribute("data-ratio")).toBe("square")
        expect(skeletonOf(container)?.getAttribute("aria-hidden")).toBe("true")

        rerender(<Root><Skeleton shape="circle" size="lg" /></Root>)
        expect(skeletonOf(container)?.getAttribute("data-shape")).toBe("circle")
        expect(skeletonOf(container)?.getAttribute("data-size")).toBe("lg")
    })
})

describe("Common Skeleton bounds and motion", () => {
    it("clamps line counts to 1-12", () => {
        const { container, rerender } = render(<Skeleton lines={40} />)
        expect(container.querySelectorAll("[data-grammar-skeleton-line]")).toHaveLength(12)
        rerender(<Skeleton lines={0} />)
        expect(container.querySelectorAll("[data-grammar-skeleton-line]")).toHaveLength(1)
    })

    it("removes the shimmer under prefers-reduced-motion", () => {
        const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"))
        expect(reduced).toContain(".starci-core-skeleton::after")
        expect(reduced).toContain("animation: none")
    })
})

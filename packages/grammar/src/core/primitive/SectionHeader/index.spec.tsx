// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { GRAMMAR_ROOT_CASES, expectInFamilyScope } from "../../../__test__/grammarRoots.js"
import { SectionHeader } from "./index.js"

afterEach(cleanup)

describe.each(GRAMMAR_ROOT_CASES)("Common SectionHeader under $name", ({ Root, family }) => {
    it("is a heading group, never a second page banner", () => {
        const { container } = render(<Root><SectionHeader title="Lessons" description="All of them." /></Root>)
        const group = container.querySelector("[data-grammar-section-header=\"true\"]")
        expect(group?.tagName).toBe("DIV")
        expect(screen.queryByRole("banner")).toBeNull()
        expectInFamilyScope(group, family)
    })

    it.each([1, 2, 3, 4, 5, 6] as const)("titles at level %i", (level) => {
        render(<Root><SectionHeader title="Lessons" level={level} /></Root>)
        expect(screen.getByRole("heading", { name: "Lessons", level })).toBeTruthy()
    })

    it("defaults to level 2", () => {
        render(<Root><SectionHeader title="Lessons" /></Root>)
        expect(screen.getByRole("heading", { name: "Lessons", level: 2 })).toBeTruthy()
    })
})

describe.each(GRAMMAR_ROOT_CASES)("Common SectionHeader count and meta under $name", ({ Root }) => {
    it("draws the count in the title line as part of the heading name, muted", () => {
        const { container } = render(<Root><SectionHeader title="Installations" count={2} /></Root>)
        const heading = screen.getByRole("heading", { level: 2 })
        expect(heading.textContent).toBe("Installations (2)")
        const count = heading.querySelector(".starci-core-section-count")!
        expect(count.textContent).toBe(" (2)")
        expect(count.getAttribute("data-grammar-section-count")).toBe("2")
        expect(count.getAttribute("data-contract")).toBe("TONE-2")
        expect(container.querySelector("[data-grammar-section-header]")?.getAttribute("data-component")).toBe("SectionHeader")
    })

    it("draws the trailing meta at the end of the row, before the action", () => {
        const { container } = render(<Root><SectionHeader title="Installations" meta="Inventoried at 10:00" action={<button type="button">Add</button>} /></Root>)
        const header = container.querySelector("[data-grammar-section-header]")!
        const meta = header.querySelector(".starci-core-section-meta")!
        expect(meta.textContent).toBe("Inventoried at 10:00")
        expect(meta.getAttribute("data-contract")).toBe("FONT-1 TONE-2")
        expect(meta.parentElement).toBe(header)
        expect(meta.nextElementSibling?.classList.contains("starci-core-section-action")).toBe(true)
        expect(screen.getByRole("heading", { name: "Installations" })).toBeTruthy()
    })

    it("draws neither when unset", () => {
        const { container } = render(<Root><SectionHeader title="Plain" /></Root>)
        expect(container.querySelector(".starci-core-section-count, .starci-core-section-meta")).toBeNull()
    })
})

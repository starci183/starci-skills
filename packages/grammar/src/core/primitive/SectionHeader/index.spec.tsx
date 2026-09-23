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

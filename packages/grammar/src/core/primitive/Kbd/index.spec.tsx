// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { GRAMMAR_ROOT_CASES, expectInFamilyScope } from "../../../__test__/grammarRoots.js"
import { Kbd } from "./index.js"

afterEach(cleanup)

describe.each(GRAMMAR_ROOT_CASES)("Common Kbd under $name", ({ Root, family }) => {
    it("draws one <kbd> chord with spelled-out abbreviations for named keys", () => {
        const { container } = render(<Root><Kbd keys={["command", "shift", "K"]} /></Root>)
        const kbd = container.querySelector("[data-component=\"Kbd\"]")

        expect(kbd?.tagName).toBe("KBD")
        expect(kbd?.classList.contains("starci-core-kbd")).toBe(true)
        const abbreviations = Array.from(kbd?.querySelectorAll("abbr") ?? [], (abbr) => abbr.getAttribute("title"))
        expect(abbreviations).toEqual(["Command", "Shift"])
        expect(kbd?.textContent).toContain("K")
        expectInFamilyScope(kbd ?? null, family)
    })

    it("renders keys it does not know verbatim", () => {
        const { container } = render(<Root><Kbd keys={["F6"]} /></Root>)
        const kbd = container.querySelector("[data-component=\"Kbd\"]")
        expect(kbd?.querySelector("abbr")).toBeNull()
        expect(kbd?.textContent).toBe("F6")
    })
})

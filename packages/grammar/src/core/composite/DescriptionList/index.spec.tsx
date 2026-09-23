// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { FAMILY_WRAPS, expectedFamilyScope } from "../../../__test__/grammarRoots.js"
import { DescriptionList } from "./index.js"

afterEach(cleanup)

const items = [
    { id: "plan", term: "Plan", description: "Team" },
    { id: "seats", term: "Seats", description: "12" },
]

describe.each(FAMILY_WRAPS)("DescriptionList under %s", (family, wrap) => {
    it("renders term/value pairs as a real description list", () => {
        const { container } = render(wrap(<DescriptionList items={items} />))
        expect(screen.getByTestId("grammar-root").getAttribute("data-grammar-family")).toBe(expectedFamilyScope(family))
        const list = container.querySelector("dl")
        expect(list?.getAttribute("data-component")).toBe("DescriptionList")
        expect(list?.getAttribute("data-grammar-description-layout")).toBe("columns")
        expect(list?.getAttribute("data-grammar-description-divided")).toBe("true")
        expect(screen.getAllByRole("term").map((node) => node.textContent)).toEqual(["Plan", "Seats"])
        expect(screen.getAllByRole("definition").map((node) => node.textContent)).toEqual(["Team", "12"])
        expect(container.querySelectorAll("dl > [data-grammar-description-pair] > dt + dd")).toHaveLength(2)
    })

    it("exposes the stacked, undivided layout", () => {
        const { container } = render(wrap(<DescriptionList items={items} layout="stacked" isDivided={false} />))
        expect(container.querySelector("dl")?.getAttribute("data-grammar-description-layout")).toBe("stacked")
        expect(container.querySelector("dl")?.getAttribute("data-grammar-description-divided")).toBe("false")
    })
})

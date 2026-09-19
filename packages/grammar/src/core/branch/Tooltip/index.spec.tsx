// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { Tooltip } from "./index.js"

afterEach(cleanup)

describe("Core Tooltip", () => {
    it("anchors resolved copy to a trigger with grammar tooltip semantics", () => {
        const { container } = render(
            <Tooltip content="3 activities on 12 Aug">
                <button type="button">Day</button>
            </Tooltip>,
        )

        const root = container.querySelector("[data-grammar-tooltip=\"true\"]")
        const trigger = container.querySelector("[data-grammar-tooltip-trigger=\"true\"]")
        const content = container.querySelector("[data-grammar-tooltip-content=\"true\"]")
        expect(root).toBeTruthy()
        expect(root?.getAttribute("data-grammar-tooltip-placement")).toBe("top")
        expect(trigger?.getAttribute("aria-describedby")).toBe(content?.id)
        expect(content?.getAttribute("role")).toBe("tooltip")
        expect(content?.classList.contains("starci-core-tooltip-content")).toBe(true)
        expect(screen.getByText("3 activities on 12 Aug")).toBeTruthy()
        expect(screen.getByRole("button", { name: "Day" })).toBeTruthy()
    })

    it("supports a bottom placement without changing trigger semantics", () => {
        const { container } = render(
            <Tooltip content="No activity" placement="bottom">
                <span>Cell</span>
            </Tooltip>,
        )

        expect(container.querySelector("[data-grammar-tooltip=\"true\"]")?.getAttribute("data-grammar-tooltip-placement")).toBe("bottom")
        expect(screen.getByText("Cell")).toBeTruthy()
    })
})

// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { FAMILY_WRAPS, expectedFamilyScope } from "../../../__test__/grammarRoots.js"
import type { PresentationState } from "../../../common/state.js"
import { Timeline } from "./index.js"

afterEach(cleanup)

const events = [
    { id: "placed", title: "Placed", dateTime: "2026-01-02T10:00:00Z", timeLabel: "Jan 2", state: "affirmative" as const },
    { id: "shipped", title: "Shipped", timeLabel: "Jan 3", isCurrent: true, description: "In transit" },
    { id: "delivered", title: "Delivered", state: "pending" as const },
]

describe.each(FAMILY_WRAPS)("Timeline under %s", (family, wrap) => {
    it("renders a named ordered history with state and current hooks", () => {
        render(wrap(<Timeline label="Order history" items={events} />))
        expect(screen.getByTestId("grammar-root").getAttribute("data-grammar-family")).toBe(expectedFamilyScope(family))
        const list = screen.getByRole("list", { name: "Order history" })
        expect(list.tagName).toBe("OL")
        expect(list.getAttribute("data-component")).toBe("Timeline")
        const items = screen.getAllByRole("listitem")
        expect(items.map((item) => item.getAttribute("data-grammar-timeline-state"))).toEqual(["affirmative", "neutral", "pending"])
        expect(items.map((item) => item.getAttribute("aria-current"))).toEqual([null, "step", null])
        expect(items[1]?.getAttribute("data-grammar-current")).toBe("true")
        expect(items[0]?.querySelector("time")?.getAttribute("datetime")).toBe("2026-01-02T10:00:00Z")
        expect(items[0]?.querySelector("[data-grammar-timeline-marker]")?.getAttribute("aria-hidden")).toBe("true")
    })

    it("rejects states outside the Common presentation vocabulary", () => {
        const invalid = [{ id: "x", title: "X", state: "loud" as unknown as PresentationState }]
        expect(() => render(wrap(<Timeline label="History" items={invalid} />))).toThrow(/Unknown presentation state/)
    })
})

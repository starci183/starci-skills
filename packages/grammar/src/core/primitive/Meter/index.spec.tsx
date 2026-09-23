// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { GRAMMAR_ROOT_CASES, expectInFamilyScope } from "../../../__test__/grammarRoots.js"
import { Meter } from "./index.js"

afterEach(cleanup)

describe.each(GRAMMAR_ROOT_CASES)("Common Meter under $name", ({ Root, family }) => {
    it("is a meter named by its visible label", () => {
        render(<Root><Meter label="Storage used" value={3.2} maxValue={5} valueLabel="3.2 of 5 GB" tone="cautionary" /></Root>)
        const meter = screen.getByRole("meter", { name: "Storage used" })

        expect(meter.getAttribute("data-component")).toBe("Meter")
        expect(meter.getAttribute("data-grammar-tone")).toBe("cautionary")
        expect(meter.getAttribute("aria-valuenow")).toBe("3.2")
        expect(meter.getAttribute("aria-valuemax")).toBe("5")
        expect(meter.getAttribute("aria-valuetext")).toBe("3.2 of 5 GB")
        expect(screen.getByText("Storage used")).toBeTruthy()
        expect(meter.querySelector("[data-slot=\"meter-fill\"]")).toBeTruthy()
        expectInFamilyScope(meter, family)
    })

    it("keeps the accessible name when the drawn label is hidden", () => {
        render(<Root><Meter label="Strength" value={60} isLabelHidden /></Root>)
        const meter = screen.getByRole("meter", { name: "Strength" })
        expect(meter.getAttribute("aria-label")).toBe("Strength")
        expect(meter.getAttribute("data-grammar-tone")).toBe("neutral")
        expect(screen.queryByText("Strength")).toBeNull()
    })
})

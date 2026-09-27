// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it } from "vitest"
import { GRAMMAR_ROOT_CASES, expectInFamilyScope } from "../../../__test__/grammarRoots.js"
import { Meter } from "./index.js"

afterEach(cleanup)

describe.each(GRAMMAR_ROOT_CASES)("Common Meter under $name", ({ Root, family }) => {
    it("is a meter named by its visible label", () => {
        render(<Root><Meter label="Storage used" value={3.2} maxValue={5} valueLabel="3.2 of 5 GB" tone="cautionary" /></Root>)
        const meter = screen.getByRole("meter", { name: "Storage used" })

        expect(meter.getAttribute("data-component")).toBe("Meter")
        // Exactly `meter`: a "meter progressbar" role list makes validators reject aria-value* (axe 4.13).
        expect(meter.getAttribute("role")).toBe("meter")
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
        expect(meter.getAttribute("role")).toBe("meter")
        expect(meter.getAttribute("aria-valuenow")).toBe("60")
        expect(meter.getAttribute("aria-label")).toBe("Strength")
        expect(meter.getAttribute("data-grammar-tone")).toBe("neutral")
        expect(screen.queryByText("Strength")).toBeNull()
    })
})

describe.each(GRAMMAR_ROOT_CASES)("Common segmented Meter under $name", ({ Root, family }) => {
    it("draws N presentational segments inside ONE meter that keeps the reading", () => {
        render(<Root><Meter label="Capabilities" value={2} maxValue={3} segments={3} valueLabel="2 of 3" /></Root>)
        const meters = screen.getAllByRole("meter")
        expect(meters).toHaveLength(1)
        const meter = screen.getByRole("meter", { name: "Capabilities" })

        expect(meter.getAttribute("role")).toBe("meter")
        expect(meter.getAttribute("aria-valuenow")).toBe("2")
        expect(meter.getAttribute("aria-valuemin")).toBe("0")
        expect(meter.getAttribute("aria-valuemax")).toBe("3")
        expect(meter.getAttribute("aria-valuetext")).toBe("2 of 3")
        expect(meter.getAttribute("data-grammar-meter-segments")).toBe("3")

        const track = meter.querySelector("[data-slot=\"meter-track\"]")!
        expect(track.classList.contains("starci-core-meter-track")).toBe(true)
        expect(track.classList.contains("starci-core-meter-segments")).toBe(true)
        // Still the vendor's track node (`.meter__track`, full grid width); the sheet re-cuts it to h-1.
        expect(track.classList.contains("meter__track")).toBe(true)
        expect(meter.classList.contains("meter--md")).toBe(true)
        // The segmented track replaces the continuous fill; it is the same vendor track box.
        expect(meter.querySelector("[data-slot=\"meter-fill\"]")).toBeNull()

        const segments = Array.from(track.querySelectorAll(".starci-core-meter-segment"))
        expect(segments).toHaveLength(3)
        expect(segments.map((segment) => segment.getAttribute("data-grammar-meter-segment"))).toEqual(["filled", "filled", "empty"])
        for (const segment of segments) {
            expect(segment.getAttribute("aria-hidden")).toBe("true")
            expect(segment.getAttribute("role")).toBeNull()
        }
        expectInFamilyScope(meter, family)
    })

    it("fills every segment at the top of the range and none at the bottom", () => {
        render(<Root>
            <Meter label="Full" value={3} maxValue={3} segments={3} />
            <Meter label="None" value={0} maxValue={3} segments={3} />
        </Root>)
        const states = (name: string) => Array.from(screen.getByRole("meter", { name }).querySelectorAll("[data-grammar-meter-segment]"))
            .map((segment) => segment.getAttribute("data-grammar-meter-segment"))
        expect(states("Full")).toEqual(["filled", "filled", "filled"])
        expect(states("None")).toEqual(["empty", "empty", "empty"])
    })

    it("reads a whole count: the value is rounded and clamped, the count clamped to 2..12", () => {
        render(<Root>
            <Meter label="Fractional" value={1.6} maxValue={3} segments={3} />
            <Meter label="Over" value={9} maxValue={3} segments={3} />
            <Meter label="Too many" value={1} maxValue={40} segments={40 as never} />
            <Meter label="Too few" value={1} maxValue={1} segments={1 as never} />
        </Root>)
        const fractional = screen.getByRole("meter", { name: "Fractional" })
        expect(fractional.getAttribute("aria-valuenow")).toBe("2")
        expect(fractional.querySelectorAll("[data-grammar-meter-segment=\"filled\"]")).toHaveLength(2)
        expect(screen.getByRole("meter", { name: "Over" }).getAttribute("aria-valuenow")).toBe("3")
        expect(screen.getByRole("meter", { name: "Too many" }).querySelectorAll("[data-grammar-meter-segment]")).toHaveLength(12)
        expect(screen.getByRole("meter", { name: "Too few" }).querySelectorAll("[data-grammar-meter-segment]")).toHaveLength(2)
    })
})

/**
 * The segmented track geometry, measured under the shipped overlay sheet. jsdom never cascades into
 * an `@layer` block, so the sheet is lifted out of its layer first (as the ChatWorkspace spec does).
 */
describe("segmented Meter geometry under the shipped sheet", () => {
    const SHEET = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../../common/components-overlays.css"), "utf8")
    const liftLayers = (rules: CSSRuleList): ReadonlyArray<string> => Array.from(rules).flatMap((rule) =>
        rule.constructor.name === "CSSLayerBlockRule" ? liftLayers((rule as CSSGroupingRule).cssRules) : [rule.cssText])
    const install = () => {
        const parser = document.createElement("style")
        parser.textContent = SHEET
        document.head.append(parser)
        const flattened = liftLayers(parser.sheet!.cssRules).join("\n")
        parser.remove()
        const sheet = document.createElement("style")
        sheet.textContent = flattened
        document.head.append(sheet)
        return sheet
    }

    it("spans the full width at h-1 (4px) and splits it into equal pill segments 0.25rem apart", () => {
        const sheet = install()
        try {
            const CoreRoot = GRAMMAR_ROOT_CASES[1]!.Root
            render(<CoreRoot><Meter label="Capabilities" value={2} maxValue={3} segments={3} /></CoreRoot>)
            const meter = screen.getByRole("meter", { name: "Capabilities" })
            const track = meter.querySelector<HTMLElement>("[data-slot=\"meter-track\"]")!
            const trackStyle = getComputedStyle(track)
            expect(getComputedStyle(meter).width).toBe("100%")
            expect(trackStyle.height).toMatch(/^(4px|0[.]25rem)$/)
            expect(trackStyle.display).toBe("flex")
            expect(trackStyle.gap).toMatch(/^(4px|0[.]25rem)$/)
            expect(trackStyle.backgroundColor === "transparent" || trackStyle.backgroundColor === "rgba(0, 0, 0, 0)").toBe(true)

            for (const segment of Array.from(track.querySelectorAll<HTMLElement>(".starci-core-meter-segment"))) {
                const style = getComputedStyle(segment)
                expect(style.height).toBe("100%")
                expect(style.flexGrow).toBe("1")
                expect(style.flexBasis).toMatch(/^0(px|%)?$/)
                expect(style.borderRadius).toBe(trackStyle.borderRadius)
                expect(style.borderRadius).not.toMatch(/^0(px)?$/)
            }
        } finally {
            sheet.remove()
        }
    })
})

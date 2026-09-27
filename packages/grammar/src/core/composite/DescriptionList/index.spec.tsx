// @vitest-environment jsdom
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
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

const Glyph = (props: Record<string, unknown>) => <svg {...props}><path d="M1 1h1" /></svg>

const kpis = [
    { id: "runtime", icon: Glyph, term: "Runtime", description: "Provisioned", meta: "Singapore" },
    { id: "installs", icon: Glyph, term: "Installations", description: "2", unit: "modules", meta: "Inventoried at 10:00" },
    { id: "capabilities", term: "Capabilities on", description: "5/6", meta: "1 off" },
    { id: "conversations", icon: Glyph, term: "Conversations", description: "1,596", unit: "conversations" },
] as const

describe.each(FAMILY_WRAPS)("DescriptionList stat-strip under %s", (family, wrap) => {
    it("keeps one real description list: label term, figure value, unit in the value, meta as a second value", () => {
        const { container } = render(wrap(<DescriptionList layout="stat-strip" items={kpis} />))
        expect(screen.getByTestId("grammar-root").getAttribute("data-grammar-family")).toBe(expectedFamilyScope(family))
        const list = container.querySelector("dl")!
        expect(list.getAttribute("data-component")).toBe("DescriptionList")
        expect(list.getAttribute("data-grammar-description-layout")).toBe("stat-strip")
        const cells = [...list.querySelectorAll("[data-grammar-description-pair]")]
        expect(cells).toHaveLength(4)

        const installs = cells[1]!
        const [term, figure, meta] = [...installs.children]
        expect(term?.tagName).toBe("DT")
        expect(term?.textContent).toBe("Installations")
        expect(term?.querySelector("[data-component='IconTile']")?.getAttribute("data-tone")).toBe("neutral")
        expect(term?.querySelector("[data-component='IconTile']")?.getAttribute("data-size")).toBe("sm")
        expect(figure?.tagName).toBe("DD")
        expect(figure?.getAttribute("data-contract")).toBe("FONT-5")
        expect(figure?.querySelector(".starci-core-description-figure-value")?.textContent).toBe("2")
        expect(figure?.querySelector(".starci-core-description-unit")?.textContent).toBe("modules")
        expect(meta?.tagName).toBe("DD")
        expect(meta?.textContent).toBe("Inventoried at 10:00")

        // No icon, no unit, no meta: nothing is drawn for them.
        expect(cells[2]!.querySelector("[data-component='IconTile']")).toBeNull()
        expect(cells[2]!.querySelector(".starci-core-description-unit")).toBeNull()
        expect(cells[3]!.querySelector(".starci-core-description-meta")).toBeNull()
    })
})

describe("DescriptionList stat-strip geometry is shipped", () => {
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../../common/components-navigation.css"), "utf8")

    it("is a 2 x 2 grid below 48rem and one row of equal, hairline-divided cells at 48rem and wider", () => {
        expect(css).toMatch(/\[data-grammar-description-layout="stat-strip"\]\s*\{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[\s\S]*?gap: 1\.5rem;/)
        expect(css).toMatch(/@media \(min-width: 48rem\)\s*\{[\s\S]*?grid-auto-columns: minmax\(0, 1fr\);[\s\S]*?grid-auto-flow: column;[\s\S]*?column-gap: 0\.75rem;[\s\S]*?padding-inline-start: 0\.75rem;[\s\S]*?border-inline-start: 1px solid var\(--separator/)
    })

    it("sets the figure on FONT-5 with tabular numerals and the label, unit and meta muted at 400 (three sizes, two weights)", () => {
        expect(css).toMatch(/\.starci-core-description-stat-term\s*\{[\s\S]*?font-weight: 400;/)
        expect(css).toMatch(/\.starci-core-description-figure\s*\{[\s\S]*?font-size: 1\.875rem;[\s\S]*?font-weight: 600;[\s\S]*?line-height: 2\.25rem;[\s\S]*?font-variant-numeric: tabular-nums;/)
        expect(css).toMatch(/\.starci-core-description-unit\s*\{[\s\S]*?color: var\(--muted[\s\S]*?font-size: 0\.875rem;[\s\S]*?font-weight: 400;/)
        expect(css).toMatch(/\.starci-core-description-meta\s*\{[\s\S]*?color: var\(--muted[\s\S]*?font-size: 0\.875rem;[\s\S]*?line-height: 1\.25rem;/)
    })
})

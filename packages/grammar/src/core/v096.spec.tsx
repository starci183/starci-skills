// @vitest-environment jsdom
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { installDomShims } from "../__test__/grammarRoots.js"
import { Select } from "./branch/Select/index.js"
import { TagGroup } from "./composite/TagGroup/index.js"

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8")
const css = read("../common/components-navigation.css")
const offsetPopCss = read("../offset-pop/components-navigation.css")
const packageJson = JSON.parse(read("../../package.json")) as { version: string }
const SELECTABLE = '.starci-core-tag-group:is([data-grammar-tag-selection="single"], [data-grammar-tag-selection="multiple"]) .starci-core-tag'

beforeAll(installDomShims)
afterEach(cleanup)

const blocks = (source: string, selector: string) => [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => m[1]!.includes(selector)).map((m) => m[2]!)

describe("0.9.6: selectable TagGroup chips", () => {
    it("is at least 0.9.6", () => {
        expect(packageJson.version).toMatch(/^0\.9\.(6|7)$/)
    })

    it("paints unselected selectable chips as the secondary button with a 1px border", () => {
        const all = blocks(css, SELECTABLE).join("\n")
        expect(all).toMatch(/box-shadow: inset 0 0 0 1px var\(--starci-core-tag-ring, var\(--border/)
        expect(all).toMatch(/background: var\(--starci-core-tag-bg, var\(--default,[^)]*\)\) !important/)
        expect(all).toMatch(/background: var\(--starci-core-tag-bg-hover, var\(--default-hover/)
        expect(all).toMatch(/--starci-core-tag-ring: var\(--accent/)
    })

    it("keeps the selected fill and keeps forced colors visible", () => {
        expect(css).toMatch(/\.starci-core-tag:has\(> \[data-grammar-selected="true"\]\) \{\s*background: var\(--accent-soft[^;]*;\s*color: var\(--accent-soft-foreground/)
        expect(css).toMatch(/@media \(forced-colors: active\) \{\s*\.starci-core-tag-group:is[^{]*\{\s*outline: 1px solid ButtonText/)
    })

    it("never matches selectionMode none or off chips", () => {
        for (const rule of css.match(/\.starci-core-tag-group:is\([^{]*\{/g) ?? []) {
            expect(rule).not.toContain('"none"')
            expect(rule).toContain('.starci-core-tag:not([data-grammar-tag-state="off"])')
        }
        expect(css).toMatch(/\.starci-core-tag\[data-grammar-tag-state="off"\] \{\s*background: transparent !important;/)
    })

    it("gives Offset Pop the ink outline and secondary fill on selectable chips only", () => {
        const op = blocks(offsetPopCss, '[data-grammar-tag-selection="single"]').join("\n")
        expect(op).toContain("--starci-core-tag-bg: var(--default)")
        expect(op).toContain("var(--offset-pop-shadow-ink)")
        expect(offsetPopCss).toMatch(/\[data-component="TagGroup"\] \[data-grammar-tag\] \{[^}]*border: var\(--offset-pop-outline-width\) solid var\(--offset-pop-ink\)/)
    })

    it("stamps the selection mode the rule keys on and leaves aria-selected alone", () => {
        const { container, rerender } = render(<TagGroup label="F" items={[{ id: "a", label: "A" }]} selectionMode="multiple" defaultSelectedIds={["a"]} />)
        expect(container.querySelector("[data-component='TagGroup']")?.getAttribute("data-grammar-tag-selection")).toBe("multiple")
        expect(screen.getByRole("row", { name: "A" }).getAttribute("aria-selected")).toBe("true")
        rerender(<TagGroup label="F" items={[{ id: "a", label: "A" }]} />)
        expect(container.querySelector("[data-component='TagGroup']")?.getAttribute("data-grammar-tag-selection")).toBe("none")
    })
})

describe("0.9.6: Select isLabelHidden", () => {
    it("keeps the label as the accessible name, visually hidden", () => {
        const { container } = render(<Select label="Sort" isLabelHidden options={[{ id: "a", label: "A" }]} />)
        expect(screen.getByRole("button", { name: /Sort/ })).toBeTruthy()
        expect(container.querySelector("[data-grammar-field-label]")?.className).toContain("starci-core-form-label--screen-reader")
    })
})

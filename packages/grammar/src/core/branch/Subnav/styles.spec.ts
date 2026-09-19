import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const css = readFileSync(new URL("../../../common/styles.css", import.meta.url), "utf8")

describe("Core Subnav styles", () => {
    it("centres title content within the subnav row", () => {
        expect(css).toMatch(/\.starci-core-subnav-title\s*\{[\s\S]*?display: flex;[\s\S]*?align-items: center;/)
    })

    it("keeps sticky subnav text on one compositor layer while the page scrolls", () => {
        expect(css).toMatch(/data-grammar-subnav-position="sticky"[\s\S]*?backface-visibility: hidden;[\s\S]*?transform: translateZ\(0\);[\s\S]*?will-change: transform;/)
    })

    it("keeps a plain 44px menu target without turning the affordance into a circle", () => {
        expect(css).toMatch(/\.starci-core-subnav-toggle\s*\{[\s\S]*?width: 2\.75rem;[\s\S]*?height: 2\.75rem;[\s\S]*?border-radius: 0;[\s\S]*?background: transparent;/)
        expect(css).not.toMatch(/\.starci-core-subnav-toggle:hover/)
    })
})

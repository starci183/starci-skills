import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const css = readFileSync(new URL("../../../common/styles.css", import.meta.url), "utf8")
const rules = css.replace(/\/\*[\s\S]*?\*\//g, "")

/** The body of every rule whose (comment-free) selector list matches `selector` exactly. */
const bodiesOf = (selector: RegExp) => Array.from(rules.matchAll(/([^{}]+)\{([^{}]*)\}/g))
    .filter((match) => selector.test((match[1] ?? "").trim()))
    .map((match) => match[2] ?? "")

describe("Core Subnav styles", () => {
    it("centres title content within the subnav row", () => {
        expect(css).toMatch(/\.starci-core-subnav-title\s*\{[\s\S]*?display: flex;[\s\S]*?align-items: center;/)
    })

    it("keeps sticky subnav text on one compositor layer while the page scrolls", () => {
        expect(css).toMatch(/data-grammar-subnav-position="sticky"[\s\S]*?backface-visibility: hidden;[\s\S]*?transform: translateZ\(0\);[\s\S]*?will-change: transform;/)
    })

    /*
     * The toggle is a HeroUI Button, whose size, corner and fill live in the vendor's `components`
     * layer, so the plain square target has to be important to beat it (see the rule's comment).
     */
    it("keeps a plain 44px menu target without turning the affordance into a circle", () => {
        const [toggle, ...rest] = bodiesOf(/^\.starci-core-subnav-toggle$/).filter((body) => /width/.test(body))
        expect(rest).toEqual([])
        expect(toggle).toMatch(/(?:^|;)\s*width: 2\.75rem !important;/)
        expect(toggle).toMatch(/(?:^|;)\s*height: 2\.75rem !important;/)
        expect(toggle).toMatch(/(?:^|;)\s*border-radius: 0 !important;/)
        expect(toggle).toMatch(/(?:^|;)\s*background: transparent !important;/)
        expect(toggle).toMatch(/(?:^|;)\s*box-shadow: none !important;/)
    })

    it("gives the menu target no hover fill: a hover only re-asserts the transparent ground", () => {
        const hover = bodiesOf(/^\.starci-core-subnav-toggle:hover,\s*\.starci-core-subnav-toggle\[data-hovered="true"\]$/)
        expect(hover).toHaveLength(1)
        expect(hover[0]?.trim()).toBe("background: transparent !important;")
        const everyHoverRule = Array.from(rules.matchAll(/([^{}]*\.starci-core-subnav-toggle(?::hover|\[data-hovered[^\]]*\])[^{}]*)\{/g))
        expect(everyHoverRule).toHaveLength(1)
    })

    it("holds the 44px touch floor on a coarse pointer or a narrow viewport, as the form controls do", () => {
        const floor = rules.match(/@media \(pointer: coarse\), \(max-width: 40rem\) \{\s*\.starci-core-subnav-toggle \{([^}]*)\}/)
        expect(floor?.[1]).toMatch(/min-inline-size: var\(--starci-core-control-min-size, 2\.75rem\);/)
        expect(floor?.[1]).toMatch(/min-block-size: var\(--starci-core-control-min-size, 2\.75rem\);/)
        expect(floor?.[1], "a minimum owes the vendor layer no !important").not.toContain("!important")
    })
})

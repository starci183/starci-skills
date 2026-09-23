import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { COMMON_NAVIGATION_COMPONENTS } from "../common/renderers-navigation.js"

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8")

const familyCss = read("src/offset-pop/components-navigation.css")
const commonCss = read("src/common/components-navigation.css")
const commonEntry = read("src/common/styles.css")

/** Renderer source for every component this group adds, keyed by public name. */
const RENDERERS: Readonly<Record<keyof typeof COMMON_NAVIGATION_COMPONENTS, string>> = {
    Accordion: "src/core/branch/Accordion/index.tsx",
    Avatar: "src/core/primitive/Avatar/index.tsx",
    AvatarGroup: "src/core/composite/AvatarGroup/index.tsx",
    BottomNav: "src/core/composition/BottomNav/index.tsx",
    Breadcrumbs: "src/core/composite/Breadcrumbs/index.tsx",
    Calendar: "src/core/branch/Calendar/index.tsx",
    DataTable: "src/core/branch/DataTable/index.tsx",
    DescriptionList: "src/core/composite/DescriptionList/index.tsx",
    Disclosure: "src/core/branch/Disclosure/index.tsx",
    Footer: "src/core/composition/Footer/index.tsx",
    Image: "src/core/primitive/Image/index.tsx",
    Link: "src/core/primitive/Link/index.tsx",
    ListBox: "src/core/branch/ListBox/index.tsx",
    Pagination: "src/core/composite/Pagination/index.tsx",
    Rating: "src/core/primitive/Rating/index.tsx",
    Stepper: "src/core/composite/Stepper/index.tsx",
    TagGroup: "src/core/composite/TagGroup/index.tsx",
    Timeline: "src/core/composite/Timeline/index.tsx",
    TopBar: "src/core/composition/TopBar/index.tsx",
}

const rendererSource = Object.values(RENDERERS).map(read).join("\n")
const names = Object.keys(COMMON_NAVIGATION_COMPONENTS) as ReadonlyArray<keyof typeof COMMON_NAVIGATION_COMPONENTS>

const selectorLines = (css: string) => css
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => (line.startsWith(".") || line.startsWith("[")) && (line.endsWith("{") || line.endsWith(",")))

describe("Offset Pop navigation-group treatment", () => {
    it("lives in the Offset Pop layer, scoped to the family root, and never imports Core or Common", () => {
        expect(familyCss).toContain("@layer starci-grammar-offset-pop {")
        expect(familyCss).not.toMatch(/@import/)
        expect(familyCss).not.toContain("starci-grammar-core")
        const selectors = selectorLines(familyCss)
        expect(selectors.length).toBeGreaterThan(40)
        for (const selector of selectors) {
            expect(selector, selector).toMatch(/^\.grammar-common-root\[data-grammar-family="offset-pop"\] /)
        }
    })

    it("targets every component this group adds by its data-component hook", () => {
        expect(names).toHaveLength(19)
        for (const name of names) {
            expect(familyCss, `missing Offset Pop treatment for ${name}`).toContain(`[data-component="${name}"]`)
            expect(read(RENDERERS[name]), `${name} must emit its hook`).toContain(`data-component="${name}"`)
        }
    })

    it("targets only hooks the Common renderers emit", () => {
        const hooks = new Set(Array.from(familyCss.matchAll(/\[(data-grammar-[a-z-]+)(?:[=\]])/g), (match) => match[1] ?? ""))
        hooks.delete("data-grammar-family")
        expect(hooks.size).toBeGreaterThan(20)
        for (const hook of hooks) expect(rendererSource, `missing renderer hook: ${hook}`).toContain(hook)
    })

    it("draws the family signature: ink outline, hard offset shadow, pink current/selected, chunky bottom nav", () => {
        expect(familyCss).toContain("var(--offset-pop-outline-width) solid var(--offset-pop-ink)")
        expect(familyCss).toContain("var(--offset-pop-shadow-ink)")
        expect(familyCss).toContain("var(--offset-pop-shadow-x)")
        expect(familyCss).toContain("var(--shadow-surface)")
        expect(familyCss).toMatch(/\[data-component="BottomNav"\] \[data-grammar-current="true"\][^{]*\{[^}]*--offset-pop-pink/)
        expect(familyCss).toMatch(/\[data-component="Pagination"\] \[data-grammar-current="true"\] \{[^}]*--offset-pop-pink/)
        expect(familyCss).toMatch(/\[data-component="TagGroup"\] \[data-grammar-tag\]:has\(> \[data-grammar-selected="true"\]\) \{[^}]*--offset-pop-pink/)
        expect(familyCss).toMatch(/\[data-component="BottomNav"\] \[data-grammar-bottom-nav-item\] \{[^}]*min-block-size: 4rem/)
        expect(familyCss).toMatch(/\[data-component="BottomNav"\] \{[^}]*calc\(var\(--offset-pop-outline-width\) \* 1\.5\)/)
    })

    it("uses only family and semantic variables for colour", () => {
        expect(familyCss).not.toMatch(/#[0-9a-f]{3,8}\b/i)
        expect(familyCss).not.toMatch(/\b(?:rgb|hsl|oklch)a?\(/)
    })

    it("keeps reduced-motion, narrow and forced-colour fallbacks", () => {
        expect(familyCss).toContain("@media (prefers-reduced-motion: reduce)")
        expect(familyCss).toContain("@media (max-width: 30rem)")
        expect(familyCss).toContain("@media (forced-colors: active)")
    })
})

describe("Common navigation-group anatomy", () => {
    it("is imported first by the Common entry and lives in the Common layer", () => {
        expect(commonEntry.split("\n")[0]).toBe("@import \"./components-navigation.css\";")
        expect(commonCss).toContain("@layer starci-grammar-common {")
        expect(commonCss).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    })

    it("draws an anatomy root for every component", () => {
        const roots: Readonly<Record<keyof typeof COMMON_NAVIGATION_COMPONENTS, string>> = {
            Accordion: ".starci-core-generic-accordion", Avatar: ".starci-core-avatar", AvatarGroup: ".starci-core-avatar-group",
            BottomNav: ".starci-core-bottom-nav", Breadcrumbs: ".starci-core-breadcrumbs", Calendar: ".starci-core-calendar",
            DataTable: ".starci-core-data-table", DescriptionList: ".starci-core-description-list", Disclosure: ".starci-core-disclosure",
            Footer: ".starci-core-footer", Image: ".starci-core-image", Link: ".starci-core-link", ListBox: ".starci-core-list-box",
            Pagination: ".starci-core-pagination", Rating: ".starci-core-rating", Stepper: ".starci-core-stepper",
            TagGroup: ".starci-core-tag-group", Timeline: ".starci-core-timeline", TopBar: ".starci-core-top-bar",
        }
        for (const name of names) {
            const drawn = commonCss.includes(`${roots[name]} {`) || commonCss.includes(`${roots[name]},\n`)
            expect(drawn, `missing Common anatomy for ${name}`).toBe(true)
            expect(read(RENDERERS[name]), `${name} must carry ${roots[name]}`).toContain(`"${roots[name].slice(1)}"`)
        }
    })

    it("keeps 44px targets, the safe-area inset and the 360px reflow rules", () => {
        expect(commonCss).toMatch(/\.starci-core-bottom-nav \{[^}]*env\(safe-area-inset-bottom/)
        expect(commonCss).toMatch(/\.starci-core-bottom-nav-item \{[^}]*min-block-size: 3\.5rem/)
        expect(commonCss).toMatch(/\.starci-core-pagination-step \{[^}]*min-block-size: 2\.75rem/)
        expect(commonCss).toMatch(/\.starci-core-data-table-scroll \{[^}]*overflow-x: auto/)
        expect(commonCss).toMatch(/\.starci-core-data-table\[data-grammar-table-sticky="true"\] \.starci-core-data-table-header \{[^}]*position: sticky/)
        expect(commonCss).toContain("@media (max-width: 30rem)")
        expect(commonCss).toContain("@media (prefers-reduced-motion: reduce)")
        expect(commonCss).toContain("@media (forced-colors: active)")
    })
})

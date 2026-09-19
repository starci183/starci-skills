import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
    navigationFeatureNavCompactNavigationClassName,
    navigationFeatureNavNavigationClassName,
    navigationFeatureNavPrimaryClassName,
} from "./classNames.js"

const css = readFileSync(new URL("../../../common/styles.css", import.meta.url), "utf8")
const navbarStart = css.indexOf(".starci-core-navigation-feature-nav {")
const navbarEnd = css.indexOf(".starci-core-workspace-shell {")
const navbarCss = css.slice(navbarStart, navbarEnd)

describe("Common NavigationFeatureNav anatomy styles", () => {
    it("draws only the outer bottom separator across its two layers", () => {
        expect(navbarStart).toBeGreaterThanOrEqual(0)
        expect(navbarEnd).toBeGreaterThan(navbarStart)
        expect(navbarCss).toMatch(/\.starci-core-navigation-feature-nav\s*\{[\s\S]*?border-bottom:/)
        const featureStart = navbarCss.indexOf(".starci-core-navigation-feature-nav-feature {")
        const featureEnd = navbarCss.indexOf("}", featureStart)
        const featureRule = navbarCss.slice(featureStart, featureEnd + 1)
        expect(featureRule).not.toMatch(/border(?:-top|-bottom)?:/)
        expect(navbarCss).toMatch(/\.starci-core-navigation-feature-nav-feature \.tabs__list-container\s*\{[\s\S]*?border-bottom-width: 0 !important;/)
        expect(navbarCss).toMatch(/\.starci-core-navigation-feature-nav-feature \.starci-core-tabs-scroll\s*\{[\s\S]*?padding-block: 0;/)
        expect(navbarCss).toMatch(/\.starci-core-navigation-feature-nav-feature \.starci-core-tabs \.tabs__indicator\s*\{[\s\S]*?inset-block-end: 0 !important;/)
        expect(navbarCss).toMatch(/\.starci-core-navigation-feature-nav-primary\.starci-core-page-container\s*\{[\s\S]*?padding-inline: 0\.75rem;/)
        expect(navbarCss).toMatch(/\.starci-core-navigation-feature-nav-feature\s*\{[\s\S]*?width: 100%;[\s\S]*?padding-inline: 0\.75rem;/)
        expect(navbarCss).not.toMatch(/\.starci-core-navigation-feature-nav-feature\.starci-core-page-container/)
        expect(navbarCss).not.toContain(".extended-tabs")
        expect(navbarCss).not.toMatch(/grid-template-columns: 16rem minmax\(0, 1fr\)/)
    })

    it("hides primary destination text at compact widths and restores it on desktop", () => {
        expect(navbarCss).toMatch(/\.starci-core-navigation-feature-nav-primary\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto auto !important;/)
        expect(navbarCss).toMatch(/\.starci-core-navigation-feature-nav-navigation\s*\{[\s\S]*?display: none !important;/)
        expect(navbarCss).toMatch(/\.starci-core-navigation-feature-nav-compact-navigation\s*\{[\s\S]*?display: block !important;/)
        expect(navbarCss).toContain("@media (min-width: 48rem)")
        expect(navbarCss).toMatch(/@media \(min-width: 48rem\)[\s\S]*?\.starci-core-navigation-feature-nav-navigation\s*\{[\s\S]*?display: block !important;/)
        expect(navbarCss).toMatch(/@media \(min-width: 48rem\)[\s\S]*?\.starci-core-navigation-feature-nav-compact-navigation\s*\{[\s\S]*?display: none !important;/)
    })

    it("keeps responsive visibility under the Grammar stylesheet instead of utility generation", () => {
        const responsiveUtilityTokens = ["block", "hidden", "grid", "md:block", "md:hidden", "md:grid-cols-[auto_minmax(0,1fr)_auto]"]
        const grammarClassTokens = [
            ...(navigationFeatureNavPrimaryClassName ?? "").split(" "),
            ...(navigationFeatureNavNavigationClassName ?? "").split(" "),
            ...(navigationFeatureNavCompactNavigationClassName ?? "").split(" "),
        ]

        expect(grammarClassTokens).not.toEqual(expect.arrayContaining(responsiveUtilityTokens))
    })

    it("gives every pressable in the band's navigation, action and compact slots a 44px minimum target", () => {
        expect(navbarCss).toMatch(/\.starci-core-navigation-feature-nav-actions :where\(button, \[role="button"\], a\[href\]\),\s*\.starci-core-navigation-feature-nav-navigation :where\(button, \[role="button"\], a\[href\]\),\s*\.starci-core-navigation-feature-nav-compact-navigation :where\(button, \[role="button"\], a\[href\]\)\s*\{\s*min-inline-size: 44px;\s*min-block-size: 44px;\s*\}/)
    })

    it("keeps the floor on the pressable and the row height off the slot", () => {
        for (const slot of [".starci-core-navigation-feature-nav-actions {", ".starci-core-navigation-feature-nav-navigation {", ".starci-core-navigation-feature-nav-compact-navigation {"]) {
            const start = navbarCss.indexOf(slot)
            expect(start, `missing shipped rule for ${slot}`).toBeGreaterThanOrEqual(0)
            expect(navbarCss.slice(start, navbarCss.indexOf("}", start)), `${slot} must not size the row itself`).not.toMatch(/min-height|min-block-size|height:/)
        }
        expect(navbarCss).toMatch(/\.starci-core-navigation-feature-nav-primary\s*\{[\s\S]*?min-height: 4rem;/)
        expect(navbarCss).toMatch(/\.starci-core-navigation-feature-nav-primary\s*\{[\s\S]*?padding-block: var\(--starci-core-inline-gap, 0\.5rem\);/)
    })

    it("gives the identity slot's plain pressable and every route destination the same 44px floor", () => {
        expect(navbarCss).toMatch(/\.starci-core-navigation-feature-nav-identity \.starci-core-text-action\[data-appearance="plain"\]\s*\{\s*min-block-size: var\(--starci-core-control-min-size, 2\.75rem\);\s*\}/)
        expect(css).toMatch(/\.starci-core-text-action\[data-appearance="route"\]\s*\{\s*border-radius: var\(--starci-core-pill-radius, 999px\);\s*padding: 0\.5rem 0\.75rem;\s*min-block-size: var\(--starci-core-control-min-size, 2\.75rem\);/)
    })

    it("keeps Subnav compact and gives its icon trigger a 44px target", () => {
        expect(navbarCss).toMatch(/\.starci-core-subnav-toggle\s*\{[\s\S]*?width: 2\.75rem !important;[\s\S]*?height: 2\.75rem !important;/)
        expect(navbarCss).toMatch(/@media \(min-width: 70rem\)[\s\S]*?data-grammar-subnav-visibility="compact"[\s\S]*?display: none;/)
    })
})

/**
 * The band publishes where it stops, so no page has to restate it.
 *
 * Four consumer lines motivated this: a dashboard rail pinned with `calc(6rem+1px)` and bounded
 * with `calc(100dvh-4rem-2rem-1px)`, both of which are this band's own geometry written out by
 * hand. The check is that the numbers live HERE, once, keyed by the attributes the compositions
 * already emit - and that a page with no band still resolves its own fallback.
 */
describe("Common sticky band offset", () => {
    it("publishes the primary row, its separator and the stacked feature layer", () => {
        expect(navbarCss).toMatch(/:has\(\.starci-core-navigation-feature-nav\[data-grammar-navigation-feature-nav-position="sticky"\]\)\s*\{\s*--starci-core-band-height: calc\(4rem \+ 1px\);/)
        expect(navbarCss).toMatch(/data-grammar-navigation-feature-nav-layers="two"\]\)\s*\{\s*--starci-core-band-height: calc\(4rem \+ 2rem \+ 1px\);/)
    })

    it("adds a stacked sticky Subnav and drops it once a compact one is hidden", () => {
        expect(navbarCss).toMatch(/:has\(\.starci-core-subnav\[data-grammar-subnav-position="sticky"\]\)\s*\{\s*--starci-core-band-subnav-height: calc\(3\.25rem \+ 1px\);/)
        expect(navbarCss).toMatch(/@media \(min-width: 70rem\)[\s\S]*?data-grammar-subnav-visibility="compact"\]\)\s*\{\s*--starci-core-band-subnav-height: 0rem;/)
    })

    it("keeps its published height, because a 44px target still fits the 4rem row", () => {
        expect(navbarCss).toMatch(/--starci-core-band-height: calc\(4rem \+ 1px\);/)
        const rowHeight = 4 * 16
        const blockInset = 0.5 * 16 * 2
        expect(rowHeight - blockInset, "raising the touch floor above this would grow the band").toBeGreaterThanOrEqual(44)
    })

    it("sums the two into one property a page reads", () => {
        expect(navbarCss).toContain("--starci-core-band-offset: calc(var(--starci-core-band-height, 0rem) + var(--starci-core-band-subnav-height, 0rem));")
    })

    it("defines nothing when no band is sticky, so an existing fallback still resolves", () => {
        expect(css.match(/--starci-core-band-(?:offset|height|subnav-height):/g)?.length).toBe(5)
        for (const rule of css.split("}")) {
            if (!rule.includes("--starci-core-band-offset:") && !rule.includes("--starci-core-band-height:") && !rule.includes("--starci-core-band-subnav-height:")) continue
            expect(rule, "a band property may only be defined under a presence selector").toContain(":has(")
        }
    })

    it("lets the Subnav and a sticky Rail read it instead of taking a consumer's calc", () => {
        expect(css).toMatch(/\.starci-core-subnav\[data-grammar-subnav-position="sticky"\]\s*\{[\s\S]*?top: var\(--starci-core-subnav-offset, var\(--starci-core-band-height, 4rem\)\);/)
        expect(css).toMatch(/\.starci-core-rail\[data-grammar-rail-mode="sticky"\] \.starci-core-rail-frame\s*\{[\s\S]*?top: var\(--starci-core-rail-offset, var\(--starci-core-band-offset, 5\.5rem\)\);/)
        expect(css).toMatch(/\.starci-core-rail-frame\s*\{[\s\S]*?max-height: calc\(100dvh - var\(--starci-core-rail-offset, var\(--starci-core-band-offset, 5\.5rem\)\) - 1\.5rem\);/)
    })
})

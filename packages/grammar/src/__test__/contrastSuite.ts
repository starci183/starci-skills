/**
 * The WCAG AA contrast suite every family's `styles.spec.ts` runs against its own scope.
 *
 * It measures what the scope RESOLVES, light and dark, through `./contrast.ts`: HeroUI's vendor
 * variables included, so a variable the family forgot to re-map shows up as the inherited
 * `:root` value it really renders with. Excluded from the build with the rest of `src/__test__/`.
 */
import { describe, expect, it } from "vitest"
import {
    darkAndSystemBlocks,
    heroUiThemeVariables,
    measureAll,
    PAIRS,
    scopeOf,
    sourceOf,
    toneTextPairs,
    unroutedSelectors,
    type Family,
    type Measured,
    type Theme,
    type ToneText,
} from "./contrast.js"

const describeFailure = (m: Measured) =>
    `${m.theme}: ${m.fg} on ${m.bg}${m.under === undefined ? "" : ` over ${m.under}`} = ${m.ratio.toFixed(2)}:1 (${m.fgHex} on ${m.bgHex}), needs ${m.min} - ${m.where}`

export const contrastSuite = (family: Family, tones: { readonly accent: ToneText; readonly danger: ToneText }) => {
    describe(`${family} colour contrast (WCAG AA, light and dark)`, () => {
        const themeVariables = heroUiThemeVariables()

        it("re-declares every HeroUI theme variable on its own scope, so none arrives resolved for HeroUI's light :root", () => {
            expect(themeVariables.length).toBeGreaterThan(50)
            for (const name of ["--default", "--field-background", "--segment", "--overlay", "--accent-soft", "--link"]) {
                expect(themeVariables).toContain(name)
            }
            for (const theme of ["light", "dark"] as const) {
                const scope = scopeOf(family, theme)
                expect(themeVariables.filter((name) => sourceOf(scope, name) !== "scope"), `${theme} inherits from :root`).toEqual([])
            }
        })

        it("resolves the system-dark scope exactly like the explicit dark scope", () => {
            const { dark, system } = darkAndSystemBlocks(family)
            expect(system.map((layer) => Object.fromEntries(layer))).toEqual(dark.map((layer) => Object.fromEntries(layer)))
        })

        const pairs = [...PAIRS, ...toneTextPairs("accent", tones.accent.text), ...toneTextPairs("danger", tones.danger.text)]
        for (const theme of ["light", "dark"] as Array<Theme>) {
            it(`clears AA for every foreground/background pair the CSS combines, ${theme}`, () => {
                const measured = measureAll(family, theme, pairs)
                expect(measured.length).toBeGreaterThan(90)
                expect(measured.filter((m) => m.ratio < m.min).map(describeFailure)).toEqual([])
            })
        }

        for (const [tone, text] of Object.entries(tones) as Array<[keyof typeof tones, ToneText]>) {
            if (text.routes === undefined) continue
            const routes = text.routes
            it(`routes every place HeroUI or Common paints the ${tone} as text to the text-safe ${tone}`, () => {
                expect(unroutedSelectors(tone, routes)).toEqual([])
            })
        }
    })
}

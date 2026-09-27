import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { parseColor, ratio } from "../../../__test__/contrast.js"
import { cssRules } from "../../../__test__/styleClaims.js"
import { STARCI_CORE_DNA } from "../../dna.js"

const here = dirname(fileURLToPath(import.meta.url))
const common = readFileSync(resolve(here, "../../../common/styles.css"), "utf8")
const offsetPop = readFileSync(resolve(here, "../../../offset-pop/styles.css"), "utf8")

/** The custom properties the first rule whose selector matches declares. */
const declared = (css: string, selector: RegExp): Map<string, string> => {
    const rule = cssRules(css).find((candidate) => selector.test(candidate.selector))
    expect(rule, `no rule ${selector}`).toBeTruthy()
    const table = new Map<string, string>()
    for (const part of rule!.body.split(";")) {
        const at = part.indexOf(":")
        const name = part.slice(0, at).trim()
        if (at > 0 && name.startsWith("--")) table.set(name, part.slice(at + 1).trim())
    }
    return table
}

/** Resolve `var(--name[, fallback])` against a table, repeatedly, then read the colour. */
const resolveColour = (value: string, table: ReadonlyMap<string, string>) => {
    let current = value
    for (let pass = 0; pass < 8 && current.includes("var("); pass += 1) {
        current = current.replace(/var\((--[\w-]+)(?:,\s*([^()]*?))?\)/g, (_, name: string, fallback?: string) => table.get(name) ?? fallback ?? "")
    }
    return parseColor(current)
}

const AA = 4.5
const TEXT = ["--grammar-ink-band-foreground", "--grammar-ink-band-muted", "--success-soft-foreground", "--warning-soft-foreground", "--danger-soft-foreground"]

/**
 * Every text colour the ink band re-binds, measured on its ground for the inks it will meet: Core's violet
 * accent, an ink-as-accent product (#040d1c), HeroUI's blue, a light (dark-theme) accent, a mid-tone at the
 * light/dark switch, and Offset Pop's ink in both themes. The band picks its own foreground from the ink's
 * lightness, so the accent-foreground passed in is never read.
 */
describe("ink band colours clear AA on the ground", () => {
    const band = declared(common, /^\.starci-core-surface\[data-grammar-surface-treatment="ink"\]$/)

    it.each([
        ["Core violet accent", STARCI_CORE_DNA.color.accent, "#ffffff"],
        ["ink accent (#040d1c)", "#040d1c", "#ffffff"],
        ["HeroUI blue accent (bare Common)", "oklch(53% 0.2 256)", "#ffffff"],
        ["a light accent (a dark theme's lifted accent)", "oklch(80% 0.12 150)", "#0b0b0b"],
        ["a mid-tone accent at the switch", "oklch(62% 0.15 30)", "#ffffff"],
    ])("Common rule on %s", (_, accent, accentForeground) => {
        const table = new Map([...band, ["--accent", accent], ["--accent-foreground", accentForeground],
            ["--success", STARCI_CORE_DNA.color.light.success], ["--warning", STARCI_CORE_DNA.color.light.warning], ["--danger", STARCI_CORE_DNA.color.light.danger]])
        const ground = resolveColour("var(--grammar-ink-band)", table)!
        expect(ground).not.toBeNull()
        for (const name of TEXT) {
            const colour = resolveColour(`var(${name})`, table)
            expect(colour, name).not.toBeNull()
            expect(ratio(colour!, ground), `${name} on ${accent}`).toBeGreaterThanOrEqual(AA)
        }
    })

    it.each([
        ["light", "#1c1524", "#fff8ef"],
        ["dark", "#fff8ef", "#17121d"],
    ])("Offset Pop rule, %s theme", (_, ink, canvas) => {
        const family = declared(offsetPop, /data-grammar-surface-treatment="ink"\]$/)
        const table = new Map([...band, ...family, ["--offset-pop-ink", ink], ["--offset-pop-canvas", canvas],
            ["--offset-pop-mint", "#91e4ca"], ["--offset-pop-yellow", "#ffd447"], ["--offset-pop-critical", "#e84a5f"]])
        const ground = resolveColour("var(--grammar-ink-band)", table)!
        expect(ground).not.toBeNull()
        for (const name of TEXT) {
            const colour = resolveColour(`var(${name})`, table)
            expect(colour, name).not.toBeNull()
            expect(ratio(colour!, ground), `${name} on ${ink}`).toBeGreaterThanOrEqual(AA)
        }
    })

    it("keeps the motif and the hairline quiet: above the ground, below the muted ink", () => {
        const table = new Map([...band, ["--accent", "#040d1c"], ["--accent-foreground", "#ffffff"]])
        const ground = resolveColour("var(--grammar-ink-band)", table)!
        const muted = ratio(resolveColour("var(--grammar-ink-band-muted)", table)!, ground)
        for (const name of ["--grammar-ink-band-orbit", "--grammar-ink-band-separator"]) {
            const quiet = ratio(resolveColour(`var(${name})`, table)!, ground)
            expect(quiet, name).toBeGreaterThan(1)
            expect(quiet, name).toBeLessThan(muted)
        }
    })
})

describe("ink band geometry is shipped, closed and motion-free", () => {
    it("clips the bleed, isolates the stack and keeps content above the decorative zone", () => {
        expect(common).toMatch(/\.starci-core-surface\[data-grammar-surface-treatment="ink"\]\s*\{[\s\S]*?container: starci-core-ink-band \/ inline-size;[\s\S]*?isolation: isolate;/)
        expect(common).toMatch(/\.starci-core-surface\[data-grammar-surface-treatment="ink"\] > \.starci-core-surface-content\s*\{[\s\S]*?z-index: 1;/)
        expect(common).toMatch(/\.starci-core-surface-artwork\s*\{[\s\S]*?width: 11\.25rem;[\s\S]*?height: 7\.5rem;[\s\S]*?pointer-events: none;/)
        expect(common).toMatch(/@container starci-core-ink-band \(min-width: 48rem\)\s*\{\s*\.starci-core-surface-artwork\s*\{[\s\S]*?position: absolute;[\s\S]*?width: 22\.5rem;[\s\S]*?height: 15rem;/)
    })

    it("never animates the artwork zone and drops the motif under forced colours", () => {
        const zoneRules = cssRules(common).filter((rule) => /starci-core-surface-(artwork|orbit)/.test(rule.selector))
        expect(zoneRules.length).toBeGreaterThan(0)
        for (const rule of zoneRules) expect(rule.body).not.toMatch(/animation|transition/)
        expect(common).toMatch(/\.starci-core-surface-orbit\s*\{\s*display: none;/)
    })
})

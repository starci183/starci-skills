import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import {
    STARCI_CORE_DARK_TOKEN_DEFAULTS,
    STARCI_CORE_SPACING_SCALE,
    STARCI_CORE_TOKEN_NAMES,
} from "../core/dna.js"
import {
    OFFSET_POP_BAND_TOKEN_NAMES,
    OFFSET_POP_DARK_TOKEN_DEFAULTS,
    OFFSET_POP_DNA,
    OFFSET_POP_SPACING_SCALE,
    OFFSET_POP_TOKEN_DEFAULTS,
    OFFSET_POP_TOKEN_NAMES,
} from "./dna.js"
import { contrastSuite } from "../__test__/contrastSuite.js"

const css = readFileSync(resolve(process.cwd(), "src/offset-pop/styles.css"), "utf8")
const coreCss = readFileSync(resolve(process.cwd(), "src/core/styles.css"), "utf8")
const commonCss = readFileSync(resolve(process.cwd(), "src/common/styles.css"), "utf8")

type Declarations = ReadonlyMap<string, string>

/** The custom-property declarations of the first `{...}` block the pattern opens. */
const block = (source: string, opener: RegExp): Declarations => {
    const match = source.match(opener)
    expect(match, `missing block ${opener}`).not.toBeNull()
    const start = (match?.index ?? 0) + (match?.[0].length ?? 0)
    // Comments are prose, never declarations: a comment naming "--surface-tertiary: ..." is not one.
    const body = source.slice(start, source.indexOf("}", start)).replace(/\/\*[\s\S]*?\*\//g, "")
    return new Map(Array.from(body.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g), (m) => [m[1] ?? "", (m[2] ?? "").replace(/\s+/g, " ").trim()]))
}

const familyBlocks = (source: string, family: string) => {
    const scope = `\\.grammar-common-root\\[data-grammar-family="${family}"\\]`
    return {
        root: block(source, new RegExp(`${scope}\\s*\\{`)),
        dark: block(source, new RegExp(`${scope}\\[data-grammar-theme="dark"\\]\\s*\\{`)),
        system: block(source, new RegExp(`@media \\(prefers-color-scheme: dark\\)\\s*\\{\\s*${scope}\\[data-grammar-theme="system"\\]\\s*\\{`)),
        forced: block(source, new RegExp(`@media \\(forced-colors: active\\)\\s*\\{\\s*${scope}[^{]*\\{`)),
    }
}

const offsetPop = familyBlocks(css, "offset-pop")
const core = familyBlocks(coreCss, "core")
const commonRoot = block(commonCss, /\.grammar-common-root\s*\{/)

/**
 * Core-only roles Offset Pop does not mirror. 0.5.1 added the StarCi Academy tertiary face to Core
 * alone (owner ruling: a StarCi brand token, published under the family's own name
 * `--starci-surface-tertiary`); Common never reads it, so no Common variable goes unfed without it.
 */
const CORE_ONLY_KEYS: ReadonlySet<string> = new Set(["surfaceTertiary"])
/** Family-owned names Core publishes for its own products; Common never reads them. */
const CORE_ONLY_BINDINGS: ReadonlySet<string> = new Set(["--starci-surface-tertiary", "--starci-surface-tertiary-foreground"])

/** Common semantic variables a family feeds: every unprefixed property Core's root sets. */
const commonVariablesCoreFeeds = [...core.root.keys()].filter((name) => !name.startsWith("--starci-core-") && !CORE_ONLY_BINDINGS.has(name))

type TokenKey = keyof typeof STARCI_CORE_TOKEN_NAMES
const coreKeyOf = new Map(Object.entries(STARCI_CORE_TOKEN_NAMES).map(([key, name]) => [name, key as TokenKey]))
const isCoreOnly = (coreName: string) => CORE_ONLY_KEYS.has(coreKeyOf.get(coreName) ?? "")
const offsetPopNameFor = (coreName: string) => {
    const key = coreKeyOf.get(coreName)
    expect(key, `${coreName} is not a Core token`).toBeDefined()
    return OFFSET_POP_TOKEN_NAMES[key as Exclude<TokenKey, "surfaceTertiary">]
}

const luminance = (hex: string) => {
    const channel = (offset: number) => {
        const value = parseInt(hex.slice(offset, offset + 2), 16) / 255
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}
const contrast = (a: string, b: string) => {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
    return Math.round(((high + 0.05) / (low + 0.05)) * 100) / 100
}
const rendererSource = [
    "src/core/primitive/Badge/index.tsx",
    "src/core/primitive/Button/index.tsx",
    "src/core/primitive/Heading/index.tsx",
    "src/core/primitive/Text/index.tsx",
    "src/core/branch/SurfaceCard/index.tsx",
    "src/core/branch/SurfaceListCard/index.tsx",
    "src/core/branch/Rail/index.tsx",
    "src/core/composite/StaticStateRow/index.tsx",
    "src/core/composition/NavigationFeatureNav/index.tsx",
    "src/core/StateMark.tsx",
    "src/core/primitive/SectionHeader/index.tsx",
    "src/core/primitive/TextAction/index.tsx",
    "src/core/composite/VerticalScrollRegion/index.tsx",
].map((path) => readFileSync(resolve(process.cwd(), path), "utf8")).join("\n")

describe("Offset Pop family CSS", () => {
    it("imports Common, uses the formal family scope, and never imports Core", () => {
        expect(css).toContain("@import \"../common/styles.css\"")
        expect(css).not.toContain("@import \"../core/styles.css\"")

        const selectorLines = css
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.startsWith(".grammar-common-root") && line.endsWith("{"))

        expect(selectorLines.length).toBeGreaterThan(25)
        for (const selector of selectorLines) {
            expect(selector).toContain("[data-grammar-family=\"offset-pop\"]")
        }
    })

    it("targets only hooks emitted by Common public renderers", () => {
        const hooks = Array.from(css.matchAll(/\[(data-component|data-grammar-[a-z-]+)(?:[=\]])/g), (match) => match[1])
        const familyRootHooks = new Set(["data-grammar-family", "data-grammar-theme"])

        expect(hooks.length).toBeGreaterThan(20)
        for (const hook of new Set(hooks)) {
            if (familyRootHooks.has(hook)) continue
            expect(rendererSource, `missing renderer hook: ${hook}`).toContain(hook)
        }

        for (const invented of [
            "data-grammar-dot-field",
            "data-grammar-display",
            "data-grammar-muted",
            "data-grammar-accent",
            "data-grammar-band",
            "data-grammar-emphasis",
            "data-grammar-floating-cluster",
            "data-grammar-floating-item",
        ]) {
            expect(css).not.toContain(invented)
        }
    })

    it("binds semantic Common variables and preserves hard family surface geometry", () => {
        expect(css).toContain("--offset-pop-accent: #ff3593")
        expect(css).toContain("--accent: var(--offset-pop-accent)")
        expect(css).toContain("--field-radius: var(--offset-pop-control-radius)")
        expect(css).toContain("--shadow-surface:")
        expect(css).not.toContain("--starci-core-")
        expect(css).toContain("--offset-pop-shadow-x: 0.25rem")
        expect(css).toContain("--offset-pop-shadow-y: 0.5rem")
        expect(css).toMatch(/data-grammar-surface-depth="top"[\s\S]*?box-shadow: var\(--shadow-surface\)/)
        expect(css).toMatch(/data-grammar-surface-depth="nested"[\s\S]*?box-shadow: none/)
        expect(rendererSource).toContain("<Card.Root")
        expect(rendererSource).toContain("<Card.Header")
        expect(rendererSource).toContain("<Card.Content")
        expect(css).toContain("[data-grammar-surface-card][data-slot=\"card\"]")
        expect(css).toContain("[data-grammar-frame=\"bounded\"][data-slot=\"card-content\"]")
    })

    it("uses invariant spacing for focus, press, responsive, and reduced-motion vectors", () => {
        expect(css).toContain("outline-offset: 0.25rem")
        expect(css).toContain("transform: translate(0.25rem, 0.25rem)")
        expect(css).toContain("@media (max-width: 40rem)")
        expect(css).toContain("@media (prefers-reduced-motion: reduce)")
        expect(css).toContain("--offset-pop-transition: 0ms linear")
    })

    it("owns dark, system, forced-color, and closed state treatments", () => {
        expect(css).toContain("[data-grammar-theme=\"dark\"]")
        expect(css).toContain("@media (prefers-color-scheme: dark)")
        expect(css).toContain("@media (forced-colors: active)")

        for (const state of ["affirmative", "informative", "cautionary", "negative", "pending", "unavailable"]) {
            expect(css).toContain(`data-grammar-state="${state}"`)
        }
    })

    it("contains no domain vocabulary", () => {
        const forbidden = ["price", "checkout", "enrollment", "student", "exam", "course", "entitlement"]
        for (const word of forbidden) expect(css.toLowerCase()).not.toContain(word)
    })
})

describe("Offset Pop DNA and token parity with Core", () => {
    const rhythmAliases: Readonly<Record<string, string>> = {
        "--offset-pop-page-inset": "--grammar-page-inset",
        "--offset-pop-region-gap": "--grammar-region-gap",
        "--offset-pop-section-gap": "--grammar-section-gap",
        "--offset-pop-inline-gap": "--grammar-inline-gap",
        "--offset-pop-row-gap": "--grammar-row-gap",
    }

    it("mirrors the Core DNA shape key for key and adds only the offset and palette groups", () => {
        expect(OFFSET_POP_DNA.id).toBe("offset-pop")
        expect(OFFSET_POP_DNA.version).toBe(1)
        expect(Object.isFrozen(OFFSET_POP_DNA)).toBe(true)
        expect(Object.keys(OFFSET_POP_DNA.color.light)).toEqual(Object.keys(OFFSET_POP_DNA.color.dark))
        const coreColourKeys = Object.keys(STARCI_CORE_DARK_TOKEN_DEFAULTS).map((name) => coreKeyOf.get(name))
            .filter((key) => !CORE_ONLY_KEYS.has(key ?? ""))
        // Core's fifteen plus its themed accent text and soft tint, which Offset Pop mirrors by name.
        expect(coreColourKeys).toHaveLength(17)
        expect(coreColourKeys.slice(-2)).toEqual(["accentText", "accentSoft"])
        expect(Object.keys(OFFSET_POP_DNA.color.light)).toEqual(coreColourKeys)
        expect(Object.keys(OFFSET_POP_TOKEN_NAMES)).toEqual(expect.arrayContaining(Object.keys(STARCI_CORE_TOKEN_NAMES).filter((key) => !CORE_ONLY_KEYS.has(key))))
        for (const key of CORE_ONLY_KEYS) expect(Object.keys(OFFSET_POP_TOKEN_NAMES), `${key} is Core-only`).not.toContain(key)
        expect(OFFSET_POP_SPACING_SCALE).toEqual(STARCI_CORE_SPACING_SCALE)
        for (const name of Object.values(OFFSET_POP_TOKEN_NAMES)) expect(name).toMatch(/^--offset-pop-[a-z-]+$/)
        expect(Object.keys(OFFSET_POP_TOKEN_DEFAULTS).sort()).toEqual(Object.values(OFFSET_POP_TOKEN_NAMES).sort())
    })

    it("keeps every DNA value equal to its CSS default", () => {
        for (const [name, value] of Object.entries(OFFSET_POP_TOKEN_DEFAULTS)) {
            const alias = rhythmAliases[name]
            if (alias) {
                expect(offsetPop.root.get(name), `${name} aliases Common rhythm`).toBe(`var(${alias})`)
                expect(commonRoot.get(alias), `${name} equals the Common rhythm value`).toBe(value)
            } else {
                expect(offsetPop.root.get(name), `CSS default drifted from ${name}`).toBe(value)
            }
        }
        for (const [name, value] of Object.entries(OFFSET_POP_DARK_TOKEN_DEFAULTS)) {
            expect(offsetPop.dark.get(name), `dark default drifted from ${name}`).toBe(value)
            expect(offsetPop.system.get(name), `system-dark default drifted from ${name}`).toBe(value)
        }
        expect(new Set(offsetPop.dark.keys())).toEqual(new Set(Object.keys(OFFSET_POP_DARK_TOKEN_DEFAULTS)))
        expect(new Set(offsetPop.system.keys())).toEqual(new Set(Object.keys(OFFSET_POP_DARK_TOKEN_DEFAULTS)))
    })

    it("feeds Common every semantic variable Core feeds, each through a family token", () => {
        expect(commonVariablesCoreFeeds.length).toBeGreaterThan(25)
        for (const name of commonVariablesCoreFeeds) {
            expect(offsetPop.root.get(name), `Offset Pop does not feed ${name}`).toMatch(/^var\(--offset-pop-[a-z-]+\)$/)
        }
    })

    it("sets, in light, dark, system-dark and forced colours, every token Core sets there", () => {
        for (const coreName of core.root.keys()) {
            if (!coreName.startsWith("--starci-core-") || isCoreOnly(coreName)) continue
            expect(offsetPop.root.has(offsetPopNameFor(coreName)), `light misses ${coreName}`).toBe(true)
        }
        for (const coreName of Object.keys(STARCI_CORE_DARK_TOKEN_DEFAULTS)) {
            expect(core.dark.has(coreName)).toBe(true)
            if (isCoreOnly(coreName)) continue
            expect(offsetPop.dark.has(offsetPopNameFor(coreName)), `dark misses ${coreName}`).toBe(true)
            expect(offsetPop.system.has(offsetPopNameFor(coreName)), `system misses ${coreName}`).toBe(true)
        }
        for (const coreName of core.forced.keys()) {
            if (isCoreOnly(coreName)) continue
            expect(offsetPop.forced.has(offsetPopNameFor(coreName)), `forced colours miss ${coreName}`).toBe(true)
        }
        expect(offsetPop.forced.get("--offset-pop-accent")).toBe("Highlight")
        expect(offsetPop.forced.get("--offset-pop-canvas")).toBe("Canvas")
        expect(offsetPop.forced.get("--offset-pop-foreground")).toBe("CanvasText")
        expect(offsetPop.forced.get("--offset-pop-surface-shadow")).toBe("none")
        expect(css).toMatch(/@media \(forced-colors: active\)\s*\{\s*[^{]*\[data-grammar-theme\]\s*\{/)
    })

    it("owns a real dark theme: every themed colour changes through tokens, never a filter", () => {
        expect(css).not.toMatch(/filter:\s*invert/)
        for (const key of ["canvas", "surface", "surfaceSecondary", "foreground", "muted", "border", "separator"] as const) {
            expect(OFFSET_POP_DNA.color.dark[key], `${key} is not themed`).not.toBe(OFFSET_POP_DNA.color.light[key])
        }
        expect(OFFSET_POP_DNA.offset.dark.ink).not.toBe(OFFSET_POP_DNA.offset.ink)
        expect(OFFSET_POP_DNA.offset.dark.shadowInk).not.toBe(OFFSET_POP_DNA.offset.shadowInk)
    })

    it("draws semantic colours from the family palette and ink", () => {
        const { color, offset, palette } = OFFSET_POP_DNA
        expect(color.accent).toBe(palette.pink)
        expect(color.focus).toBe(palette.pink)
        expect(color.accentForeground).toBe(offset.ink)
        for (const mode of [color.light, color.dark]) {
            expect(mode.success).toBe(palette.mint)
            expect(mode.warning).toBe(palette.yellow)
            expect(mode.danger).toBe(palette.critical)
            expect(mode.info).toBe(palette.blush)
        }
        expect([color.light.foreground, color.light.border, color.light.separator]).toEqual([offset.ink, offset.ink, offset.ink])
        expect([color.dark.foreground, color.dark.border, color.dark.separator]).toEqual([offset.dark.ink, offset.dark.ink, offset.dark.ink])
        expect(offsetPop.root.get("--shadow-surface")).toBe("var(--offset-pop-surface-shadow)")
    })

    it("claims only the measures Common actually renders under an Offset Pop root", () => {
        expect(commonCss).toContain(`var(--starci-core-page-measure, ${OFFSET_POP_DNA.geometry.pageMeasure})`)
        expect(commonCss).toContain(`var(--starci-core-reading-measure, ${OFFSET_POP_DNA.geometry.readingMeasure})`)
    })

    it("re-exports the band tokens Common publishes, and never writes them", () => {
        for (const name of [OFFSET_POP_BAND_TOKEN_NAMES.bandOffset, OFFSET_POP_BAND_TOKEN_NAMES.bandHeight, OFFSET_POP_BAND_TOKEN_NAMES.bandSubnavHeight]) {
            expect(commonCss).toContain(`${name}:`)
        }
        for (const name of [OFFSET_POP_BAND_TOKEN_NAMES.railOffset, OFFSET_POP_BAND_TOKEN_NAMES.subnavOffset]) {
            expect(commonCss).toContain(`var(${name}`)
        }
        for (const name of Object.values(OFFSET_POP_BAND_TOKEN_NAMES)) expect(css).not.toContain(`${name}:`)
    })

    it("clips only a list that does not scroll, so Common's scroll region keeps overflow-y: auto", () => {
        const overflowRules = Array.from(css.matchAll(/([^{}]*\[data-grammar-list\][^{}]*)\{([^}]*)\}/g))
            .filter((match) => /(?:^|;)\s*overflow/.test(match[2] ?? ""))
        expect(overflowRules.length).toBeGreaterThan(0)
        for (const [, selector] of overflowRules) {
            expect(selector?.trim()).toMatch(/\[data-grammar-list\]:not\(\[data-grammar-scroll-region\]\)$/)
        }
        expect(commonCss).toMatch(/\[data-grammar-scroll-region="vertical"\]\s*\{[^}]*overflow-y: auto;/)
        expect(rendererSource).toContain("data-grammar-scroll-region=\"vertical\"")
    })

    /*
     * The old `[data-grammar-row]:has(:is(a, button):hover)` wash and `[data-grammar-row]:focus-within`
     * ring reached nothing: StaticStateRow is the only renderer that emits `data-grammar-row`, and its
     * label and description are strings. The interactive rows (ListBox options, Select/ComboBox
     * options, selectable DataTable rows) are the pointer and focus target themselves and carry the
     * treatment in their component sheets; shipped-claims renders them and drives each state.
     */
    it("gives no hover or focus treatment to the non-interactive StaticStateRow", () => {
        const body = css.replace(/\/\*[\s\S]*?\*\//g, "")
        expect(body).not.toMatch(/\[data-grammar-row\][^{,]*:(?:hover|focus|focus-within|focus-visible|active)/)
        expect(body).not.toMatch(/\[data-grammar-row\]:has\(/)
        expect(readFileSync(resolve(process.cwd(), "src/core/composite/StaticStateRow/index.tsx"), "utf8")).toMatch(/readonly label: string;?\s+readonly description\?: string/)
    })

    it("paints the accent as text only through the text-safe accent, keeping pink the fill and ring", () => {
        expect(offsetPop.root.get("--accent")).toBe("var(--offset-pop-accent)")
        expect(offsetPop.root.get("--focus")).toBe("var(--offset-pop-focus)")
        expect(offsetPop.root.get("--accent-soft-foreground")).toBe("var(--offset-pop-accent-text)")
        expect(offsetPop.root.get("--link")).toBe("var(--offset-pop-accent-text)")
        expect(offsetPop.root.get("--accent-soft")).toBe("var(--offset-pop-accent-soft)")
        expect(OFFSET_POP_DNA.color.light.accentSoft).toBe(OFFSET_POP_DNA.color.light.surfaceSecondary)
        expect(OFFSET_POP_DNA.color.dark.accentSoft).toBe(OFFSET_POP_DNA.color.dark.surfaceSecondary)
        expect(css, "no family rule paints text with the fill accent").not.toMatch(/(?<![-\w])color:\s*var\(--(?:accent|offset-pop-accent|offset-pop-pink)\)/)
        for (const hook of [
            "[data-component=\"Text\"][data-tone=\"accent\"]",
            "[data-grammar-section-header] .starci-core-section-eyebrow",
            "[data-component=\"TextAction\"][data-appearance=\"tab\"][data-current=\"true\"]",
        ]) {
            const at = css.indexOf(`${hook} {`)
            expect(at, `${hook} is not routed`).toBeGreaterThan(-1)
            const rule = css.slice(at, css.indexOf("}", at))
            expect(rule, hook).toContain("color: var(--offset-pop-accent-text);")
        }
        // Common still paints these with the fill accent, which is why the family routes them.
        expect(commonCss).toMatch(/\.starci-core-section-eyebrow\s*\{\s*color: var\(--starci-core-accent, var\(--accent,/)
        expect(commonCss).toMatch(/\.starci-core-text-action\[data-appearance="tab"\]\[data-current="true"\]\s*\{[^}]*\n\s*color: var\(--accent,/)
        expect(rendererSource).toContain("\"starci-core-section-eyebrow\"")
        expect(offsetPop.forced.get("--offset-pop-accent-text")).toBe("CanvasText")
    })

    /** The ratios recorded in `dna.ts`; AA text needs 4.5, a focus ring (WCAG 1.4.11) needs 3. */
    const RECORDED_CONTRAST = {
        light: {
            foregroundOnCanvas: 16.86, foregroundOnSurface: 17.49, foregroundOnSurfaceSecondary: 13.78,
            mutedOnCanvas: 5.81, mutedOnSurface: 6.03, mutedOnSurfaceSecondary: 4.75,
            accentForegroundOnAccent: 5.23, successForegroundOnSuccess: 11.97, warningForegroundOnWarning: 12.49,
            dangerForegroundOnDanger: 4.72, infoForegroundOnInfo: 13.5, focusOnCanvas: 3.22, focusOnSurface: 3.34,
            accentTextOnCanvas: 6.22, accentTextOnSurface: 6.45, accentTextOnSurfaceSecondary: 5.09, accentTextOnBlush: 4.98,
        },
        dark: {
            foregroundOnCanvas: 17.47, foregroundOnSurface: 15.44, foregroundOnSurfaceSecondary: 12.8,
            mutedOnCanvas: 10.16, mutedOnSurface: 8.98, mutedOnSurfaceSecondary: 7.45,
            accentForegroundOnAccent: 5.23, successForegroundOnSuccess: 11.97, warningForegroundOnWarning: 12.49,
            dangerForegroundOnDanger: 4.72, infoForegroundOnInfo: 13.5, focusOnCanvas: 5.42, focusOnSurface: 4.79,
            accentTextOnCanvas: 7.65, accentTextOnSurface: 6.76, accentTextOnSurfaceSecondary: 5.61,
        },
    } as const

    for (const mode of ["light", "dark"] as const) {
        it(`meets WCAG AA contrast in ${mode} mode`, () => {
            const c = OFFSET_POP_DNA.color
            const m = c[mode]
            const measured = {
                foregroundOnCanvas: contrast(m.foreground, m.canvas),
                foregroundOnSurface: contrast(m.foreground, m.surface),
                foregroundOnSurfaceSecondary: contrast(m.foreground, m.surfaceSecondary),
                mutedOnCanvas: contrast(m.muted, m.canvas),
                mutedOnSurface: contrast(m.muted, m.surface),
                mutedOnSurfaceSecondary: contrast(m.muted, m.surfaceSecondary),
                accentForegroundOnAccent: contrast(c.accentForeground, c.accent),
                successForegroundOnSuccess: contrast(m.successForeground, m.success),
                warningForegroundOnWarning: contrast(m.warningForeground, m.warning),
                dangerForegroundOnDanger: contrast(m.dangerForeground, m.danger),
                infoForegroundOnInfo: contrast(m.infoForeground, m.info),
                focusOnCanvas: contrast(c.focus, m.canvas),
                focusOnSurface: contrast(c.focus, m.surface),
                accentTextOnCanvas: contrast(m.accentText, m.canvas),
                accentTextOnSurface: contrast(m.accentText, m.surface),
                accentTextOnSurfaceSecondary: contrast(m.accentText, m.surfaceSecondary),
                // Blush is a light-mode surface tone only; dark never sets text on it.
                ...(mode === "light" ? { accentTextOnBlush: contrast(m.accentText, OFFSET_POP_DNA.palette.blush) } : {}),
            }
            expect(measured).toEqual(RECORDED_CONTRAST[mode])
            for (const [pair, ratio] of Object.entries(measured)) {
                expect(ratio, pair).toBeGreaterThanOrEqual(pair.startsWith("focus") ? 3 : 4.5)
            }
        })
    }
})

/* Pink and critical are fills: their text reads the raspberry accent text and the ink-mixed error colour. */
const OFFSET_POP_SHEETS = ["styles.css", "components-forms.css", "components-overlays.css", "components-navigation.css"].map((sheet) => `src/offset-pop/${sheet}`)
contrastSuite("offset-pop", {
    accent: { text: "var(--offset-pop-accent-text)", routes: { sheets: OFFSET_POP_SHEETS, properties: ["--accent"] } },
    danger: { text: "color-mix(in srgb, var(--offset-pop-critical) 65%, var(--offset-pop-ink))", routes: { sheets: OFFSET_POP_SHEETS, properties: ["--danger"] } },
})

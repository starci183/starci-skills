import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { cssRules } from "../__test__/styleClaims.js"
import { COMMON_UI_RULE_IDS } from "../common/index.js"
import { CANONICAL_RULE_IDS } from "../common/rule-catalog.generated.js"
import { coreRuleConformance } from "../core/index.js"
import { heritageRuleConformance } from "../heritage/index.js"
import { OFFSET_POP_FAMILY_EVIDENCE, offsetPopRuleConformance } from "./conformance.js"
import { OFFSET_POP_DNA } from "./dna.js"
import * as entry from "./index.js"

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8")
const css = read("src/offset-pop/styles.css")
const commonCss = read("src/common/styles.css")

/** The family's CSS is `styles.css` plus every local sheet it imports, in import order. */
const COMPONENT_SHEETS = Array.from(css.matchAll(/@import "\.\/([^"]+\.css)";/g), (match) => match[1] ?? "")
const SHEETS: Readonly<Record<string, string>> = Object.fromEntries([
    ["styles.css", css],
    ...COMPONENT_SHEETS.map((name) => [name, read(`src/offset-pop/${name}`)] as const),
])

type Declaration = { readonly property: string; readonly value: string }
type FamilyRule = {
    readonly sheet: string
    /** The enclosing `@media` preludes, outermost first; empty for an unconditional rule. */
    readonly media: ReadonlyArray<string>
    readonly selector: string
    readonly declarations: ReadonlyArray<Declaration>
}

/** Split a selector list at top-level commas; `:is(a, button)` stays whole. */
const selectorList = (selector: string): ReadonlyArray<string> => {
    const parts: Array<string> = []
    let depth = 0
    let start = 0
    for (let index = 0; index < selector.length; index += 1) {
        const character = selector[index]
        if (character === "(") depth += 1
        else if (character === ")") depth -= 1
        else if (character === "," && depth === 0) {
            parts.push(selector.slice(start, index).trim())
            start = index + 1
        }
    }
    parts.push(selector.slice(start).trim())
    return parts.filter(Boolean).map((part) => part.replace(/\s+/g, " "))
}

const parse = (body: string): ReadonlyArray<Declaration> => body.split(";")
    .map((declaration) => declaration.split(":"))
    .filter((parts) => parts.length >= 2 && (parts[0] ?? "").trim() !== "")
    .map((parts) => ({ property: (parts[0] ?? "").trim(), value: parts.slice(1).join(":").replace(/\s+/g, " ").trim() }))

/** Leaf rules with their `@media` context, one entry per selector in each selector list. */
const rulesOf = (sheet: string, text: string): ReadonlyArray<FamilyRule> => {
    const source = text.replace(/\/\*[\s\S]*?\*\//g, "")
    const rules: Array<FamilyRule> = []
    const stack: Array<{ prelude: string; start: number }> = []
    let cursor = 0
    for (let index = 0; index < source.length; index += 1) {
        const character = source[index]
        if (character === "{") {
            stack.push({ prelude: source.slice(cursor, index).trim(), start: index + 1 })
            cursor = index + 1
            continue
        }
        if (character !== "}") continue
        const open = stack.pop()
        if (open === undefined) continue
        const body = source.slice(open.start, index)
        if (!body.includes("{") && !open.prelude.startsWith("@")) {
            const media = stack.map((frame) => frame.prelude.replace(/\s+/g, " ")).filter((prelude) => prelude.startsWith("@media"))
            const declarations = parse(body)
            for (const selector of selectorList(open.prelude)) rules.push({ sheet, media, selector, declarations })
        }
        cursor = index + 1
    }
    return rules
}

/** Every leaf rule of every family sheet. */
const familyRules = Object.entries(SHEETS).flatMap(([sheet, text]) => rulesOf(sheet, text))
const baseRules = familyRules.filter((rule) => rule.media.length === 0)
const inMedia = (prelude: string) => familyRules.filter((rule) => rule.media.includes(prelude))

const SCOPE = ".grammar-common-root[data-grammar-family=\"offset-pop\"]"
const BOUNDED = "[data-grammar-surface-card][data-slot=\"card\"] [data-grammar-frame=\"bounded\"][data-slot=\"card-content\"]"
const CARD_ROOT = "[data-grammar-surface-card][data-slot=\"card\"]"

/** The unconditional declarations of the rule(s) whose selector is exactly `${SCOPE} ${hook}`. */
const declared = (hook: string): ReadonlyMap<string, string> => {
    const selector = `${SCOPE} ${hook}`
    const matching = baseRules.filter((rule) => rule.selector === selector)
    expect(matching.length, `no family rule for ${hook}`).toBeGreaterThan(0)
    return new Map(matching.flatMap((rule) => rule.declarations.map((d) => [d.property, d.value] as const)))
}
const tokensOf = (rules: ReadonlyArray<FamilyRule>) => new Map(rules.filter((rule) => rule.sheet === "styles.css" && rule.selector === SCOPE)
    .flatMap((rule) => rule.declarations.map((d) => [d.property, d.value] as const)))
const rootTokens = tokensOf(baseRules)
const forcedTokens = tokensOf(inMedia("@media (forced-colors: active)"))
const narrow = inMedia("@media (max-width: 40rem)")

/** Non-custom-property declarations, in every condition: what a family rule actually paints. */
const painted = familyRules.flatMap((rule) => rule.declarations
    .filter((d) => !d.property.startsWith("--"))
    .map((d) => ({ ...d, sheet: rule.sheet, media: rule.media, selector: rule.selector })))
const short = (selector: string) => selector.replaceAll(SCOPE, "§")

/** WCAG relative-luminance contrast between two #rrggbb colours. */
const rgb = (hex: string) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)) as [number, number, number]
const luminance = ([r, g, b]: readonly [number, number, number]) => {
    const channel = (value: number) => {
        const v = value / 255
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}
const contrast = (a: readonly [number, number, number], b: readonly [number, number, number]) => {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
    return (high + 0.05) / (low + 0.05)
}
/** `color-mix(in srgb, a p%, b)`, rounded to 8-bit channels the way a browser stores it. */
const mix = (a: string, b: string, share: number) => {
    const [x, y] = [rgb(a), rgb(b)]
    return x.map((channel, index) => Math.round(channel * share + (y[index] ?? 0) * (1 - share))) as [number, number, number]
}

describe("Offset Pop rule conformance: coverage", () => {
    const family = Object.keys(offsetPopRuleConformance.familyEvidence)
    const inherited = offsetPopRuleConformance.inheritedCommonRules

    it("is the object the family entry exports", () => {
        expect(entry.offsetPopRuleConformance).toBe(offsetPopRuleConformance)
        expect(entry.OFFSET_POP_FAMILY_EVIDENCE).toBe(OFFSET_POP_FAMILY_EVIDENCE)
        expect(offsetPopRuleConformance.familyId).toBe("offset-pop")
    })

    it("covers COMMON_UI_RULE_IDS exactly, family plus inherited, with no overlap or repeat", () => {
        expect(COMMON_UI_RULE_IDS).toBe(CANONICAL_RULE_IDS)
        expect(family.filter((rule) => inherited.includes(rule))).toEqual([])
        expect(new Set(inherited).size).toBe(inherited.length)
        expect(inherited.length + family.length).toBe(COMMON_UI_RULE_IDS.length)
        expect(new Set([...inherited, ...family])).toEqual(new Set(COMMON_UI_RULE_IDS))
        // Inherited rules keep catalogue order, so a regenerated catalogue diffs cleanly.
        expect(inherited).toEqual(COMMON_UI_RULE_IDS.filter((rule) => !family.includes(rule)))
    })

    it("names only rules that exist in the generated catalogue, each with non-empty evidence", () => {
        for (const [rule, evidence] of Object.entries(OFFSET_POP_FAMILY_EVIDENCE)) {
            expect(CANONICAL_RULE_IDS, `${rule} is not a catalogue rule`).toContain(rule)
            expect(evidence.length, rule).toBeGreaterThan(0)
            for (const line of evidence) expect(line.trim().length, rule).toBeGreaterThan(20)
        }
    })

    it("is frozen and names no product", () => {
        expect(Object.isFrozen(offsetPopRuleConformance)).toBe(true)
        expect(Object.isFrozen(offsetPopRuleConformance.familyEvidence)).toBe(true)
        const text = JSON.stringify(OFFSET_POP_FAMILY_EVIDENCE).toLowerCase()
        for (const word of ["mia mia", "starci academy", "course", "student", "checkout"]) expect(text).not.toContain(word)
    })

    it("sits between Core (inherits everything) and its siblings on the shared theme and focus rules", () => {
        expect(Object.keys(coreRuleConformance.familyEvidence)).toEqual([])
        expect(coreRuleConformance.inheritedCommonRules).toEqual(COMMON_UI_RULE_IDS)
        // Both non-Core families rebind the theme and the focus colour, so both own these two.
        for (const rule of ["COLOR-5", "FOCUS-1"]) {
            expect(heritageRuleConformance.familyEvidence).toHaveProperty(rule)
            expect(offsetPopRuleConformance.familyEvidence).toHaveProperty(rule)
        }
        // Heritage's Brand-only claims are not Offset Pop's: the family ships no extension renderer.
        for (const rule of ["A11Y-4", "MEDIA-6", "GAP-2"]) expect(offsetPopRuleConformance.familyEvidence).not.toHaveProperty(rule)
    })

    it("reads every family sheet styles.css imports", () => {
        expect(COMPONENT_SHEETS).toEqual(["components-forms.css", "components-overlays.css", "components-navigation.css"])
        for (const sheet of Object.keys(SHEETS)) expect(familyRules.some((rule) => rule.sheet === sheet), sheet).toBe(true)
        for (const rule of familyRules) expect(rule.selector.startsWith(SCOPE), `${rule.sheet}: ${rule.selector}`).toBe(true)
    })
})

/** A painted value that reads the fill accent (not the text-safe accent or the soft pairing). */
const FILL_ACCENT = /var\(--(?:accent|offset-pop-accent|offset-pop-pink)\)/

/**
 * One proof per family claim. Where an existing spec already asserts the mechanism, the proof
 * cites it and re-checks the load-bearing declaration here so a claim cannot outlive its CSS.
 */
const PROOF: Readonly<Record<keyof typeof OFFSET_POP_FAMILY_EVIDENCE, () => void>> = {
    // styles.spec "paints the accent as text only through the text-safe accent"; shipped-claims "never colours text with the fill accent".
    "ACCENT-1": () => {
        expect(rootTokens.get("--accent")).toBe("var(--offset-pop-accent)")
        expect(OFFSET_POP_DNA.color.accent).toBe(OFFSET_POP_DNA.palette.pink)
        const DECISION = /overlay-action="confirm"|toast-action|alert-actions|data-selected|data-grammar-selected|data-indeterminate|data-grammar-current|data-grammar-step-state="current"|aria-expanded="true"|disclosure-state="open"|data-grammar-drag="over"|slider-fill|meter-fill|rating-fill|"Spinner"|"ProgressCircle"|"Link"|overlay-backdrop/
        const accentPaint = painted.filter((d) => FILL_ACCENT.test(d.value))
        expect(accentPaint.length).toBeGreaterThan(10)
        expect(accentPaint.filter((d) => !DECISION.test(d.selector)).map((d) => `${d.property} in ${short(d.selector)}`)).toEqual([])
        // Text is never the fill pink; Spinner and ProgressCircle take `color` only as their stroke.
        const text = accentPaint.filter((d) => d.property === "color" && !/"Spinner"|"ProgressCircle"/.test(d.selector))
        expect(text.map((d) => short(d.selector))).toEqual([])
        // One action per region takes it: the dialog confirm (cancel does not), and the single toast/alert action.
        expect(painted.some((d) => d.selector.includes("overlay-action=\"cancel\"") && FILL_ACCENT.test(d.value))).toBe(false)
    },
    // styles.spec "draws semantic colours from the family palette and ink" (border = separator = ink).
    "BOUNDARY-1": () => {
        const nav = declared("[data-grammar-navigation-feature-nav]")
        expect(nav.get("border-block-end-width")).toBe("var(--offset-pop-outline-width)")
        expect(nav.get("border-block-end-color")).toBe("var(--border)")
        expect(declared("[data-component=\"TopBar\"]").get("border-block-end")).toBe("var(--offset-pop-outline-width) solid var(--offset-pop-ink)")
        expect(declared("[data-component=\"Footer\"]").get("border-block-start")).toBe("var(--offset-pop-outline-width) solid var(--offset-pop-ink)")
        expect(declared("[data-component=\"BottomNav\"]").get("border-block-start")).toBe("calc(var(--offset-pop-outline-width) * 1.5) solid var(--offset-pop-ink)")
        expect(OFFSET_POP_DNA.color.light.border).toBe(OFFSET_POP_DNA.color.light.separator)
        expect(OFFSET_POP_DNA.color.dark.border).toBe(OFFSET_POP_DNA.color.dark.separator)
        expect(OFFSET_POP_DNA.color.light.border).toBe(OFFSET_POP_DNA.offset.ink)
        expect([forcedTokens.get("--offset-pop-border"), forcedTokens.get("--offset-pop-separator"), forcedTokens.get("--offset-pop-ink")]).toEqual(["CanvasText", "CanvasText", "CanvasText"])
    },
    "BOUNDARY-4": () => {
        expect(declared("[data-grammar-rail]").get("border-inline-end")).toBe("var(--offset-pop-outline-width) solid var(--border)")
        expect(commonCss).not.toMatch(/\.starci-core-rail(?:\[[^\]]*\])*\s*\{[^}]*border-inline-end/)
    },
    // components-forms.spec, components-overlays.spec and components-navigation.spec assert these outlines per component hook.
    "BOUNDARY-5": () => {
        const outline = /^var\(--offset-pop-outline-width\) (?:solid|dashed) var\(--(?:border|offset-pop-ink)\)$/
        for (const hook of [BOUNDED, "[data-grammar-surface]", "[data-component=\"Button\"]", "[data-component=\"Badge\"]", "[data-grammar-state-mark]",
            "[data-grammar-overlay-surface]", "[data-component=\"DataTable\"]", "[data-component=\"Calendar\"]", "[data-component=\"Avatar\"]"]) {
            expect(declared(hook).get("border"), hook).toMatch(outline)
        }
        expect(rootTokens.get("--offset-pop-outline-width")).toBe("2px")
        const joined = painted.filter((d) => d.property.startsWith("margin") && d.selector.includes("\"ButtonGroup\""))
        expect(joined.map((d) => d.value)).toEqual(["calc(-1 * var(--offset-pop-outline-width))", "calc(-1 * var(--offset-pop-outline-width))"])
    },
    // styles.spec "binds semantic Common variables and preserves hard family surface geometry" and the forced-colour token test.
    "BOUNDARY-6": () => {
        expect(declared(`${BOUNDED}[data-grammar-surface-depth="top"]`).get("box-shadow")).toBe("var(--shadow-surface)")
        expect(declared(BOUNDED).get("border")).toBe("var(--offset-pop-outline-width) solid var(--border)")
        expect(rootTokens.get("--shadow-surface")).toBe("var(--offset-pop-surface-shadow)")
        expect(rootTokens.get("--offset-pop-surface-shadow")).toBe("var(--offset-pop-shadow-x) var(--offset-pop-shadow-y) 0 var(--offset-pop-shadow-ink)")
        expect(forcedTokens.get("--shadow-surface")).toBe("none")
        for (const hook of ["[data-component=\"DataTable\"]", "[data-component=\"Calendar\"]"]) expect(declared(hook).get("box-shadow"), hook).toBe("var(--shadow-surface)")
    },
    // styles.spec "sets, in light, dark, system-dark and forced colours, every token Core sets there" and "meets WCAG AA contrast in light|dark mode".
    "COLOR-5": () => {
        expect(css).toContain(`${SCOPE}[data-grammar-theme="dark"] {`)
        expect(inMedia("@media (prefers-color-scheme: dark)").some((rule) => rule.selector === `${SCOPE}[data-grammar-theme="system"]`)).toBe(true)
        expect(forcedTokens.get("--offset-pop-canvas")).toBe("Canvas")
        expect(forcedTokens.get("--offset-pop-foreground")).toBe("CanvasText")
        for (const sheet of COMPONENT_SHEETS) {
            expect(inMedia("@media (forced-colors: active)").some((rule) => rule.sheet === sheet), `${sheet} has no forced-colours block`).toBe(true)
        }
        // Error text: raw critical is 3.57:1 on the light canvas, so the family mixes it 65% with the ink.
        const criticalText = painted.filter((d) => d.property === "color" && d.value.includes("--offset-pop-critical"))
        expect(criticalText.length).toBeGreaterThan(0)
        for (const d of criticalText) expect(d.value, short(d.selector)).toBe("color-mix(in srgb, var(--offset-pop-critical) 65%, var(--offset-pop-ink))")
        const { color, offset, palette } = OFFSET_POP_DNA
        const light = mix(palette.critical, offset.ink, 0.65)
        const dark = mix(palette.critical, offset.dark.ink, 0.65)
        for (const ground of [color.light.canvas, color.light.surface, color.light.surfaceSecondary, palette.blush]) expect(contrast(light, rgb(ground)), ground).toBeGreaterThanOrEqual(4.5)
        for (const ground of [color.dark.canvas, color.dark.surface, color.dark.surfaceSecondary]) expect(contrast(dark, rgb(ground)), ground).toBeGreaterThanOrEqual(4.5)
    },
    // shipped-claims "takes a pending|unavailable whole-action surface out of the focus order" and "keeps Button press, pending and disabled ownership".
    "CONTROL-STATE-2": () => {
        const unavailable = declared("[data-grammar-state=\"unavailable\"]")
        const pending = declared("[data-grammar-state=\"pending\"]")
        expect(Object.fromEntries(unavailable)).toEqual({ "box-shadow": "none", opacity: ".56", transform: "none", cursor: "not-allowed" })
        expect(Object.fromEntries(pending)).toEqual({ "pointer-events": "none" })
    },
    // styles.spec "targets only hooks emitted by Common public renderers"; shipped-claims "reaches a rendered Common node with every family selector".
    "CORE-BOUNDARY-1": () => {
        const edges = painted.filter((d) => /^border(?!-radius)/.test(d.property) && d.value !== "0")
        expect(edges.length).toBeGreaterThan(20)
        for (const edge of edges) {
            const hooks = edge.selector.slice(SCOPE.length)
            expect(hooks, short(edge.selector)).toMatch(/\[(?:data-component|data-grammar-[a-z-]+|data-slot)[=\]]/)
            expect(hooks, short(edge.selector)).not.toMatch(/(?:^|\s)(?:div|span|section)(?:\s|$)/)
        }
    },
    "CORE-BOUNDARY-4": () => {
        expect(painted.filter((d) => /^(?:z-index|position|isolation)$/.test(d.property)).map((d) => short(d.selector))).toEqual([])
        expect(declared(`${BOUNDED}[data-grammar-surface-depth="nested"]`).get("box-shadow")).toBe("none")
        expect(forcedTokens.get("--offset-pop-surface-shadow")).toBe("none")
        const shadows = painted.filter((d) => d.property === "box-shadow" && !/^(?:none|inset|var\(--shadow-surface\))/.test(d.value))
        for (const d of shadows) expect(d.value, short(d.selector)).toMatch(/ 0 (?:var\(--offset-pop-outline-width\) )?var\(--offset-pop-(?:shadow-ink|field-ring|pink)/)
    },
    // styles.spec "uses invariant spacing for focus, press, responsive, and reduced-motion vectors".
    "CORE-BOUNDARY-5": () => {
        const widthQueries = [...new Set(familyRules.flatMap((rule) => rule.media).filter((prelude) => /width/.test(prelude)))]
        expect(widthQueries.sort()).toEqual(["@media (max-width: 30rem)", "@media (max-width: 40rem)"])
        const underWidth = painted.filter((d) => d.media.some((prelude) => /width/.test(prelude)))
        expect(underWidth.map((d) => d.property)).toEqual(["box-shadow", "box-shadow"])
        expect(narrow.flatMap((rule) => rule.declarations).every((d) => d.property.startsWith("--"))).toBe(true)
    },
    // surface-card-family "renders the HeroUI v3 Card compound root, header, and content slots inside the family scope".
    "CORE-SURFACE-2": () => {
        expect(Object.fromEntries(declared(CARD_ROOT))).toEqual({ border: "0", background: "transparent", "box-shadow": "none" })
        for (const hook of [BOUNDED, "[data-grammar-surface]"]) {
            const shell = declared(hook)
            expect(shell.get("background"), hook).toBe("var(--surface)")
            expect(shell.get("border-radius"), hook).toBe("var(--offset-pop-surface-radius)")
        }
    },
    "FLOW-2": () => {
        expect(declared("[data-component=\"Heading\"][data-scale=\"display\"]").get("text-wrap")).toBe("balance")
        expect(painted.filter((d) => /^(?:text-wrap|overflow-wrap|word-break|white-space)$/.test(d.property)).map((d) => d.selector))
            .toEqual([`${SCOPE} [data-component="Heading"][data-scale="display"]`])
    },
    // shipped-claims HOOK_GALLERY renders `<Heading scale="display">`, so "reaches a rendered Common node" proves the selector lands.
    "FONT-6": () => {
        const display = declared("[data-component=\"Heading\"][data-scale=\"display\"]")
        expect(display.get("font-weight")).toBe("900")
        expect(display.get("letter-spacing")).toBe("-.045em")
        expect(display.get("line-height")).toBe(".96")
        expect(display.has("font-size")).toBe(false)
    },
    // styles.spec "meets WCAG AA contrast" (focusOnCanvas/focusOnSurface >= 3); components-forms.spec asserts the field focus vector.
    "FOCUS-1": () => {
        expect(rootTokens.get("--focus")).toBe("var(--offset-pop-focus)")
        expect(forcedTokens.get("--offset-pop-focus")).toBe("Highlight")
        const rings = painted.filter((d) => d.property === "outline" && d.value === "2px solid var(--focus)")
        for (const target of [":has([data-grammar-whole-action]:focus-visible)", "[data-grammar-row]:focus-within", "[data-grammar-choice-control]", "[data-grammar-slider-thumb][data-focus-visible=\"true\"]"]) {
            expect(rings.some((d) => d.selector.includes(target)), target).toBe(true)
        }
        for (const ring of rings) expect(painted.some((d) => d.selector === ring.selector && d.property === "outline-offset" && d.value === "0.25rem"), short(ring.selector)).toBe(true)
        // A field's ring is the hard offset shadow over a transparent outline, which forced colours make Highlight.
        const fieldFocus = painted.filter((d) => d.media.length === 0 && d.property === "outline" && d.value === "2px solid transparent")
        expect(fieldFocus.length).toBeGreaterThan(0)
        for (const d of fieldFocus) {
            expect(painted.some((other) => other.selector === d.selector && other.property === "box-shadow" && other.value.includes("--offset-pop-shadow-x")), short(d.selector)).toBe(true)
        }
        expect(painted.some((d) => d.media.includes("@media (forced-colors: active)") && d.property === "outline" && d.value === "2px solid Highlight")).toBe(true)
    },
    "GAP-4": () => {
        expect(painted.filter((d) => /^(?:gap|row-gap|column-gap)$/.test(d.property)).map((d) => `${d.value} in ${short(d.selector)}`))
            .toEqual(["calc(var(--offset-pop-shadow-y) + 0.5rem) in § [data-component=\"Toaster\"] > ol"])
        expect(rootTokens.get("--offset-pop-shadow-y")).toBe("0.5rem")
    },
    "MARGIN-2": () => {
        expect(declared("[data-component=\"Accordion\"] [data-grammar-disclosure-state] + [data-grammar-disclosure-state]").get("margin-block-start")).toBe("var(--grammar-inline-gap, 0.5rem)")
        expect(commonCss).toMatch(/--grammar-inline-gap: 0\.5rem;/)
    },
    "MEASURE-5": () => {
        expect(declared("[data-component=\"BottomNav\"] [data-grammar-bottom-nav-item]").get("min-block-size")).toBe("4rem")
        const pill = declared("[data-component=\"BottomNav\"] [data-grammar-bottom-nav-item] > [aria-hidden=\"true\"]")
        expect([pill.get("min-inline-size"), pill.get("min-block-size")]).toEqual(["3.25rem", "2rem"])
        expect(declared("[data-component=\"Meter\"] [data-slot=\"meter-track\"]").get("height")).toBe("0.75rem")
    },
    // shipped-claims "keeps Button press, pending and disabled ownership": the press outcome is Common's.
    "MOTION-1": () => {
        const moves = painted.filter((d) => (d.property === "transform" || d.property === "translate") && d.value !== "none")
        expect(moves.length).toBeGreaterThan(5)
        for (const move of moves) expect(move.selector, move.value).toMatch(/:active|\[data-pressed(?:="true")?\]|\[data-dragging="true"\]/)
        expect(painted.filter((d) => /^animation/.test(d.property))).toEqual([])
    },
    // styles.spec "uses invariant spacing for focus, press, responsive, and reduced-motion vectors".
    "MOTION-2": () => {
        const reduced = inMedia("@media (prefers-reduced-motion: reduce)")
        const root = reduced.find((rule) => rule.selector === SCOPE)
        expect(Object.fromEntries((root?.declarations ?? []).map((d) => [d.property, d.value]))).toEqual({
            "--offset-pop-motion-duration": "0ms",
            "--offset-pop-transition": "0ms linear",
        })
        for (const sheet of Object.keys(SHEETS)) {
            const moves = painted.some((d) => d.sheet === sheet && d.media.length === 0 && /^(?:transform|translate)$/.test(d.property) && d.value !== "none")
            if (!moves) continue
            const stills = reduced.filter((rule) => rule.sheet === sheet && rule.declarations.some((d) => /^(?:transform|translate)$/.test(d.property) && d.value === "none"))
            expect(stills.length, `${sheet} moves without a reduced-motion reset`).toBeGreaterThan(0)
        }
        const still = new Set(reduced.filter((rule) => rule.declarations.some((d) => d.property === "transform" && d.value === "none")).map((rule) => rule.selector))
        for (const hook of ["[data-component=\"Button\"]", BOUNDED, "[data-grammar-surface]", "[data-grammar-row]", "[data-grammar-field=\"true\"] [data-grammar-choice-control]", "[data-component=\"ButtonGroup\"]"]) {
            expect(still, hook).toContain(`${SCOPE} ${hook}`)
        }
    },
    // styles.spec "keeps every DNA value equal to its CSS default" (motion duration and easing).
    "MOTION-3": () => {
        const transitions = painted.filter((d) => d.property === "transition" && d.value !== "none")
        expect(transitions.length).toBeGreaterThan(3)
        for (const transition of transitions) {
            for (const part of transition.value.split(",")) expect(part.trim(), short(transition.selector)).toMatch(/^[a-z-]+ var\(--offset-pop-transition\)$/)
        }
        expect(rootTokens.get("--offset-pop-transition")).toBe("var(--offset-pop-motion-duration) var(--offset-pop-motion-easing)")
        expect(rootTokens.get("--offset-pop-motion-duration")).toBe(OFFSET_POP_DNA.motion.duration)
    },
    // styles.spec "clips only a list that does not scroll"; shipped-claims "redeclares no OVERFLOW a Common node claims".
    "OVERFLOW-2": () => {
        const overflow = painted.filter((d) => d.property.startsWith("overflow"))
        expect(overflow.every((d) => d.value === "clip")).toBe(true)
        expect(overflow.map((d) => short(d.selector)).sort()).toEqual([
            "§ [data-component=\"DataTable\"]",
            "§ [data-component=\"SegmentedControl\"] [data-grammar-field-control=\"true\"]",
            "§ [data-grammar-list]:not([data-grammar-scroll-region])",
        ])
        expect(declared("[data-grammar-list]").get("border-radius")).toBe("calc(var(--offset-pop-surface-radius) - var(--offset-pop-outline-width))")
        expect(read("src/core/branch/DataTable/index.tsx")).toMatch(/data-grammar-table-scroll="true"/)
    },
    "PADDING-2": () => {
        expect(declared("[data-component=\"Breadcrumbs\"] [data-grammar-breadcrumb][data-grammar-current=\"true\"]").get("padding-inline")).toBe("0.5rem")
    },
    "PADDING-3": () => {
        expect(declared("[data-component=\"Calendar\"]").get("padding")).toBe("0.75rem")
    },
    "PADDING-4": () => {
        for (const hook of ["[data-component=\"Disclosure\"] [data-grammar-disclosure-trigger]", "[data-component=\"Accordion\"] [data-grammar-accordion-trigger]"]) {
            expect(declared(hook).get("padding-inline"), hook).toBe("1rem")
        }
    },
    "RESPONSIVE-1": () => {
        expect(narrow.map((rule) => rule.selector)).toEqual([SCOPE])
        expect(Object.fromEntries(narrow[0]?.declarations.map((d) => [d.property, d.value]) ?? [])).toEqual({
            "--offset-pop-shadow-y": "0.25rem",
            "--offset-pop-surface-radius": "1.25rem",
        })
        const narrower = inMedia("@media (max-width: 30rem)")
        expect(narrower.map((rule) => short(rule.selector))).toEqual(["§ [data-component=\"DataTable\"]", "§ [data-component=\"Calendar\"]"])
        expect(painted.some((d) => d.media.some((prelude) => /width/.test(prelude)) && /^(?:display|visibility|content)$/.test(d.property))).toBe(false)
    },
    // surface-card-family "stays static without a whole action".
    "STATE-5": () => {
        const surfaceInteraction = familyRules.filter((rule) => rule.selector.includes(BOUNDED) && /:(?:active|focus-visible|hover)/.test(rule.selector))
        expect(surfaceInteraction.length).toBeGreaterThan(0)
        for (const rule of surfaceInteraction) expect(rule.selector).toMatch(/:has\(\[data-grammar-whole-action\]:(?:active|focus-visible)\)/)
    },
    // surface-card-family "gives a frameless surface none of the hooks the family draws a shell on".
    "SURFACE-1": () => {
        expect(Object.fromEntries(declared(CARD_ROOT))).toEqual({ border: "0", background: "transparent", "box-shadow": "none" })
        expect(familyRules.some((rule) => rule.selector.includes("data-grammar-frame=\"frameless\""))).toBe(false)
    },
    // styles.spec "feeds Common every semantic variable Core feeds, each through a family token".
    "SURFACE-2": () => {
        for (const hook of [BOUNDED, "[data-grammar-surface]"]) {
            const shell = declared(hook)
            expect([shell.get("background"), shell.get("color")], hook).toEqual(["var(--surface)", "var(--surface-foreground)"])
        }
        expect([rootTokens.get("--surface"), rootTokens.get("--surface-foreground")]).toEqual(["var(--offset-pop-surface)", "var(--offset-pop-foreground)"])
    },
    // styles.spec "binds semantic Common variables and preserves hard family surface geometry" (nested box-shadow: none).
    "SURFACE-3": () => {
        for (const hook of [`${BOUNDED}[data-grammar-surface-depth="nested"]`, "[data-grammar-surface][data-grammar-surface-depth=\"nested\"]"]) {
            const nested = declared(hook)
            expect([nested.get("background"), nested.get("box-shadow")], hook).toEqual(["var(--surface-secondary)", "none"])
        }
        expect(rootTokens.get("--surface-foreground")).toBe(rootTokens.get("--foreground"))
    },
    // styles.spec "paints the accent as text only through the text-safe accent" and "meets WCAG AA contrast" (accentTextOnSurfaceSecondary).
    "SURFACE-4": () => {
        expect(rootTokens.get("--accent-soft")).toBe("var(--offset-pop-surface-secondary)")
        expect(rootTokens.get("--accent-soft-foreground")).toBe("var(--offset-pop-accent-text)")
    },
    // styles.spec "meets WCAG AA contrast" (mutedOnCanvas/Surface/SurfaceSecondary >= 4.5).
    "TONE-2": () => {
        expect(declared("[data-component=\"Text\"][data-tone=\"muted\"]").get("color")).toBe("var(--muted)")
        expect(rootTokens.get("--muted")).toBe("var(--offset-pop-muted)")
        expect([OFFSET_POP_DNA.color.light.muted, OFFSET_POP_DNA.color.dark.muted]).toEqual(["#675f6c", "#c8bdca"])
    },
    // shipped-claims "colours Text (accent tone) | SectionHeader eyebrow | TextAction (current tab) with --offset-pop-accent-text".
    "TONE-3": () => {
        expect(declared("[data-component=\"Text\"][data-tone=\"accent\"]").get("color")).toBe("var(--offset-pop-accent-text)")
        expect(declared("[data-grammar-menu-item][data-selected]").get("color")).toBe("var(--offset-pop-accent-text)")
    },
    // shipped-claims mounts a StaticStateRow in every PresentationState, so "reaches a rendered Common node" proves the stripe selector lands.
    "TRUTH-1": () => {
        const stripe = painted.filter((d) => d.value.includes("--offset-pop-state-color"))
        expect(stripe.map((d) => short(d.selector))).toEqual(["§ [data-grammar-row][data-grammar-state]:not([data-grammar-state=\"neutral\"])"])
        expect(familyRules.some((rule) => rule.selector.includes("[data-grammar-state=\"neutral\"]") && !rule.selector.includes(":not("))).toBe(false)
        const toneColour = new Map(baseRules.filter((rule) => rule.declarations.some((d) => d.property === "--offset-pop-tone-color"))
            .map((rule) => [rule.selector.match(/\[data-grammar-tone(?:="([a-z]+)")?\]$/)?.[1] ?? "unnamed", rule.declarations.find((d) => d.property === "--offset-pop-tone-color")?.value]))
        expect(Object.fromEntries(toneColour)).toEqual({
            unnamed: "var(--offset-pop-surface-muted)",
            informative: "var(--info)",
            affirmative: "var(--success)",
            cautionary: "var(--warning)",
            negative: "var(--danger)",
            pending: "var(--accent)",
        })
    },
}

describe("Offset Pop rule conformance: every family claim is proved against the family CSS", () => {
    it("has exactly one proof per claim", () => {
        expect(Object.keys(PROOF).sort()).toEqual(Object.keys(OFFSET_POP_FAMILY_EVIDENCE).sort())
    })

    it.each(Object.keys(OFFSET_POP_FAMILY_EVIDENCE) as ReadonlyArray<keyof typeof PROOF>)("%s", (rule) => {
        PROOF[rule]()
    })
})

describe("Offset Pop rule conformance: inherited rules really are Common's", () => {
    /**
     * The family's whole geometry, each entry owned by a claim. Anything else would put a spacing,
     * size, layout or stacking decision in the family without a claim, so it fails here.
     */
    const GEOMETRY_ALLOW_LIST: Readonly<Record<string, string>> = {
        "margin-inline-start in § [data-component=\"ButtonGroup\"][data-grammar-orientation=\"horizontal\"] [data-component=\"Button\"] + [data-component=\"Button\"]": "BOUNDARY-5",
        "margin-block-start in § [data-component=\"ButtonGroup\"][data-grammar-orientation=\"vertical\"] [data-component=\"Button\"] + [data-component=\"Button\"]": "BOUNDARY-5",
        "gap in § [data-component=\"Toaster\"] > ol": "GAP-4",
        "height in § [data-component=\"Meter\"] [data-slot=\"meter-track\"]": "MEASURE-5",
        "padding-inline in § [data-component=\"Breadcrumbs\"] [data-grammar-breadcrumb][data-grammar-current=\"true\"]": "PADDING-2",
        "min-block-size in § [data-component=\"BottomNav\"] [data-grammar-bottom-nav-item]": "MEASURE-5",
        "min-inline-size in § [data-component=\"BottomNav\"] [data-grammar-bottom-nav-item] > [aria-hidden=\"true\"]": "MEASURE-5",
        "min-block-size in § [data-component=\"BottomNav\"] [data-grammar-bottom-nav-item] > [aria-hidden=\"true\"]": "MEASURE-5",
        "margin-block-start in § [data-component=\"Accordion\"] [data-grammar-disclosure-state] + [data-grammar-disclosure-state]": "MARGIN-2",
        "padding-inline in § [data-component=\"Disclosure\"] [data-grammar-disclosure-trigger]": "PADDING-4",
        "padding-inline in § [data-component=\"Accordion\"] [data-grammar-accordion-trigger]": "PADDING-4",
        "width in § [data-component=\"Timeline\"] [data-grammar-timeline-state]:not(:last-child)::before": "MEASURE-5",
        "padding in § [data-component=\"Calendar\"]": "PADDING-3",
    }

    it("declares no spacing, size, layout or stacking beyond the claimed allow-list", () => {
        const geometry = /^(?:padding|margin|gap|row-gap|column-gap|(?:min-|max-)?(?:width|height|inline-size|block-size)|display|flex|grid|inset|top|right|bottom|left|float|align-|justify-|place-|order|aspect-ratio|container)/
        const declaredGeometry = painted.filter((d) => geometry.test(d.property)).map((d) => `${d.property} in ${short(d.selector)}`)
        expect(declaredGeometry.sort()).toEqual(Object.keys(GEOMETRY_ALLOW_LIST).sort())
        for (const rule of Object.values(GEOMETRY_ALLOW_LIST)) expect(OFFSET_POP_FAMILY_EVIDENCE).toHaveProperty(rule)
    })

    it("sets no font size, family, alignment or line clamp (FONT-1..5, FLOW-1/3/4/5)", () => {
        const type = /^(?:font-size|font-family|font|text-align|text-overflow|-webkit-line-clamp|line-clamp|hyphens)$/
        expect(painted.filter((d) => type.test(d.property)).map((d) => `${d.property} in ${short(d.selector)}`)).toEqual([])
        expect(painted.filter((d) => d.property === "line-height").map((d) => d.selector)).toEqual([`${SCOPE} [data-component="Heading"][data-scale="display"]`])
    })

    it("targets no icon, media or field-label renderer outside the claimed treatments (ICON, MEDIA)", () => {
        for (const component of ["Icon", "IconTile", "IconButton", "RankArtwork"]) {
            expect(familyRules.some((rule) => rule.selector.includes(`[data-component="${component}"]`)), component).toBe(false)
        }
    })

    /*
     * KNOWN GAP (BOUNDARY-3), kept inherited on purpose and flagged for the styles.css owner.
     *
     * StaticStateRow claims BOUNDARY-3 ("one line between consecutive rows"), which Common pays with
     * `.starci-core-static-row + .starci-core-static-row { border-top: 1px solid var(--separator) }`.
     * The family adds `[data-grammar-row] { border-block-end: 2px solid var(--separator) }` (last row
     * cleared) without clearing Common's `border-top`, so each seam has two owners and draws 3px.
     * Flip to `it` when the family either drops its own row edge or neutralises Common's seam.
     */
    it.fails("gives every row seam exactly one owner", () => {
        const familyRowEdge = painted.some((d) => d.selector === `${SCOPE} [data-grammar-row]` && d.property.startsWith("border-block-end") && d.value !== "0")
        const commonSeam = /\.starci-core-static-row \+ \.starci-core-static-row\s*\{[^}]*border-top:/.test(commonCss)
        const familyClearsSeam = painted.some((d) => d.selector.includes("[data-grammar-row]") && /^border-(?:top|block-start)/.test(d.property))
        expect(familyRowEdge && commonSeam && !familyClearsSeam).toBe(false)
    })
})

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

const css = readFileSync(resolve(process.cwd(), "src/offset-pop/styles.css"), "utf8")
const commonCss = readFileSync(resolve(process.cwd(), "src/common/styles.css"), "utf8")

type Declaration = { readonly property: string; readonly value: string }
type FamilyRule = { readonly selector: string; readonly declarations: ReadonlyArray<Declaration> }

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
    return parts.filter(Boolean)
}

const parse = (body: string): ReadonlyArray<Declaration> => body.split(";")
    .map((declaration) => declaration.split(":"))
    .filter((parts) => parts.length >= 2 && (parts[0] ?? "").trim() !== "")
    .map((parts) => ({ property: (parts[0] ?? "").trim(), value: parts.slice(1).join(":").replace(/\s+/g, " ").trim() }))

const uncommented = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "")

/** Leaf rules of `source`, one entry per selector in each selector list (at-rule preludes dropped). */
const rulesIn = (source: string): ReadonlyArray<FamilyRule> => cssRules(source).flatMap((rule) => {
    const declarations = parse(rule.body)
    return selectorList(rule.selector).map((selector) => ({ selector, declarations }))
})

/** Where the `{` of `prelude` opens and its matching `}` closes. */
const blockRange = (source: string, prelude: string): readonly [number, number] => {
    const at = source.indexOf(`${prelude} {`)
    expect(at, `missing ${prelude}`).toBeGreaterThan(-1)
    const open = source.indexOf("{", at)
    let depth = 0
    for (let index = open; index < source.length; index += 1) {
        if (source[index] === "{") depth += 1
        else if (source[index] === "}" && --depth === 0) return [open, index]
    }
    throw new Error(`unbalanced ${prelude}`)
}
const atRuleBody = (source: string, prelude: string) => {
    const [open, close] = blockRange(source, prelude)
    return source.slice(open + 1, close)
}

const source = uncommented(css)
const MEDIA = ["@media (max-width: 40rem)", "@media (prefers-reduced-motion: reduce)", "@media (prefers-color-scheme: dark)", "@media (forced-colors: active)"]
/** The sheet with every conditional block removed: what the family paints unconditionally. */
const baseSource = MEDIA.reduce((text, prelude) => {
    const [open, close] = blockRange(text, prelude)
    return text.slice(0, text.indexOf(`${prelude} {`)) + text.slice(close + 1)
}, source)

/** Every leaf family rule, conditional or not. */
const familyRules = rulesIn(source)
/** Only the unconditional rules. */
const baseRules = rulesIn(baseSource)

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
const tokensOf = (rules: ReadonlyArray<FamilyRule>) => new Map((rules.find((rule) => rule.selector === SCOPE)?.declarations ?? []).map((d) => [d.property, d.value]))
const rootTokens = tokensOf(baseRules)
const forcedTokens = tokensOf(rulesIn(atRuleBody(source, "@media (forced-colors: active)")))
const reducedMotion = rulesIn(atRuleBody(source, "@media (prefers-reduced-motion: reduce)"))
const narrow = rulesIn(atRuleBody(source, "@media (max-width: 40rem)"))

/** Non-custom-property declarations, in every condition: what a family rule actually paints. */
const painted = familyRules.flatMap((rule) => rule.declarations
    .filter((d) => !d.property.startsWith("--"))
    .map((d) => ({ ...d, selector: rule.selector })))

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
        for (const word of ["mia", "starci academy", "course", "student", "checkout"]) expect(text).not.toContain(word)
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
})

/**
 * One proof per family claim. Where an existing spec already asserts the mechanism, the proof
 * cites it and re-checks the load-bearing declaration here so a claim cannot outlive its CSS.
 */
const PROOF: Readonly<Record<keyof typeof OFFSET_POP_FAMILY_EVIDENCE, () => void>> = {
    // styles.spec "paints the accent as text only through the text-safe accent"; shipped-claims "never colours text with the fill accent".
    "ACCENT-1": () => {
        expect(rootTokens.get("--accent")).toBe("var(--offset-pop-accent)")
        expect(OFFSET_POP_DNA.color.accent).toBe(OFFSET_POP_DNA.palette.pink)
        const accentPaint = painted.filter((d) => /var\(--(?:accent|offset-pop-accent|offset-pop-pink)\)/.test(d.value))
        expect(accentPaint.map((d) => `${d.property} in ${d.selector}`)).toEqual([])
    },
    // styles.spec "draws semantic colours from the family palette and ink" (border = separator = ink).
    "BOUNDARY-1": () => {
        const nav = declared("[data-grammar-navigation-feature-nav]")
        expect(nav.get("border-block-end-width")).toBe("var(--offset-pop-outline-width)")
        expect(nav.get("border-block-end-color")).toBe("var(--border)")
        expect(OFFSET_POP_DNA.color.light.border).toBe(OFFSET_POP_DNA.color.light.separator)
        expect(OFFSET_POP_DNA.color.dark.border).toBe(OFFSET_POP_DNA.color.dark.separator)
        expect([forcedTokens.get("--offset-pop-border"), forcedTokens.get("--offset-pop-separator")]).toEqual(["CanvasText", "CanvasText"])
    },
    "BOUNDARY-4": () => {
        expect(declared("[data-grammar-rail]").get("border-inline-end")).toBe("var(--offset-pop-outline-width) solid var(--border)")
        expect(commonCss).not.toMatch(/\.starci-core-rail(?:\[[^\]]*\])*\s*\{[^}]*border-inline-end/)
    },
    "BOUNDARY-5": () => {
        const outline = "var(--offset-pop-outline-width) solid var(--border)"
        for (const hook of [BOUNDED, "[data-grammar-surface]", "[data-component=\"Button\"]", "[data-component=\"Badge\"]", "[data-grammar-state-mark]"]) {
            expect(declared(hook).get("border"), hook).toBe(outline)
        }
        expect(rootTokens.get("--offset-pop-outline-width")).toBe("2px")
    },
    // styles.spec "binds semantic Common variables and preserves hard family surface geometry" and the forced-colour token test.
    "BOUNDARY-6": () => {
        expect(declared(`${BOUNDED}[data-grammar-surface-depth="top"]`).get("box-shadow")).toBe("var(--shadow-surface)")
        expect(declared(BOUNDED).get("border")).toBe("var(--offset-pop-outline-width) solid var(--border)")
        expect(rootTokens.get("--shadow-surface")).toBe("var(--offset-pop-surface-shadow)")
        expect(rootTokens.get("--offset-pop-surface-shadow")).toBe("var(--offset-pop-shadow-x) var(--offset-pop-shadow-y) 0 var(--offset-pop-shadow-ink)")
        expect(forcedTokens.get("--shadow-surface")).toBe("none")
    },
    // styles.spec "sets, in light, dark, system-dark and forced colours, every token Core sets there" and "meets WCAG AA contrast in light|dark mode".
    "COLOR-5": () => {
        expect(css).toContain(`${SCOPE}[data-grammar-theme="dark"] {`)
        expect(atRuleBody(css, "@media (prefers-color-scheme: dark)")).toContain(`${SCOPE}[data-grammar-theme="system"]`)
        expect(forcedTokens.get("--offset-pop-canvas")).toBe("Canvas")
        expect(forcedTokens.get("--offset-pop-foreground")).toBe("CanvasText")
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
        expect(edges.length).toBeGreaterThan(5)
        for (const edge of edges) expect(edge.selector.startsWith(`${SCOPE} [`), edge.selector).toBe(true)
    },
    "CORE-BOUNDARY-4": () => {
        expect(painted.filter((d) => /^(?:z-index|position|isolation)$/.test(d.property))).toEqual([])
        expect(declared(`${BOUNDED}[data-grammar-surface-depth="nested"]`).get("box-shadow")).toBe("none")
        expect(forcedTokens.get("--offset-pop-surface-shadow")).toBe("none")
    },
    // styles.spec "uses invariant spacing for focus, press, responsive, and reduced-motion vectors".
    "CORE-BOUNDARY-5": () => {
        expect(source.match(/@media \([^)]*width[^)]*\)/g)).toEqual(["@media (max-width: 40rem)"])
        expect(narrow.flatMap((rule) => rule.declarations.map((d) => d.property)).every((property) => property.startsWith("--"))).toBe(true)
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
    // styles.spec "meets WCAG AA contrast" (focusOnCanvas/focusOnSurface >= 3) and "uses invariant spacing for focus ...".
    "FOCUS-1": () => {
        expect(rootTokens.get("--focus")).toBe("var(--offset-pop-focus)")
        expect(forcedTokens.get("--offset-pop-focus")).toBe("Highlight")
        for (const hook of [`${BOUNDED}:has([data-grammar-whole-action]:focus-visible)`, "[data-grammar-row]:focus-within"]) {
            const ring = declared(hook)
            expect(ring.get("outline"), hook).toBe("2px solid var(--focus)")
            expect(ring.get("outline-offset"), hook).toBe("0.25rem")
        }
    },
    // shipped-claims "keeps Button press, pending and disabled ownership": the press outcome is Common's.
    "MOTION-1": () => {
        const transforms = painted.filter((d) => d.property === "transform")
        expect(transforms.length).toBeGreaterThan(0)
        for (const move of transforms.filter((d) => d.value !== "none")) expect(move.selector, move.value).toContain(":active")
        expect(painted.filter((d) => /^animation/.test(d.property))).toEqual([])
    },
    // styles.spec "uses invariant spacing for focus, press, responsive, and reduced-motion vectors".
    "MOTION-2": () => {
        const root = reducedMotion.find((rule) => rule.selector === SCOPE)
        expect(Object.fromEntries((root?.declarations ?? []).map((d) => [d.property, d.value]))).toEqual({
            "--offset-pop-motion-duration": "0ms",
            "--offset-pop-transition": "0ms linear",
        })
        const still = new Set(reducedMotion.filter((rule) => rule.declarations.some((d) => d.property === "transform" && d.value === "none")).map((rule) => rule.selector))
        for (const hook of ["[data-component=\"Button\"]", BOUNDED, "[data-grammar-surface]", "[data-grammar-row]"]) expect(still, hook).toContain(`${SCOPE} ${hook}`)
    },
    // styles.spec "keeps every DNA value equal to its CSS default" (motion duration and easing).
    "MOTION-3": () => {
        const transitions = painted.filter((d) => d.property === "transition")
        expect(transitions.length).toBeGreaterThan(0)
        for (const transition of transitions) {
            for (const part of transition.value.split(",")) expect(part.trim()).toMatch(/^[a-z-]+ var\(--offset-pop-transition\)$/)
        }
        expect(rootTokens.get("--offset-pop-transition")).toBe("var(--offset-pop-motion-duration) var(--offset-pop-motion-easing)")
        expect(rootTokens.get("--offset-pop-motion-duration")).toBe(OFFSET_POP_DNA.motion.duration)
    },
    // styles.spec "clips only a list that does not scroll"; shipped-claims "redeclares no OVERFLOW a Common node claims".
    "OVERFLOW-2": () => {
        expect(declared("[data-grammar-list]:not([data-grammar-scroll-region])").get("overflow")).toBe("clip")
        expect(declared("[data-grammar-list]").get("border-radius")).toBe("calc(var(--offset-pop-surface-radius) - var(--offset-pop-outline-width))")
        expect(painted.filter((d) => d.property.startsWith("overflow")).map((d) => d.selector)).toEqual([`${SCOPE} [data-grammar-list]:not([data-grammar-scroll-region])`])
    },
    "RESPONSIVE-1": () => {
        expect(narrow.map((rule) => rule.selector)).toEqual([SCOPE])
        expect(Object.fromEntries(narrow[0]?.declarations.map((d) => [d.property, d.value]) ?? [])).toEqual({
            "--offset-pop-shadow-y": "0.25rem",
            "--offset-pop-surface-radius": "1.25rem",
        })
        expect(narrow.flatMap((rule) => rule.declarations).some((d) => /^(?:display|visibility)$/.test(d.property))).toBe(false)
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
    },
    // shipped-claims mounts a StaticStateRow in every PresentationState, so "reaches a rendered Common node" proves the stripe selector lands.
    "TRUTH-1": () => {
        const stripe = painted.filter((d) => d.property === "box-shadow" && d.value.startsWith("inset"))
        expect(stripe.map((d) => d.selector)).toEqual([`${SCOPE} [data-grammar-row][data-grammar-state]:not([data-grammar-state="neutral"])`])
        expect(familyRules.some((rule) => rule.selector.includes("[data-grammar-state=\"neutral\"]") && !rule.selector.includes(":not("))).toBe(false)
    },
}

describe("Offset Pop rule conformance: every family claim is proved against styles.css", () => {
    it("has exactly one proof per claim", () => {
        expect(Object.keys(PROOF).sort()).toEqual(Object.keys(OFFSET_POP_FAMILY_EVIDENCE).sort())
    })

    it.each(Object.keys(OFFSET_POP_FAMILY_EVIDENCE) as ReadonlyArray<keyof typeof PROOF>)("%s", (rule) => {
        PROOF[rule]()
    })
})

describe("Offset Pop rule conformance: inherited rules really are Common's", () => {
    it("declares no inset, gap, margin, size, layout or stacking (PADDING, GAP, MARGIN, MEASURE, LAYOUT)", () => {
        const geometry = /^(?:padding|margin|gap|row-gap|column-gap|(?:min-|max-)?(?:width|height|inline-size|block-size)|display|flex|grid|inset|top|right|bottom|left|float|align-|justify-|place-|order|aspect-ratio|container)/
        expect(painted.filter((d) => geometry.test(d.property)).map((d) => `${d.property} in ${d.selector}`)).toEqual([])
    })

    it("sets no font size, family or line clamp (FONT-1..5, FLOW-1/3/4/5)", () => {
        const type = /^(?:font-size|font-family|font|text-align|text-overflow|-webkit-line-clamp|line-clamp|hyphens)$/
        expect(painted.filter((d) => type.test(d.property)).map((d) => `${d.property} in ${d.selector}`)).toEqual([])
        expect(painted.filter((d) => d.property === "line-height").map((d) => d.selector)).toEqual([`${SCOPE} [data-component="Heading"][data-scale="display"]`])
    })

    it("targets no icon, media, field or tab renderer (ICON, MEDIA, FIELD)", () => {
        for (const component of ["Icon", "IconTile", "IconButton", "RankArtwork", "Input", "PressableField", "Tabs", "Progress"]) {
            expect(css).not.toContain(`[data-component="${component}"]`)
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

// @vitest-environment jsdom
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Heading, type HeadingLevel, type HeadingScale } from "./index.js"

/**
 * The scale of `knowledge/ui/presentation/font.md`, in the pixels a 16px root resolves it to.
 *
 * The rule ID is the ordinal position on the closed type scale, so the row a stamp names is the
 * render that stamp promises: FONT-1 `text-xs`/`leading-4`, FONT-2 `text-sm`/`leading-5`, FONT-3
 * `text-base`/`leading-6`, FONT-4 `text-xl`, FONT-6 `text-4xl`/`leading-tight`. Tracking is not an
 * application decision either: `Heading` applies `tracking-tight` at FONT-4 and FONT-6 only.
 */
const FONT_SCALE = {
    "FONT-1": { fontSize: "12px", lineHeight: "16px", fontWeight: "500", letterSpacing: "normal" },
    "FONT-2": { fontSize: "14px", lineHeight: "20px", fontWeight: "500", letterSpacing: "normal" },
    "FONT-3": { fontSize: "16px", lineHeight: "24px", fontWeight: "600", letterSpacing: "normal" },
    "FONT-4": { fontSize: "20px", lineHeight: "28px", fontWeight: "600", letterSpacing: "-0.5px" },
    "FONT-6": { fontSize: "36px", lineHeight: "1.25", fontWeight: "600", letterSpacing: "-0.9px" },
} as const

/*
 * Read through `fileURLToPath` rather than `new URL(..., import.meta.url)`: Vite rewrites that exact
 * form into an asset URL, which under the jsdom environment resolves to `http://localhost:3000/...`
 * and never reaches the file the package ships.
 */
const SHIPPED_SHEET = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../../common/styles.css"), "utf8")

/**
 * jsdom parses `@layer` blocks into `CSSLayerBlockRule`, but its cascade never visits the rules
 * inside one, so the shipped sheet is lifted out of its layer before anything is measured. What is
 * measured is still the sheet this package ships, declaration for declaration.
 */
const liftLayers = (rules: CSSRuleList): ReadonlyArray<string> => Array.from(rules).flatMap((rule) =>
    rule.constructor.name === "CSSLayerBlockRule"
        ? liftLayers((rule as CSSGroupingRule).cssRules)
        : [rule.cssText])

/** Renders one Heading under the shipped sheet and returns its node beside the id it stamps. */
const measure = (level: HeadingLevel, scale: HeadingScale) => {
    document.head.replaceChildren()
    document.body.replaceChildren()

    const parser = document.createElement("style")
    parser.textContent = SHIPPED_SHEET
    document.head.append(parser)
    const flattened = liftLayers(document.styleSheets[0]!.cssRules).join("\n")
    parser.remove()

    const sheet = document.createElement("style")
    sheet.textContent = flattened
    document.head.append(sheet)

    document.body.innerHTML = `<div class="grammar-common-root" data-grammar-family="core">${
        renderToStaticMarkup(<Heading level={level} scale={scale}>Evidence</Heading>)
    }</div>`

    const node = document.querySelector<HTMLElement>("[data-component=\"Heading\"]")
    expect(node, `no Heading rendered at level ${level} / ${scale}`).not.toBeNull()

    return { node: node!, computed: getComputedStyle(node!) }
}

describe("Core Heading", () => {
    it("binds outline level to the semantic heading element", () => {
        const markup = renderToStaticMarkup(<Heading level={3}>Evidence</Heading>)

        expect(markup).toContain("<h3")
        expect(markup).toContain("data-level=\"3\"")
        expect(markup).toContain("data-scale=\"standard\"")
        expect(markup).toContain("Evidence")
    })

    it("changes display emphasis without changing outline semantics", () => {
        const markup = renderToStaticMarkup(<Heading level={1} scale="display">Overview</Heading>)

        expect(markup).toContain("<h1")
        expect(markup).toContain("data-scale=\"display\"")
        expect(markup).toContain("text-4xl")
    })

    it("supports a semantic visually-hidden heading and skeleton state", () => {
        const markup = renderToStaticMarkup(<Heading isSkeleton isVisuallyHidden>Loading title</Heading>)

        expect(markup).toContain("aria-hidden=\"true\"")
        expect(markup).toContain("data-loading=\"true\"")
        expect(markup).toContain("sr-only")
    })

    /**
     * A stamp is a promise about the render, so the render is what this reads.
     *
     * `Heading` renders through the vendor's `Typography.Heading`, which sizes `.typography--h1`
     * through `--h4` from its own sheet. Until 0.4.12 the family answered that with Tailwind
     * utility classes alone - and a utility class only exists where the CONSUMER's Tailwind build
     * scanned this package, which is the same debt `shipped-geometry.spec.ts` refuses for layout.
     * A consumer whose scan stopped finding the package measured 36px under a `FONT-4` stamp and
     * 30px under `FONT-3`. So the sizes are read here from the sheet this package ships, with no
     * Tailwind build and no vendor stylesheet present: whatever a consumer's scan does, these are
     * the pixels the family itself puts behind its own stamps.
     */
    it("renders the font size each FONT stamp claims from the family's own sheet, per level and scale", () => {
        const cases = [
            { level: 1, scale: "standard" },
            { level: 2, scale: "standard" },
            { level: 3, scale: "standard" },
            { level: 4, scale: "standard" },
            { level: 1, scale: "display" },
        ] as const

        for (const { level, scale } of cases) {
            const { node, computed } = measure(level, scale)
            const stamped = (node.getAttribute("data-contract") ?? "")
                .split(" ")
                .find((id) => id.startsWith("FONT-")) as keyof typeof FONT_SCALE | undefined

            expect(stamped, `level ${level} / ${scale} stamps no FONT rule`).toBeDefined()
            const claimed = FONT_SCALE[stamped!]
            expect(claimed, `level ${level} / ${scale} stamps unknown ${stamped}`).toBeDefined()

            const where = `${stamped} at level ${level} / ${scale}`
            expect(computed.fontSize, `${where} renders another rank's size`).toBe(claimed.fontSize)
            expect(computed.lineHeight, `${where} renders another rank's line height`).toBe(claimed.lineHeight)
            expect(computed.fontWeight, `${where} renders another weight`).toBe(claimed.fontWeight)
            expect(computed.letterSpacing, `${where} renders another tracking`).toBe(claimed.letterSpacing)
        }
    })
})

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { STARCI_CORE_TOKEN_DEFAULTS, STARCI_CORE_TOKEN_NAMES } from "./dna.js"

const coreCss = readFileSync(new URL("./styles.css", import.meta.url), "utf8")
const commonCss = readFileSync(new URL("../common/styles.css", import.meta.url), "utf8")
const css = `${coreCss}\n${commonCss}`

describe("Core capability styles", () => {
    it("packages the StarCi DNA behind one explicit root boundary", () => {
        expect(coreCss).toContain("@import \"../common/styles.css\"")
        expect(coreCss).toMatch(/\.grammar-common-root\[data-grammar-family="core"\]\s*\{[\s\S]*?--starci-core-accent: #7547ff;/)
        expect(coreCss).toMatch(/\.grammar-common-root\[data-grammar-family="core"\]\s*\{[\s\S]*?--starci-core-surface-radius: 1rem;/)
        expect(coreCss).toMatch(/\.grammar-common-root\[data-grammar-family="core"\]\[data-grammar-theme="dark"\]\s*\{[\s\S]*?color-scheme: dark;/)
        expect(coreCss).toContain(".grammar-common-root[data-grammar-family=\"core\"][data-grammar-theme=\"system\"]")
        expect(coreCss).not.toContain(".starci-core-page-container")
        expect(commonCss).toContain(".starci-core-page-container")
        expect(css).toContain("@media (forced-colors: active)")
        for (const tokenName of Object.values(STARCI_CORE_TOKEN_NAMES)) {
            expect(coreCss, `missing CSS definition for ${tokenName}`).toContain(`${tokenName}:`)
        }
        for (const [tokenName, value] of Object.entries(STARCI_CORE_TOKEN_DEFAULTS)) {
            if (["--starci-core-page-inset", "--starci-core-region-gap", "--starci-core-section-gap", "--starci-core-inline-gap", "--starci-core-row-gap"].includes(tokenName)) {
                expect(coreCss, `legacy alias missing for ${tokenName}`).toContain(`${tokenName}: var(--grammar-`)
            } else {
                expect(coreCss, `CSS default drifted from ${tokenName}`).toContain(`${tokenName}: ${value};`)
            }
        }
    })

    it("owns reusable page, section, media and primary-rail compositions", () => {
        expect(css).toContain(".starci-core-page-container")
        expect(css).toContain(".starci-core-section-header")
        expect(css).toContain(".starci-core-media-viewport")
        expect(css).toMatch(/data-grammar-media-treatment="plain"[\s\S]*?border-color: transparent;[\s\S]*?background: transparent;/)
        expect(css).toMatch(/data-grammar-tabs-inset="page"[\s\S]*?padding-inline: 1\.5rem;/)
        expect(css).toMatch(/\.starci-core-tabs \.tabs__tab\s*\{[\s\S]*?position: relative;[\s\S]*?width: auto !important;[\s\S]*?flex: 0 0 auto !important;[\s\S]*?padding-inline: 0\.75rem !important;[\s\S]*?padding-block-end: 0 !important;/)
        expect(css).toMatch(/\.starci-core-tabs \.tabs__indicator\s*\{[\s\S]*?bottom: 0 !important;[\s\S]*?height: 2px !important;/)
        expect(css).toMatch(/\.starci-core-primary-rail-container\s*\{[\s\S]*?container: starci-core-primary-rail \/ inline-size;/)
        expect(css).toContain("@container starci-core-primary-rail (max-width: 56rem)")
    })

    it("owns included-mark, compact copy and accordion anatomy instead of UI knowledge", () => {
        expect(css).toMatch(/\.starci-core-included-mark\s*\{[\s\S]*?width: 1\.25rem;[\s\S]*?height: 1\.25rem;[\s\S]*?color: inherit;/)
        expect(css).toMatch(/\.starci-core-surface-copy-group\s*\{[\s\S]*?gap: 0\.5rem;/)
        expect(css).toContain(".starci-core-accordion-trigger")
        expect(css).toContain(".starci-core-accordion-panel")
    })

    it("owns compact form measure, bounded branch scrolling and field rhythm", () => {
        expect(css).toMatch(/\.starci-core-form-page\s*\{[\s\S]*?align-items: center;[\s\S]*?justify-content: center;[\s\S]*?overflow: hidden;/)
        expect(css).toMatch(/\.starci-core-form-scroll-viewport\s*\{[\s\S]*?width: 100%;[\s\S]*?max-height: calc\(100dvh - 3rem\);/)
        expect(css.match(/\.starci-core-form-scroll-viewport\s*\{[\s\S]*?\}/)?.[0]).not.toContain("overflow-y")
        expect(css).toMatch(/\.starci-core-form-surface\s*\{[\s\S]*?width: min\(100%, var\(--starci-core-form-measure, 30rem\)\);/)
        expect(css).toMatch(/\.starci-core-form-surface--compact\s*\{[\s\S]*?width: min\(100%, var\(--starci-core-form-compact-measure, 28rem\)\);/)
        expect(css).toMatch(/\.starci-core-form-surface > \.card,[\s\S]*?\.starci-core-form-surface > \.starci-core-surface[\s\S]*?\{[\s\S]*?max-height: calc\(100dvh - 3rem\);[\s\S]*?overflow: hidden !important;[\s\S]*?padding: 0 !important;/)
        expect(css).toMatch(/data-grammar-surface-composition="joined"[\s\S]*?padding: 0;/)
        expect(css).toMatch(/data-grammar-surface-height="fill"[\s\S]*?height: 100%;/)
        expect(css).toMatch(/\.starci-core-form-field\s*\{[\s\S]*?flex-direction: column;[\s\S]*?gap: var\(--starci-core-field-gap, 0\.5rem\);/)
        expect(css).toMatch(/\.starci-core-form-label--screen-reader\s*\{[\s\S]*?position: absolute;[\s\S]*?clip: rect\(0, 0, 0, 0\);/)
        expect(css).toMatch(/\.starci-core-horizontal-scroll-region\s*\{[\s\S]*?overscroll-behavior-inline: contain;/)
        expect(css).toMatch(/\.starci-core-horizontal-scroll-region > \*\s*\{[\s\S]*?min-width: max-content;/)
    })

    it("keeps canonical surface, collection and rail selectors", () => {
        expect(css).toContain("[data-grammar-scroll=\"contained\"]")
        expect(css).toContain(".starci-core-surface.starci-core-frameless-surface")
        expect(css).toContain(".starci-core-surface-highlight-sweep")
        expect(css).toContain(".starci-core-label")
        expect(css).toContain(".starci-core-tooltip")
        expect(css).toMatch(/\.starci-core-tooltip:hover > \.starci-core-tooltip-content,[\s\S]*?opacity: 1;/)
        expect(css).toContain("animation: starci-core-highlight-spin 3s linear infinite")
        const highlightRule = css.match(/\.starci-core-surface-highlight-sweep\s*\{([\s\S]*?)\}/)?.[1] ?? ""
        expect(highlightRule).toContain("inset: var(--starci-core-highlight-inset, 0)")
        expect(highlightRule).toContain("padding: 2px")
        expect(highlightRule).toContain("mask-composite: exclude")
        expect(highlightRule).not.toContain("inset: -")
        expect(css).toContain(".starci-core-owned-collection")
        expect(css).toContain("[data-grammar-collapse=\"collapsed\"]")
        expect(css).toContain(".starci-core-surface-accordion-card")
    })

    it("hides scrollbar chrome by default without disabling overflow", () => {
        expect(commonCss).toMatch(/\.grammar-common-root,\s*\.grammar-common-root \*\s*\{[\s\S]*?scrollbar-width: none;/)
        expect(commonCss).toMatch(/\.grammar-common-root::-webkit-scrollbar,[\s\S]*?display: none;[\s\S]*?width: 0;[\s\S]*?height: 0;/)
    })

    it("keeps disclosure geometry full-width while accordion hover and pressed states stay visually invariant", () => {
        expect(css).toMatch(/\.starci-core-accordion-shell\s*\{[\s\S]*?width: 100%/)
        expect(css).toMatch(/\.starci-core-surface\s*\{[\s\S]*?border-radius:[\s\S]*?background:/)
        expect(css).toMatch(/\.starci-core-surface\[data-grammar-surface-depth="top"\]\s*\{[\s\S]*?box-shadow:/)
        expect(css).toMatch(/\.starci-core-surface\[data-grammar-surface-depth="nested"\]\s*\{[\s\S]*?border: 1px solid/)
        expect(css).not.toContain(".starci-core-accordion-shell-frameless")
        expect(css).toMatch(/\.starci-core-accordion-row \+ \.starci-core-accordion-row\s*\{[\s\S]*?border-top:/)
        expect(css).toMatch(/\.starci-core-accordion-trigger\s*\{[\s\S]*?padding:/)
        expect(css).toMatch(/\.starci-core-accordion-trigger:hover,[\s\S]*?\.starci-core-accordion-trigger:active,[\s\S]*?\[aria-expanded="true"\][\s\S]*?background: transparent;[\s\S]*?transform: none;/)
        expect(css).toMatch(/\.starci-core-accordion-trigger:focus-visible,[\s\S]*?outline: 2px solid var\(--focus,/)
        /*
         * Scoped to the trigger's OWN rule.
         *
         * The guard used to be an unbounded `[\s\S]*?` over the whole sheet, so it went red the
         * first time any later object painted a selected state with `--accent-soft` - which says
         * nothing about the accordion trigger. What it means is that the trigger's hover rule must
         * not tint; that is the block it now reads.
         */
        const accordionHoverRule = css.match(/\.starci-core-accordion-trigger:hover,[^{]*\{[^}]*\}/)?.[0] ?? ""
        expect(accordionHoverRule).not.toBe("")
        expect(accordionHoverRule).not.toContain("var(--accent-soft")
    })

    it("paints a labelled Core SurfaceCard as one label-inside material box", () => {
        expect(coreCss).toMatch(/data-grammar-surface-labelled="true"\]\[data-grammar-frame="bounded"\][\s\S]*?background: var\(--starci-core-surface,[\s\S]*?box-shadow:/)
        expect(coreCss).toMatch(/> \[data-grammar-surface-label\][\s\S]*?padding:/)
        expect(coreCss).toMatch(/> \[data-grammar-frame="bounded"\][\s\S]*?background: transparent;[\s\S]*?box-shadow: none;/)
    })

    /**
     * Two members of the surface family standing in one column drew the same boundary in two
     * different places: the card's root is a HeroUI `Card`, whose own 1rem padding pushed its
     * visible surface and its label 16px further in than the accordion's, which is a plain Grammar
     * section. The boundary is the outer box for all three; the single inset belongs INSIDE it.
     */
    it("insets the surface family once, inside a boundary all three roots share", () => {
        expect(css).toMatch(/\.starci-core-surface-card\s*\{[\s\S]*?padding: 0 !important;/)
        const shared = css.slice(css.indexOf(".starci-core-surface-card,"))
        expect(shared.slice(0, shared.indexOf("}")), "the family roots take no inset of their own").not.toContain("padding")
        expect(css).toMatch(/\.starci-core-surface-content\s*\{[\s\S]*?padding: var\(--starci-core-surface-inset, 1rem\);/)
        expect(css).toMatch(/\.starci-core-accordion-trigger\s*\{[\s\S]*?padding: var\(--starci-core-row-inset, 1rem\) !important;/)
    })

    it("gives Grammar whole-card actions hover, focus, active and reduced-motion parity", () => {
        expect(css).toContain(".starci-core-surface-card[data-grammar-interaction=\"whole-action\"]")
        expect(css).toContain("[data-grammar-whole-action]:hover")
        expect(css).toContain("[data-grammar-whole-action]:focus-visible")
        expect(css).toContain("[data-grammar-whole-action]:active")
    })

    it("keeps static joined lists full-bleed and hover-invariant", () => {
        expect(css).toMatch(/\.starci-core-static-row \+ \.starci-core-static-row\s*\{[\s\S]*?border-top:/)
        expect(css).toMatch(/\.starci-core-list-shell\[data-grammar-hover="invariant"\] \.starci-core-static-row:hover\s*\{[\s\S]*?background: transparent;[\s\S]*?box-shadow: none;[\s\S]*?transform: none;/)
    })

    /*
     * The verdict collection now PAINTS the verdict.
     *
     * It already squared its corners for these rows while the edge itself stayed with the
     * application, which had to reach across the boundary with its own inset shadow to draw it. The
     * edge is an inset shadow rather than a border because the rows are usually the caller's own
     * children, and a border would move their content by two pixels.
     */
    it("draws a 2px leading verdict edge on a row in a verdict collection", () => {
        expect(css).toMatch(/\.starci-core-owned-collection\[data-grammar-collection="verdict"\] \[data-verdict="success"\],[\s\S]*?--starci-core-verdict-edge: inset 2px 0 0 0 var\(--success,/)
        expect(css).toMatch(/\.starci-core-owned-collection\[data-grammar-collection="verdict"\] \[data-verdict="danger"\],[\s\S]*?--starci-core-verdict-edge: inset 2px 0 0 0 var\(--danger,/)
        expect(css).toContain("box-shadow: var(--starci-core-verdict-edge, none);")
        const edgeRules = css.match(/inset 2px 0 0 0 var\(--(?:success|danger)/g) ?? []
        expect(edgeRules, "one value per verdict, read from a property everywhere else").toHaveLength(2)
    })

    it("keeps the verdict edge under the hover-invariant reset that clears row shadows", () => {
        expect(css).toMatch(/\.starci-core-list-shell\[data-grammar-hover="invariant"\] \.starci-core-static-row\[data-verdict="success"\]:hover,[\s\S]*?box-shadow: var\(--starci-core-verdict-edge, none\);/)
    })

    it("keeps ordered row prefixes quiet and free of badge decoration", () => {
        const rule = css.match(/\.starci-core-leading-number\s*\{([\s\S]*?)\}/)?.[1] ?? ""
        expect(rule).toContain("font-size: 0.875rem")
        expect(rule).toContain("font-variant-numeric: tabular-nums")
        expect(rule).not.toContain("border-radius")
        expect(rule).not.toContain("background")
    })

    it("keeps Markdown semantic rhythm, code-chip treatment and bounded overflow", () => {
        expect(css).toMatch(/\.starci-core-markdown-article\s*\{[\s\S]*?font-size: 0\.875rem;/)
        expect(css).toMatch(/\.starci-core-markdown-article :not\(pre\) > code\s*\{[\s\S]*?border-radius: 999px;/)
        expect(css).toMatch(/\.starci-core-markdown-article pre,[\s\S]*?overflow-x: auto;/)
        expect(css).toMatch(/\.starci-core-markdown-article table,[\s\S]*?\.starci-core-markdown-table-frame\s*\{[\s\S]*?overflow-x: auto;/)
        expect(css).toContain(".starci-core-markdown-table-frame")
        expect(css).toContain("[data-grammar-fenced-code-highlight=\"true\"]")
    })

    it("keeps every rail control at least 44 by 44 CSS pixels", () => {
        expect(css).toContain(".starci-core-rail :where(button, [role=\"button\"])")
        expect(css).toContain("min-inline-size: 44px")
        expect(css).toContain("min-block-size: 44px")
    })

    it("lets a layout-owned rail fill its host while its child owns scrolling", () => {
        expect(css).toMatch(/\.starci-core-rail\[data-grammar-rail-height="fill"\][\s\S]*?height: 100%/)
        expect(css).toMatch(/data-grammar-rail-height="fill"\] \.starci-core-rail-frame\s*\{[\s\S]*?max-height: none;/)
        expect(css).toMatch(/data-grammar-rail-height="fill"\] \.starci-core-rail-body\s*\{[\s\S]*?overflow: hidden;/)
    })

    it("retains narrow-viewport and reduced-motion safeguards", () => {
        expect(css).toContain("@media (max-width: 47.999rem)")
        expect(css).toContain("@media (prefers-reduced-motion: reduce)")
    })

    it("supports a leading workspace rail with a vertical separator", () => {
        expect(css).toMatch(/data-grammar-workspace-rail-position="leading"\]\[data-grammar-workspace-navigation="absent"\]\[data-grammar-workspace-rail="present"\][\s\S]*?grid-template-areas: "rail rule primary"/)
        expect(css).toContain(".starci-core-workspace-shell-leading-rule")
        expect(css).toMatch(/\.starci-core-workspace-shell-leading-rule[\s\S]*?align-self: stretch/)
    })

    it("owns intrinsic navigation tracks and desktop-only navigation reflow", () => {
        expect(css).toMatch(/data-grammar-workspace-navigation-track="intrinsic"[\s\S]*?--starci-core-workspace-navigation-track: max-content;/)
        expect(css).toMatch(/data-grammar-workspace-navigation-visibility="wide"[\s\S]*?\.starci-core-workspace-shell-navigation[\s\S]*?display: none;/)
        expect(css).toMatch(/data-grammar-workspace-navigation-visibility="wide"\]\[data-grammar-workspace-rail="absent"\][\s\S]*?grid-template-areas: "primary";/)
    })
})

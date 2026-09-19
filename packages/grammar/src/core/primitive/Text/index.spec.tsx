import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Text } from "./index.js"

describe("Core Text", () => {
    it("owns default DOM semantics and live-region behavior", () => {
        const markup = renderToStaticMarkup(
            <Text id="save-status" size="sm" tone="accent" weight="semibold" live="polite">
                Saved
            </Text>,
        )

        expect(markup).toMatch(/^<div /)
        expect(markup).toContain("id=\"save-status\"")
        expect(markup).toContain("data-size=\"sm\"")
        expect(markup).toContain("data-tone=\"accent\"")
        expect(markup).toContain("role=\"status\"")
        expect(markup).toContain("aria-live=\"polite\"")
    })

    it("accepts app-owned leading content without owning product glyph names", () => {
        const markup = renderToStaticMarkup(<Text as="span" startContent={<i data-glyph />}>Fact</Text>)

        expect(markup).toMatch(/^<span /)
        expect(markup).toContain("data-start-content=\"true\"")
        expect(markup).toContain("data-glyph=\"true\"")
        expect(markup.indexOf("data-glyph")).toBeLessThan(markup.indexOf("Fact"))
    })

    it("keeps inert size-specific geometry while initially unresolved", () => {
        const markup = renderToStaticMarkup(<Text size="metric-lead" live="assertive" isSkeleton />)

        expect(markup).toContain("data-loading=\"true\"")
        expect(markup).toContain("aria-hidden=\"true\"")
        expect(markup).toContain("data-size=\"metric-lead\"")
        expect(markup).not.toContain("role=\"alert\"")
        expect(markup).not.toContain("aria-live")
    })

    it("keeps shared parent and superseded treatments explicit, and owns no press state", () => {
        const markup = renderToStaticMarkup(
            <Text size="xs" tone="accent" isSuperseded parentEmphasis="accent-soft">Old price</Text>,
        )

        expect(markup).toContain("data-tone=\"muted\"")
        expect(markup).not.toContain("press-label")
        expect(markup).toContain("data-superseded=\"true\"")
        expect(markup).toContain("data-parent-emphasis=\"accent-soft\"")
    })
})

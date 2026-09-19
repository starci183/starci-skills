import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Badge } from "./index.js"

describe("Core Badge", () => {
    it("binds semantic tones and app-owned leading content", () => {
        const markup = renderToStaticMarkup(<Badge tone="success" startContent={<i data-glyph />}>Ready</Badge>)

        expect(markup).toContain("data-component=\"Badge\"")
        expect(markup).toContain("data-tone=\"success\"")
        expect(markup).toContain("data-glyph=\"true\"")
        expect(markup).toContain("Ready")
    })

    it("keeps unresolved chip geometry inert", () => {
        const markup = renderToStaticMarkup(<Badge tone="danger" startContent={<i data-glyph />} isSkeleton>Failed</Badge>)

        expect(markup).toContain("data-loading=\"true\"")
        expect(markup).toContain("aria-hidden=\"true\"")
        expect(markup).toContain("text-transparent")
        expect(markup).not.toContain("data-glyph")
    })
})

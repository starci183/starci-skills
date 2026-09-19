import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { EmptyNotice } from "./index.js"

const EmptyGlyph = (props: React.SVGProps<SVGSVGElement>) => <svg {...props}><path d="M1 1h1" /></svg>

describe("Core EmptyNotice", () => {
    it("owns the shared empty-region composition while accepting app-owned glyphs", () => {
        const markup = renderToStaticMarkup(
            <EmptyNotice
                message="No results"
                description="Try a different filter."
                iconSource={EmptyGlyph}
                actionLabel="Clear filters"
                actionStartContent={<i data-action-glyph />}
                actionVariant="secondary"
            />,
        )

        expect(markup).toContain("data-component=\"EmptyNotice\"")
        expect(markup).toContain("No results")
        expect(markup).toContain("Try a different filter.")
        expect(markup).toContain("<svg")
        expect(markup).toContain("data-action-glyph")
        expect(markup).toContain("Clear filters")
    })

    it("keeps pending feedback on the action that started it", () => {
        const markup = renderToStaticMarkup(
            <EmptyNotice message="Could not load" actionLabel="Retry" isActionPending />,
        )

        expect(markup).toContain("data-action-pending=\"true\"")
        expect(markup).toContain("aria-busy=\"true\"")
        expect(markup).toContain("Retry")
    })
})

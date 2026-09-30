import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { IconButton } from "./index.js"

const SearchGlyph = (props: React.SVGProps<SVGSVGElement>) => <svg {...props}><path d="M1 1h1" /></svg>

describe("Core IconButton", () => {
    it("requires an accessible label and carries app-owned glyph identity", () => {
        const markup = renderToStaticMarkup(<IconButton source={SearchGlyph} label="Search" isActive />)

        expect(markup).toContain("data-component=\"IconButton\"")
        expect(markup).toContain("data-active=\"true\"")
        expect(markup).toContain("aria-label=\"Search\"")
        expect(markup).toContain("<svg")
    })

    it("is an inert circular placeholder while unresolved", () => {
        const markup = renderToStaticMarkup(<IconButton source={SearchGlyph} label="Search" isSkeleton />)

        expect(markup).toContain("data-loading=\"true\"")
        expect(markup).toContain("disabled=\"\"")
        expect(markup).toContain("aria-label=\"Search\"")
        expect(markup).not.toContain("<svg")
    })
})

describe("Core IconButton variant", () => {
    it("defaults to HeroUI's tertiary plate", () => {
        const markup = renderToStaticMarkup(<IconButton source={SearchGlyph} label="Search" />)
        expect(markup).toContain("data-variant=\"tertiary\"")
        expect(markup).toContain("button--tertiary")
    })

    it("wears HeroUI's ghost as the quiet bare glyph, still icon-only and named", () => {
        const markup = renderToStaticMarkup(<IconButton source={SearchGlyph} label="More actions" variant="ghost" />)
        expect(markup).toContain("data-variant=\"ghost\"")
        expect(markup).toContain("button--ghost")
        expect(markup).not.toContain("button--tertiary")
        expect(markup).toContain("button--icon-only")
        expect(markup).toContain("aria-label=\"More actions\"")
    })
})

describe("Core IconButton disclosure", () => {
    it("forwards aria-controls and aria-expanded for a disclosure toggle", () => {
        const markup = renderToStaticMarkup(
            <IconButton source={SearchGlyph} label="Show filters" aria-controls="filters" aria-expanded={false} />,
        )

        expect(markup).toContain("aria-controls=\"filters\"")
        expect(markup).toContain("aria-expanded=\"false\"")
    })

    it("stamps no disclosure state on a plain action", () => {
        const markup = renderToStaticMarkup(<IconButton source={SearchGlyph} label="Search" />)

        expect(markup).not.toContain("aria-controls")
        expect(markup).not.toContain("aria-expanded")
    })
})

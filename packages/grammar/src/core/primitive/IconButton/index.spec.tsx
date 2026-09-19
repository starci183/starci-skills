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

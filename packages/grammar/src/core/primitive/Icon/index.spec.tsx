import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Icon } from "./index.js"

const SearchGlyph = (props: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" {...props}><path d="M1 1" /></svg>

describe("Core Icon", () => {
    it("sizes an app-owned glyph by semantic usage and hides decorative icons", () => {
        const markup = renderToStaticMarkup(<Icon source={SearchGlyph} usage="leading" />)

        expect(markup).toContain("data-component=\"Icon\"")
        expect(markup).toContain("data-usage=\"leading\"")
        expect(markup).toContain("starci-core-icon")
        expect(markup).toContain("aria-hidden=\"true\"")
    })

    it("labels an icon that carries meaning without adjacent text", () => {
        const markup = renderToStaticMarkup(<Icon source={SearchGlyph} ariaLabel="Search" />)

        expect(markup).toContain("role=\"img\"")
        expect(markup).toContain("aria-label=\"Search\"")
        expect(markup).not.toContain("aria-hidden")
    })

    it("renders a hidden fixed-geometry skeleton without invoking the glyph", () => {
        const markup = renderToStaticMarkup(<Icon source={SearchGlyph} isSkeleton />)

        expect(markup).toContain("data-loading=\"true\"")
        expect(markup).toContain("aria-hidden=\"true\"")
        expect(markup).not.toContain("<svg")
    })
})

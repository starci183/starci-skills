import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { IconTile } from "./index.js"

const RewardGlyph = (props: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" {...props} />

describe("Core IconTile", () => {
    it("pairs tone, foreground, and plate geometry around an app-owned glyph", () => {
        const markup = renderToStaticMarkup(<IconTile source={RewardGlyph} tone="success" size="md" />)

        expect(markup).toContain("data-component=\"IconTile\"")
        expect(markup).toContain("data-tone=\"success\"")
        expect(markup).toContain("data-size=\"md\"")
        expect(markup).toContain("starci-core-icon-tile")
        expect(markup).toContain("data-artwork=\"false\"")
        expect(markup).toContain("data-usage=\"leading\"")
    })

    it("lets app artwork replace the fallback glyph without owning its content", () => {
        const markup = renderToStaticMarkup(
            <IconTile source={RewardGlyph} artwork={<img src="/course.png" alt="" />} />,
        )

        expect(markup).toContain("data-artwork=\"true\"")
        expect(markup).toContain("/course.png")
        expect(markup).not.toContain("<svg")
    })

    it("preserves plate geometry while hiding content during skeleton loading", () => {
        const markup = renderToStaticMarkup(<IconTile source={RewardGlyph} size="md" isSkeleton />)

        expect(markup).toContain("data-loading=\"true\"")
        expect(markup).toContain("aria-hidden=\"true\"")
        expect(markup).toContain("data-size=\"md\"")
        expect(markup).not.toContain("<svg")
    })
})

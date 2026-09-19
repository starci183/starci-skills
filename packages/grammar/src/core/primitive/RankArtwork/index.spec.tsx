import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { RankArtwork, type RankArtworkKind } from "./index.js"

describe("RankArtwork", () => {
    it.each<RankArtworkKind>(["first", "second", "third", "cup"])("renders the %s semantic artwork", (kind) => {
        const markup = renderToStaticMarkup(<RankArtwork kind={kind} />)

        expect(markup).toContain(`data-grammar-rank-artwork="${kind}"`)
        expect(markup).toContain("starci-core-rank-artwork")
        expect(markup).toContain("viewBox=\"0 0 32 32\"")
        expect(markup).toContain("aria-hidden=\"true\"")
        expect(markup).not.toContain("role=\"img\"")
    })

    it("owns the colored medal and cup artwork instead of inheriting a monochrome glyph", () => {
        const medalMarkup = renderToStaticMarkup(<RankArtwork kind="first" />)
        const cupMarkup = renderToStaticMarkup(<RankArtwork kind="cup" />)

        expect(medalMarkup).toContain("#0074BA")
        expect(medalMarkup).toContain("#FFB02E")
        expect(cupMarkup).toContain("#D3883E")
        expect(cupMarkup).toContain("#6D4534")
    })

    it("exposes an accessible image only when a label is supplied", () => {
        const markup = renderToStaticMarkup(<RankArtwork className="size-6" kind="second" label="Hạng 2" />)

        expect(markup).toContain("aria-label=\"Hạng 2\"")
        expect(markup).toContain("role=\"img\"")
        expect(markup).not.toContain("aria-hidden")
        expect(markup).toContain("size-6")
    })
})

import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Label } from "./index.js"

describe("Label", () => {
    it("names a top surface without emitting a heading element", () => {
        const markup = renderToStaticMarkup(<Label id="weekly-goals">Weekly goals</Label>)
        expect(markup).toContain("data-grammar-label=\"true\"")
        expect(markup).toContain("data-grammar-label-depth=\"top\"")
        expect(markup).toContain("starci-core-label")
        expect(markup).toContain("data-contract=\"FONT-2 MARGIN-0\"")
        expect(markup).not.toContain("<h3")
        expect(markup).toContain(">Weekly goals</span>")
    })

    it("recedes when the owning surface is nested", () => {
        const markup = renderToStaticMarkup(<Label depth="nested">Nested metric</Label>)
        expect(markup).toContain("data-grammar-label-depth=\"nested\"")
        expect(markup).toContain("data-contract=\"FONT-1 MARGIN-0\"")
    })

    it("can name a semantic section without changing its visual role", () => {
        const markup = renderToStaticMarkup(<Label as="h3">Session setup</Label>)
        expect(markup).toContain("<h3")
        expect(markup).toContain("data-grammar-label=\"true\"")
        expect(markup).toContain(">Session setup</h3>")
    })

    it.each(["h2", "h3", "h4", "h5", "h6"] as const)("takes the %s rank a surface's place in the outline needs", (as) => {
        const markup = renderToStaticMarkup(<Label as={as}>Session setup</Label>)
        expect(markup).toContain(`<${as} `)
        expect(markup).toContain(`>Session setup</${as}>`)
        expect(markup).toContain("data-grammar-label=\"true\"")
    })
})

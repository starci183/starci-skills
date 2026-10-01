import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Region } from "./index.js"

describe("Core Region", () => {
    it("renders a section landmark named by its label", () => {
        const markup = renderToStaticMarkup(<Region label="Privacy">Body</Region>)

        expect(markup).toContain("<section")
        expect(markup).toContain("aria-label=\"Privacy\"")
        expect(markup).toContain("data-component=\"Region\"")
        expect(markup).toContain("class=\"starci-core-region\"")
        expect(markup).toContain("data-grammar-region-spacing=\"flush\"")
        expect(markup).toContain(">Body</section>")
    })

    it("can be named by its own heading and carry an anchor and room below", () => {
        const markup = renderToStaticMarkup(<Region id="about" labelledBy="about-heading" spacing="spaced"><h2 id="about-heading">About</h2></Region>)

        expect(markup).toContain("id=\"about\"")
        expect(markup).toContain("aria-labelledby=\"about-heading\"")
        expect(markup).toContain("data-grammar-region-spacing=\"spaced\"")
        expect(markup).not.toContain("aria-label=")
    })

    it("keeps an owner class name beside its own", () => {
        const markup = renderToStaticMarkup(<Region label="Privacy" className="owner">Body</Region>)

        expect(markup).toContain("starci-core-region owner")
    })
})

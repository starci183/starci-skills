import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { NavLandmark } from "./index.js"

describe("Core NavLandmark", () => {
    it("renders a nav landmark named by its label", () => {
        const markup = renderToStaticMarkup(<NavLandmark label="Primary" layout="bar"><a href="/a">A</a></NavLandmark>)

        expect(markup).toMatch(/^<nav /)
        expect(markup).toContain("aria-label=\"Primary\"")
        expect(markup).toContain("data-component=\"NavLandmark\"")
        expect(markup).toContain("data-grammar-nav-layout=\"bar\"")
        expect(markup).toContain("class=\"starci-core-nav-landmark\"")
        expect(markup).toContain("<a href=\"/a\">A</a>")
    })

    it("names the scrolling layout", () => {
        const markup = renderToStaticMarkup(<NavLandmark label="Sections" layout="scrolling">x</NavLandmark>)

        expect(markup).toContain("data-grammar-nav-layout=\"scrolling\"")
    })
})

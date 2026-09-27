import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Divider } from "./index.js"

describe("Core Divider", () => {
    it("keeps its visible label inside the accessible separator", () => {
        const markup = renderToStaticMarkup(<Divider label="or" />)

        expect(markup).toContain("data-component=\"Divider\"")
        expect(markup).toContain("role=\"separator\"")
        expect(markup).toContain("aria-label=\"or\"")
        expect(markup).toContain("aria-hidden=\"true\"")
        expect(markup).toContain(">or</span>")
    })

    it("draws an unlabelled hairline that is a horizontal separator by default", () => {
        const markup = renderToStaticMarkup(<Divider />)

        expect(markup).toContain("data-component=\"Divider\"")
        expect(markup).toContain("data-grammar-divider=\"bare\"")
        expect(markup).toContain("role=\"separator\"")
        expect(markup).toContain("aria-orientation=\"horizontal\"")
        expect(markup).toContain("data-contract=\"BOUNDARY-1\"")
        expect(markup).toContain("class=\"starci-core-divider-bare\"")
        expect(markup).not.toContain("aria-label")
        expect(markup).not.toContain("<span")
    })

    it("hides a presentational seam from assistive technology", () => {
        const markup = renderToStaticMarkup(<Divider semantics="presentation" />)

        expect(markup).toContain("role=\"presentation\"")
        expect(markup).toContain("aria-hidden=\"true\"")
        expect(markup).not.toContain("role=\"separator\"")
        expect(markup).toContain("data-grammar-divider-semantics=\"presentation\"")
    })

    it("ships the hairline as a 1px --separator border across its container", () => {
        const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../../common/styles.css"), "utf8")
        expect(css).toMatch(/\.starci-core-divider-bare\s*\{[\s\S]*?width: 100%;[\s\S]*?height: 0;[\s\S]*?margin: 0;[\s\S]*?border-block-start: 1px solid var\(--separator/)
    })
})

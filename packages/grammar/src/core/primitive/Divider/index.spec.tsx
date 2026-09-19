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
})

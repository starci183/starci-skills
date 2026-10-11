// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it } from "vitest"
import { FillViewport } from "./index.js"

afterEach(cleanup)

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)))

describe("FillViewport", () => {
    it("server-renders a full-height fallback with its floor and inset hooks", () => {
        const html = renderToStaticMarkup(<FillViewport minHeight="lg" bottomInset="none"><div>child</div></FillViewport>)
        expect(html).toContain('data-component="FillViewport"')
        expect(html).toContain('data-grammar-fill-min="lg"')
        expect(html).toContain('data-grammar-fill-inset="none"')
        expect(html).not.toContain("role=")
    })

    it("becomes a named region when labelled and measures its top offset on the client", async () => {
        render(<FillViewport label="Conversation"><div>child</div></FillViewport>)
        const region = screen.getByRole("region", { name: "Conversation" })
        await nextFrame()
        await nextFrame()
        expect(region.style.getPropertyValue("--starci-core-fill-top")).toMatch(/^\d+px$/)
    })
})

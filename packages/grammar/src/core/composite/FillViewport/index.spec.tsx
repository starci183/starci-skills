// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it } from "vitest"
import { FillViewport, bottomChromeHeight } from "./index.js"

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
        expect(region.style.getPropertyValue("--starci-core-fill-bottom")).toBe("0px")
    })

    it("counts visible Grammar bottom chrome pinned in the lower half", () => {
        const bar = document.createElement("nav")
        bar.setAttribute("data-grammar-bottom-chrome", "true")
        bar.style.position = "fixed"
        bar.getBoundingClientRect = () => ({ top: window.innerHeight - 64, height: 64, bottom: window.innerHeight, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) })
        document.body.append(bar)
        expect(bottomChromeHeight()).toBe(64)
        bar.style.position = "static"
        expect(bottomChromeHeight()).toBe(0)
        bar.remove()
    })
})

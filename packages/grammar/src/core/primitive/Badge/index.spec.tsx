// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Badge } from "./index.js"

describe("Core Badge", () => {
    it("binds semantic tones and app-owned leading content", () => {
        const markup = renderToStaticMarkup(<Badge tone="success" startContent={<i data-glyph />}>Ready</Badge>)

        expect(markup).toContain("data-component=\"Badge\"")
        expect(markup).toContain("data-tone=\"success\"")
        expect(markup).toContain("data-glyph=\"true\"")
        expect(markup).toContain("Ready")
    })

    it("keeps unresolved chip geometry inert", () => {
        const markup = renderToStaticMarkup(<Badge tone="danger" startContent={<i data-glyph />} isSkeleton>Failed</Badge>)

        expect(markup).toContain("data-loading=\"true\"")
        expect(markup).toContain("aria-hidden=\"true\"")
        expect(markup).toContain("text-transparent")
        expect(markup).not.toContain("data-glyph")
    })
    it("draws one leading aria-hidden 6px CircleFill dot in the tone colour when isDot", () => {
        const host = document.createElement("div")
        host.innerHTML = renderToStaticMarkup(<Badge tone="success" isDot>Online</Badge>)
        const badge = host.querySelector("[data-component=\"Badge\"]")!
        const dots = badge.querySelectorAll("svg.starci-core-badge-dot")

        expect(badge.getAttribute("data-grammar-badge-dot")).toBe("true")
        expect(dots).toHaveLength(1)
        const dot = dots[0]!
        expect(dot.getAttribute("aria-hidden")).toBe("true")
        expect(dot.getAttribute("width")).toBe("6")
        expect(dot.getAttribute("height")).toBe("6")
        expect(dot.getAttribute("fill")).toBe("currentColor")
        expect(dot.querySelectorAll("circle")).toHaveLength(1)
        expect(badge.firstElementChild).toBe(dot)
        expect(badge.textContent).toBe("Online")
    })

    it("draws no dot when isDot is false or omitted, or while skeleton", () => {
        for (const markup of [
            renderToStaticMarkup(<Badge tone="danger">Down</Badge>),
            renderToStaticMarkup(<Badge tone="danger" isDot={false}>Down</Badge>),
            renderToStaticMarkup(<Badge tone="danger" isDot isSkeleton>Down</Badge>),
        ]) {
            expect(markup).not.toContain("starci-core-badge-dot")
            expect(markup).not.toContain("data-grammar-badge-dot")
        }
    })
})

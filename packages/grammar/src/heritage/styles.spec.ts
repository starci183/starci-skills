import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const css = readFileSync(resolve(process.cwd(), "src/heritage/styles.css"), "utf8")
const commonRendererSource = [
    "src/core/branch/SurfaceCard/index.tsx",
    "src/core/branch/SurfaceListCard/index.tsx",
].map((path) => readFileSync(resolve(process.cwd(), path), "utf8")).join("\n")

describe("Heritage family CSS", () => {
    it("imports Common and scopes every concrete family selector", () => {
        expect(css).toContain("@import \"../common/styles.css\"")
        const selectorLines = css
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.startsWith(".grammar-common-root") && line.endsWith("{"))

        expect(selectorLines.length).toBeGreaterThan(10)
        for (const selector of selectorLines) {
            expect(selector).toContain("[data-grammar-family=\"heritage\"]")
        }
    })

    it("binds Common semantic variables without importing or overriding Core DNA", () => {
        expect(css).toContain("--accent: var(--heritage-green-700)")
        expect(css).toContain("--field-radius: 0")
        expect(css).toContain("--shadow-surface:")
        expect(css).not.toContain("--starci-core-")
        expect(css).not.toContain("@import \"../core/styles.css\"")
    })

    it("uses emitted Common surface hooks and invariant spacing for family anatomy", () => {
        for (const hook of [
            "data-grammar-surface-card",
            "data-grammar-frame",
            "data-grammar-surface-label",
        ]) {
            expect(commonRendererSource).toContain(hook)
            expect(css).toContain(`[${hook}`)
        }

        expect(css).toContain("gap: var(--grammar-row-gap)")
        expect(css).toContain("gap: 0.125rem")
        expect(css).not.toMatch(/gap:\s*\.(?:1|8)rem/)
    })

    it("keeps the Common SurfaceCard label outside the Heritage material boundary", () => {
        expect(css).toMatch(
            /\[data-grammar-surface-card\]\[data-slot="card"\]\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/,
        )
        expect(css).toMatch(
            /\[data-grammar-surface-card\]\[data-slot="card"\]\s+\[data-grammar-frame="bounded"\]\[data-slot="card-content"\][^{]*\{[^}]*border:[^}]*background:\s*var\(--surface\);[^}]*box-shadow:\s*var\(--shadow-surface\);/,
        )
        expect(commonRendererSource).toContain("<Card.Root")
        expect(commonRendererSource).toContain("<Card.Header")
        expect(commonRendererSource).toContain("<Card.Content")
        expect(css).not.toMatch(
            /\[data-grammar-surface-label\][^{]*\{[^}]*(?:background|border|box-shadow):/,
        )
    })

    it("owns dark, system, and forced-color material without domain vocabulary", () => {
        expect(css).toContain("[data-grammar-theme=\"dark\"]")
        expect(css).toContain("@media (prefers-color-scheme: dark)")
        expect(css).toContain("@media (forced-colors: active)")
        expect(css).not.toContain("Tayson")
        expect(css).not.toContain("PublicSiteHeader")
    })
})

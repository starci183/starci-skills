import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const css = readFileSync(resolve(process.cwd(), "src/offset-pop/styles.css"), "utf8")
const rendererSource = [
    "src/core/primitive/Badge/index.tsx",
    "src/core/primitive/Button/index.tsx",
    "src/core/primitive/Heading/index.tsx",
    "src/core/primitive/Text/index.tsx",
    "src/core/branch/SurfaceCard/index.tsx",
    "src/core/branch/SurfaceListCard/index.tsx",
    "src/core/branch/Rail/index.tsx",
    "src/core/composite/StaticStateRow/index.tsx",
    "src/core/composition/NavigationFeatureNav/index.tsx",
    "src/core/StateMark.tsx",
].map((path) => readFileSync(resolve(process.cwd(), path), "utf8")).join("\n")

describe("Offset Pop family CSS", () => {
    it("imports Common, uses the formal family scope, and never imports Core", () => {
        expect(css).toContain("@import \"../common/styles.css\"")
        expect(css).not.toContain("@import \"../core/styles.css\"")

        const selectorLines = css
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.startsWith(".grammar-common-root") && line.endsWith("{"))

        expect(selectorLines.length).toBeGreaterThan(25)
        for (const selector of selectorLines) {
            expect(selector).toContain("[data-grammar-family=\"offset-pop\"]")
        }
    })

    it("targets only hooks emitted by Common public renderers", () => {
        const hooks = Array.from(css.matchAll(/\[(data-component|data-grammar-[a-z-]+)(?:[=\]])/g), (match) => match[1])
        const familyRootHooks = new Set(["data-grammar-family", "data-grammar-theme"])

        expect(hooks.length).toBeGreaterThan(20)
        for (const hook of new Set(hooks)) {
            if (familyRootHooks.has(hook)) continue
            expect(rendererSource, `missing renderer hook: ${hook}`).toContain(hook)
        }

        for (const invented of [
            "data-grammar-dot-field",
            "data-grammar-display",
            "data-grammar-muted",
            "data-grammar-accent",
            "data-grammar-band",
            "data-grammar-emphasis",
            "data-grammar-floating-cluster",
            "data-grammar-floating-item",
        ]) {
            expect(css).not.toContain(invented)
        }
    })

    it("binds semantic Common variables and preserves hard family surface geometry", () => {
        expect(css).toContain("--accent: var(--offset-pop-pink)")
        expect(css).toContain("--field-radius: var(--offset-pop-control-radius)")
        expect(css).toContain("--shadow-surface:")
        expect(css).not.toContain("--starci-core-")
        expect(css).toContain("--offset-pop-shadow-x: 0.25rem")
        expect(css).toContain("--offset-pop-shadow-y: 0.5rem")
        expect(css).toMatch(/data-grammar-surface-depth="top"[\s\S]*?box-shadow: var\(--shadow-surface\)/)
        expect(css).toMatch(/data-grammar-surface-depth="nested"[\s\S]*?box-shadow: none/)
        expect(rendererSource).toContain("<Card.Root")
        expect(rendererSource).toContain("<Card.Header")
        expect(rendererSource).toContain("<Card.Content")
        expect(css).toContain("[data-grammar-surface-card][data-slot=\"card\"]")
        expect(css).toContain("[data-grammar-frame=\"bounded\"][data-slot=\"card-content\"]")
    })

    it("uses invariant spacing for focus, press, responsive, and reduced-motion vectors", () => {
        expect(css).toContain("outline-offset: 0.25rem")
        expect(css).toContain("transform: translate(0.25rem, 0.25rem)")
        expect(css).toContain("@media (max-width: 40rem)")
        expect(css).toContain("@media (prefers-reduced-motion: reduce)")
        expect(css).toContain("--offset-pop-transition: 0ms linear")
    })

    it("owns dark, system, forced-color, and closed state treatments", () => {
        expect(css).toContain("[data-grammar-theme=\"dark\"]")
        expect(css).toContain("@media (prefers-color-scheme: dark)")
        expect(css).toContain("@media (forced-colors: active)")

        for (const state of ["affirmative", "informative", "cautionary", "negative", "pending", "unavailable"]) {
            expect(css).toContain(`data-grammar-state="${state}"`)
        }
    })

    it("contains no domain vocabulary", () => {
        const forbidden = ["price", "checkout", "enrollment", "student", "exam", "course", "entitlement"]
        for (const word of forbidden) expect(css.toLowerCase()).not.toContain(word)
    })
})

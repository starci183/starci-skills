import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8")

describe("Common renderer anatomy CSS", () => {
    it("is complete without importing a visual family", () => {
        expect(css).not.toMatch(/@import\s+["']\.\.\/core/)
        for (const selector of [
            ".starci-core-page-container",
            ".starci-core-surface-card",
            ".starci-core-tabs",
            ".starci-core-workspace-shell",
            ".starci-core-chat-workspace",
        ]) expect(css).toContain(selector)
    })

    it("publishes universal geometry without selecting a family palette", () => {
        expect(css).toContain("--grammar-inline-gap: 0.5rem")
        expect(css).toContain("--grammar-page-inset: clamp(1rem, 3vw, 2rem)")
        expect(css).not.toContain("--starci-core-accent: #7547ff")
        expect(css).not.toContain("data-grammar-family=\"core\"")
    })

    /**
     * A TextAction is a BUTTON however text-shaped it looks, so the family's 44px pressable floor is
     * the recipe's, not one appearance's. `route` already carried it, with the reasoning written
     * beside it: `min-block-size` rather than `padding-block`, because these appearances draw no
     * background at rest, so the block size is invisible chrome around unchanged typography. This
     * pins the floor on the recipe so the padding-less appearances - inline, muted, disclosure,
     * plain - cannot ship a 20px target again.
     */
    it("publishes the family pressable floor on the text-action recipe", () => {
        const recipe = css.slice(css.indexOf(".starci-core-text-action {"))
        const block = recipe.slice(0, recipe.indexOf("}") + 1)
        expect(block).toContain("min-block-size: var(--starci-core-control-min-size, 2.75rem)")
    })
})

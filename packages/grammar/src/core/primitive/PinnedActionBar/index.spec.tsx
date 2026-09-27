// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it } from "vitest"
import { GRAMMAR_ROOT_CASES, expectInFamilyScope } from "../../../__test__/grammarRoots.js"
import { Button } from "../Button/index.js"
import { PinnedActionBar } from "./index.js"

afterEach(cleanup)

describe.each(GRAMMAR_ROOT_CASES)("Common PinnedActionBar under $name", ({ Root, family }) => {
    it("is a named group holding the one page command, narrow-only by default", () => {
        render(<Root><PinnedActionBar label="Install a module"><Button variant="primary" width="fill" href="/install">Install</Button></PinnedActionBar></Root>)
        const bar = screen.getByRole("group", { name: "Install a module" })
        expect(bar.getAttribute("data-component")).toBe("PinnedActionBar")
        expect(bar.getAttribute("data-tier")).toBe("atom")
        expect(bar.getAttribute("data-grammar-pinned-visibility")).toBe("narrow")
        expect(bar.getAttribute("data-contract")).toBe("BOUNDARY-1")
        expect(bar.classList.contains("starci-core-pinned-action-bar")).toBe(true)
        expect(screen.getByRole("link", { name: "Install" })).toBeTruthy()
        // A command bar, never a navigation landmark (that is BottomNav).
        expect(screen.queryByRole("navigation")).toBeNull()
        expectInFamilyScope(bar, family)
    })

    it("can be kept at every width", () => {
        render(<Root><PinnedActionBar label="Save" visibility="always"><Button variant="primary" width="fill" onPress={() => undefined}>Save</Button></PinnedActionBar></Root>)
        expect(screen.getByRole("group", { name: "Save" }).getAttribute("data-grammar-pinned-visibility")).toBe("always")
    })
})

describe("PinnedActionBar geometry is shipped", () => {
    const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../../common/styles.css"), "utf8")

    it("sticks to the bottom edge on the surface behind a top hairline, clear of the safe area", () => {
        expect(css).toMatch(/\.starci-core-pinned-action-bar\s*\{[\s\S]*?position: sticky;[\s\S]*?inset-block-end: 0;[\s\S]*?padding: 0\.75rem 1rem calc\(1rem \+ env\(safe-area-inset-bottom, 0px\)\);[\s\S]*?border-block-start: 1px solid var\(--separator[\s\S]*?background: var\(--surface/)
    })

    it("hides the narrow bar at 48rem and wider", () => {
        expect(css).toMatch(/@media \(min-width: 48rem\)\s*\{\s*\.starci-core-pinned-action-bar\[data-grammar-pinned-visibility="narrow"\]\s*\{\s*display: none;/)
    })
})

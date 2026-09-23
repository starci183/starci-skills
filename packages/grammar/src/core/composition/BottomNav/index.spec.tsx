// @vitest-environment jsdom
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FAMILY_WRAPS, expectedFamilyScope } from "../../../__test__/grammarRoots.js"
import { BottomNav } from "./index.js"

afterEach(cleanup)

const glyph = <svg aria-hidden="true" />
const items = [
    { id: "home", label: "Home", icon: glyph, href: "/" },
    { id: "search", label: "Search", icon: glyph, href: "/search" },
    { id: "inbox", label: "Inbox", icon: glyph, href: "/inbox", badge: "3", badgeLabel: "3 unread" },
    { id: "me", label: "Me", icon: glyph, href: "/me", isDisabled: true },
]

describe.each(FAMILY_WRAPS)("BottomNav under %s", (family, wrap) => {
    it("is a named navigation landmark whose current destination carries aria-current", () => {
        render(wrap(<BottomNav label="Primary" items={items} currentId="search" />))
        expect(screen.getByTestId("grammar-root").getAttribute("data-grammar-family")).toBe(expectedFamilyScope(family))
        const nav = screen.getByRole("navigation", { name: "Primary" })
        expect(nav.getAttribute("data-component")).toBe("BottomNav")
        expect(nav.getAttribute("data-grammar-bottom-nav-position")).toBe("fixed")
        expect(nav.getAttribute("data-grammar-bottom-nav-visibility")).toBe("compact")
        expect(nav.style.getPropertyValue("--starci-core-bottom-nav-count")).toBe("4")
        expect(within(nav).getAllByRole("listitem")).toHaveLength(4)
        const current = screen.getByRole("link", { name: "Search" })
        expect(current.getAttribute("aria-current")).toBe("page")
        expect(current.getAttribute("data-grammar-current")).toBe("true")
        expect(screen.getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBeNull()
        expect(screen.getByRole("link", { name: "Inbox, 3 unread" }).querySelector("[data-grammar-bottom-nav-badge]")?.textContent).toBe("3")
        expect((screen.getByRole("button", { name: "Me" }) as HTMLButtonElement).disabled).toBe(true)
    })

    it("moves focus with the arrow keys, wraps, and skips disabled items", () => {
        render(wrap(<BottomNav label="Primary" items={items} currentId="home" />))
        const home = screen.getByRole("link", { name: "Home" })
        home.focus()
        fireEvent.keyDown(home, { key: "ArrowRight" })
        expect(document.activeElement).toBe(screen.getByRole("link", { name: "Search" }))
        fireEvent.keyDown(document.activeElement!, { key: "End" })
        expect(document.activeElement).toBe(screen.getByRole("link", { name: "Inbox, 3 unread" }))
        fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" })
        expect(document.activeElement).toBe(home)
        fireEvent.keyDown(home, { key: "ArrowLeft" })
        expect(document.activeElement).toBe(screen.getByRole("link", { name: "Inbox, 3 unread" }))
    })

    it("drives same-document tabs through onSelect", () => {
        const onSelect = vi.fn()
        const Controlled = () => {
            const [current, setCurrent] = useState("a")
            return <BottomNav label="Views" position="static" visibility="always" currentId={current}
                onSelect={(id) => { setCurrent(id); onSelect(id) }}
                items={[{ id: "a", label: "Alpha", icon: glyph }, { id: "b", label: "Beta", icon: glyph }]} />
        }
        render(wrap(<Controlled />))
        fireEvent.click(screen.getByRole("button", { name: "Beta" }))
        expect(onSelect).toHaveBeenCalledWith("b")
        expect(screen.getByRole("button", { name: "Beta" }).getAttribute("aria-current")).toBe("page")
        expect(screen.getByRole("navigation").getAttribute("data-grammar-bottom-nav-position")).toBe("static")
    })
})

/*
 * The fixed bar reserves its own space. jsdom has no layout, so the geometry at 360px is proven by
 * the `Compositions/Pages › Fixed BottomNav layout (360px)` story's play function (every family,
 * in Chromium); these checks pin the shipped rules that geometry depends on.
 */
describe("fixed BottomNav offset", () => {
    const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8")
    const common = read("src/common/components-navigation.css")
    const offsetPop = read("src/offset-pop/components-navigation.css")
    const rem = (value: string) => Number(value.replace("rem", ""))

    it("publishes the offset on the GrammarRoot only while a fixed bar is drawn, including the safe area", () => {
        expect(common).toMatch(/\.grammar-common-root:has\(\.starci-core-bottom-nav\[data-grammar-bottom-nav-position="fixed"\]\[data-grammar-bottom-nav-visibility="always"\]\) \{\s*--starci-core-bottom-nav-offset: calc\(var\(--starci-core-bottom-nav-block-size\) \+ env\(safe-area-inset-bottom, 0px\)\);/)
        expect(common).toMatch(/@media \(max-width: 47\.99rem\) \{\s*\.grammar-common-root:has\(\.starci-core-bottom-nav\[data-grammar-bottom-nav-position="fixed"\]\[data-grammar-bottom-nav-visibility="compact"\]\)/)
        expect(common).toMatch(/\.grammar-common-root:has\(\.starci-core-bottom-nav\[data-grammar-bottom-nav-position="fixed"\]\) \{\s*--starci-core-bottom-nav-offset: 0px;/)
    })

    it("pads the outermost page container, or the page Footer, by the offset", () => {
        expect(common).toMatch(/:not\(:has\(\.starci-core-footer\)\) :is\(\.starci-core-workspace-shell, \.starci-core-primary-rail-layout, \.starci-core-page-container\):not\([^)]*\) \*\) \{\s*padding-block-end: var\(--starci-core-bottom-nav-offset\);/)
        expect(common).toMatch(/\.starci-core-footer \{\s*padding-block-end: calc\(var\(--grammar-section-gap, 1rem\) \+ max\(var\(--starci-core-bottom-nav-offset\), env\(safe-area-inset-bottom, 0px\)\)\);/)
    })

    it("lifts a bottom-placed Toaster above the bar", () => {
        expect(common).toMatch(/\.starci-core-toaster:is\(\[data-placement="bottom-start"\], \[data-placement="bottom"\], \[data-placement="bottom-end"\]\) \{\s*bottom: max\(var\(--grammar-page-inset, 1rem\), env\(safe-area-inset-bottom, 0px\), calc\(var\(--starci-core-bottom-nav-offset\) \+ var\(--grammar-page-inset, 1rem\)\)\);/)
    })

    it("sizes the offset to the bar each family actually draws at 360px", () => {
        // Common: 0.25rem list inset top and bottom + 3.5rem item + 1px top rule.
        expect(common).toMatch(/--starci-core-bottom-nav-block-size: calc\(4rem \+ 1px\);/)
        expect(common).toMatch(/\.starci-core-bottom-nav-list \{[^}]*padding: 0\.25rem;/)
        expect(common).toMatch(/\.starci-core-bottom-nav-item \{[^}]*min-block-size: 3\.5rem;/)
        // Offset Pop's dock: 4rem items + the same list inset + a 1.5x ink rule + the raised shadow above it.
        const item = offsetPop.match(/\[data-component="BottomNav"\] \[data-grammar-bottom-nav-item\] \{[^}]*min-block-size: ([\d.]+rem);/)
        expect(item?.[1]).toBeDefined()
        const size = offsetPop.match(/--starci-core-bottom-nav-block-size: calc\(([\d.]+rem) \+ var\(--offset-pop-outline-width\) \* 1\.5 \+ var\(--offset-pop-shadow-y\) \* 0\.5\);/)
        expect(size?.[1]).toBeDefined()
        expect(rem(size![1]!)).toBeGreaterThanOrEqual(rem(item![1]!) + 0.5)
    })
})

describe.each(FAMILY_WRAPS)("fixed BottomNav in the %s root", (family, wrap) => {
    it("stays a fixed bar inside the root that publishes its offset", () => {
        render(wrap(<BottomNav label="Primary" items={items} currentId="home" />))
        const nav = screen.getByRole("navigation", { name: "Primary" })
        expect(nav.getAttribute("data-grammar-bottom-nav-position")).toBe("fixed")
        expect(nav.closest(".grammar-common-root")?.getAttribute("data-grammar-family") ?? null).toBe(expectedFamilyScope(family))
    })
})

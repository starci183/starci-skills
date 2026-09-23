// @vitest-environment jsdom
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

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FAMILY_ROOTS, expectedFamilyScope } from "../../../__test__/navigationFamilies.js"
import { TopBar } from "./index.js"

afterEach(cleanup)

const navigation = <nav aria-label="Primary"><a href="/a">A</a><a href="/b" aria-current="page">B</a></nav>

describe.each(FAMILY_ROOTS)("TopBar under %s", (family, wrap) => {
    it("is the banner landmark with brand, navigation and action slots", () => {
        render(wrap(<TopBar brand={<a href="/">Brand</a>} navigation={navigation} actions={<button type="button">Search</button>} />))
        expect(screen.getByTestId("grammar-root").getAttribute("data-grammar-family")).toBe(expectedFamilyScope(family))
        const banner = screen.getByRole("banner")
        expect(banner.getAttribute("data-component")).toBe("TopBar")
        expect(banner.getAttribute("data-grammar-top-bar-position")).toBe("sticky")
        expect(banner.getAttribute("data-grammar-top-bar-menu")).toBe("none")
        expect(within(banner).getByRole("link", { name: "Brand" }).closest("[data-grammar-top-bar-brand]")).not.toBeNull()
        expect(within(banner).getByRole("navigation", { name: "Primary" }).closest("[data-grammar-top-bar-navigation]")).not.toBeNull()
        expect(within(banner).getByRole("button", { name: "Search" }).closest("[data-grammar-top-bar-actions]")).not.toBeNull()
        expect(banner.querySelector("[data-grammar-top-bar-trigger]")).toBeNull()
    })

    it("toggles the mobile menu trigger with aria-expanded, aria-controls and swapped labels", () => {
        const onOpenChange = vi.fn()
        const Controlled = () => {
            const [open, setOpen] = useState(false)
            return <TopBar brand="Brand" navigation={navigation} position="static" menu={{
                icon: <svg aria-hidden="true" />, openLabel: "Open menu", closeLabel: "Close menu", isOpen: open,
                onOpenChange: (next) => { setOpen(next); onOpenChange(next) }, controls: "app-drawer",
            }} />
        }
        render(wrap(<Controlled />))
        const banner = screen.getByRole("banner")
        expect(banner.getAttribute("data-grammar-top-bar-menu")).toBe("compact")
        expect(banner.getAttribute("data-grammar-top-bar-position")).toBe("static")
        const trigger = screen.getByRole("button", { name: "Open menu" })
        expect(trigger.getAttribute("aria-expanded")).toBe("false")
        expect(trigger.getAttribute("aria-controls")).toBe("app-drawer")
        fireEvent.click(trigger)
        expect(onOpenChange).toHaveBeenLastCalledWith(true)
        const close = screen.getByRole("button", { name: "Close menu" })
        expect(close.getAttribute("aria-expanded")).toBe("true")
        close.focus()
        fireEvent.keyDown(close, { key: "Enter" })
        fireEvent.keyUp(close, { key: "Enter" })
        expect(screen.getByRole("button", { name: "Open menu" }).getAttribute("aria-expanded")).toBe("false")
    })

    it("can keep the trigger at every width", () => {
        render(wrap(<TopBar brand="Brand" menu={{ icon: null, openLabel: "Menu", closeLabel: "Close", isOpen: false, onOpenChange: () => {}, visibility: "always" }} />))
        expect(screen.getByRole("banner").getAttribute("data-grammar-top-bar-menu")).toBe("always")
    })
})

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FAMILY_ROOTS, expectedFamilyScope } from "../../../__test__/navigationFamilies.js"
import { Link } from "./index.js"

afterEach(cleanup)

describe.each(FAMILY_ROOTS)("Link under %s", (family, wrap) => {
    it("renders a real internal anchor with kind, visited and current hooks", () => {
        render(wrap(<Link href="/docs">Docs</Link>))
        expect(screen.getByTestId("grammar-root").getAttribute("data-grammar-family")).toBe(expectedFamilyScope(family))
        const link = screen.getByRole("link", { name: "Docs" })
        expect(link.tagName).toBe("A")
        expect(link.getAttribute("href")).toBe("/docs")
        expect(link.getAttribute("data-component")).toBe("Link")
        expect(link.getAttribute("data-grammar-link-kind")).toBe("internal")
        expect(link.getAttribute("data-grammar-link-visited")).toBe("distinct")
        expect(link.getAttribute("data-grammar-current")).toBe("false")
        expect(link.getAttribute("aria-current")).toBeNull()
        expect(link.getAttribute("target")).toBeNull()
    })

    it("marks the current destination with aria-current=page", () => {
        render(wrap(<Link href="/settings" isCurrent visited="uniform">Settings</Link>))
        const link = screen.getByRole("link", { name: "Settings" })
        expect(link.getAttribute("aria-current")).toBe("page")
        expect(link.getAttribute("data-grammar-current")).toBe("true")
        expect(link.getAttribute("data-grammar-link-visited")).toBe("uniform")
    })

    it("opens external destinations safely and announces the app-owned hint", () => {
        render(wrap(<Link href="https://example.com" kind="external" externalHint="new tab" externalIcon={<svg />}>Example</Link>))
        const link = screen.getByRole("link", { name: /^Example\s*new tab$/ })
        expect(link.getAttribute("target")).toBe("_blank")
        expect(link.getAttribute("rel")).toBe("noopener noreferrer")
        expect(link.getAttribute("data-grammar-link-kind")).toBe("external")
        expect(link.querySelector("[data-grammar-link-external-icon]")?.getAttribute("aria-hidden")).toBe("true")
    })

    it("follows with the keyboard and reports onFollow", () => {
        const onFollow = vi.fn()
        render(wrap(<Link href="#section" onFollow={onFollow}>Section</Link>))
        const link = screen.getByRole("link", { name: "Section" })
        link.focus()
        expect(document.activeElement).toBe(link)
        fireEvent.click(link)
        expect(onFollow).toHaveBeenCalledTimes(1)
    })

    it("withholds the destination while disabled", () => {
        render(wrap(<Link href="/locked" isDisabled>Locked</Link>))
        const node = screen.getByText("Locked").closest("[data-component='Link']")
        expect(node?.getAttribute("href")).toBeNull()
        expect(node?.getAttribute("aria-disabled")).toBe("true")
    })
})

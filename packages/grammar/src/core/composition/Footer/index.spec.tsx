// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { FAMILY_WRAPS, expectedFamilyScope } from "../../../__test__/grammarRoots.js"
import { Footer } from "./index.js"

afterEach(cleanup)

const groups = [
    { id: "product", label: "Product", links: [{ id: "pricing", label: "Pricing", href: "/pricing", isCurrent: true }, { id: "docs", label: "Docs", href: "/docs" }] },
    { id: "company", label: "Company", links: [{ id: "blog", label: "Blog", href: "https://example.com/blog", kind: "external" as const }] },
]

describe.each(FAMILY_WRAPS)("Footer under %s", (family, wrap) => {
    it("is the contentinfo landmark with a named link directory of labelled groups", () => {
        render(wrap(<Footer label="Footer" brand={<span>Brand</span>} groups={groups} legal={<small>Legal</small>} externalHint="opens a new tab" />))
        expect(screen.getByTestId("grammar-root").getAttribute("data-grammar-family")).toBe(expectedFamilyScope(family))
        const footer = screen.getByRole("contentinfo")
        expect(footer.getAttribute("data-component")).toBe("Footer")
        const directory = within(footer).getByRole("navigation", { name: "Footer" })
        expect(within(directory).getByRole("list", { name: "Product" })).not.toBeNull()
        expect(within(directory).getByRole("list", { name: "Company" })).not.toBeNull()
        expect(footer.querySelectorAll("[data-grammar-footer-group]")).toHaveLength(2)
        expect(footer.querySelector("[data-grammar-footer-brand]")?.textContent).toBe("Brand")
        expect(footer.querySelector("[data-grammar-footer-legal]")?.textContent).toBe("Legal")
    })

    it("uses Common links: current page and safe external destinations", () => {
        render(wrap(<Footer label="Footer" groups={groups} externalHint="opens a new tab" />))
        const pricing = screen.getByRole("link", { name: "Pricing" })
        expect(pricing.getAttribute("aria-current")).toBe("page")
        expect(pricing.getAttribute("data-component")).toBe("Link")
        const blog = screen.getByRole("link", { name: /^Blog\s*opens a new tab$/ })
        expect(blog.getAttribute("target")).toBe("_blank")
        expect(blog.getAttribute("rel")).toBe("noopener noreferrer")
    })

    it("renders only the legal row when that is all it has", () => {
        render(wrap(<Footer legal="Legal only" />))
        const footer = screen.getByRole("contentinfo")
        expect(footer.querySelector(".starci-core-footer-main")).toBeNull()
        expect(within(footer).queryByRole("navigation")).toBeNull()
        expect(footer.textContent).toBe("Legal only")
    })
})

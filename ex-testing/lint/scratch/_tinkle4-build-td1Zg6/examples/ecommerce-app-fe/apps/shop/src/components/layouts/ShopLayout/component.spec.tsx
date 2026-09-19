import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { ShopLayoutBase, type ShopLayoutProps } from "./component"

/**
 * The display controls belong to the shared kit (theme plus locale toggles, both needing a
 * dictionary and a theme provider). What this chrome owns is the nav: which routes exist, which one
 * the reader is on, and where the body lands - so the toggles stand in as one labelled landmark.
 */
vi.mock("@fe-kit/theme/leaves/DisplayControls", () => ({
    DisplayControls: () => <span aria-label="Display controls" />,
}))

const Body = () => <p>The routed shop screen</p>

const ready: ShopLayoutProps = {
    state: "ready",
    props: {
        theme: "light",
        brand: "Northwind shop",
        navLabel: "Shop sections",
        homeHref: "/en",
        links: [
            { href: "/en/browse", label: "Browse", isCurrent: false },
            { href: "/en/cart", label: "Cart", isCurrent: true },
            { href: "/en/account", label: "Account", isCurrent: false },
        ],
    },
    on: {},
    body: Body,
}

describe("ShopLayoutBase", () => {
    it("every section the record lists is offered, on its locale-prefixed route", () => {
        render(<ShopLayoutBase {...ready} />)

        const nav = screen.getByRole("navigation", { name: "Shop sections" })
        expect(nav).toBeInTheDocument()
        expect(screen.getByRole("link", { name: "Browse" })).toHaveAttribute("href", "/en/browse")
        expect(screen.getByRole("link", { name: "Cart" })).toHaveAttribute("href", "/en/cart")
        expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute("href", "/en/account")
    })

    it("only the section the reader stands in is marked current", () => {
        render(<ShopLayoutBase {...ready} />)

        expect(screen.getByRole("link", { name: "Cart" })).toHaveAttribute("aria-current", "page")
        expect(screen.getByRole("link", { name: "Browse" })).not.toHaveAttribute("aria-current")
        expect(screen.getByRole("link", { name: "Account" })).not.toHaveAttribute("aria-current")
    })

    it("the wordmark hands the reader back to the storefront", () => {
        render(<ShopLayoutBase {...ready} />)

        expect(screen.getByRole("link", { name: "Northwind shop" })).toHaveAttribute("href", "/en")
    })

    it("the routed screen lands in main, beside the controls rather than under them", () => {
        render(<ShopLayoutBase {...ready} />)

        expect(screen.getByRole("main")).toHaveTextContent("The routed shop screen")
    })

    it("an empty nav still frames the page: no links, but the wordmark, the landmark and the body", () => {
        render(<ShopLayoutBase {...ready} props={{ ...ready.props, links: [] }} />)

        expect(screen.getAllByRole("link")).toHaveLength(1)
        expect(screen.getByRole("navigation", { name: "Shop sections" })).toBeInTheDocument()
        expect(screen.getByRole("main")).toHaveTextContent("The routed shop screen")
    })
})

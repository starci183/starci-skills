import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { SiteLayoutBase, type SiteLayoutProps } from "./component"

/**
 * The display controls are the reader's theme and language toggles, owned by the shared kit and
 * needing both a dictionary and a theme provider. The chrome's own contract is where the wordmark,
 * the section links and the hand-off go, so the toggles stand in as one labelled landmark here.
 */
vi.mock("@fe-kit/theme/leaves/DisplayControls", () => ({
    DisplayControls: () => <span aria-label="Display controls" />,
}))

const Body = () => <p>The routed landing page</p>

const ready: SiteLayoutProps = {
    state: "ready",
    props: {
        theme: "system",
        brand: "Northwind",
        navLabel: "Sections of the storefront",
        catalogue: "Curated picks",
        about: "Why Northwind",
        enterShop: "Enter the shop",
        tagline: "Gear that lasts.",
        shopCta: "Shop the full catalogue",
        homeHref: "/en",
        catalogueHref: "#catalogue",
        aboutHref: "#about",
        shopHref: "http://shop.test/en",
    },
    on: {},
    body: Body,
}

describe("SiteLayoutBase", () => {
    it("the wordmark is the way home", () => {
        render(<SiteLayoutBase {...ready} />)

        expect(screen.getByRole("link", { name: "Northwind" })).toHaveAttribute("href", "/en")
    })

    it("the bar is a named landmark whose two section links point at the regions on the page", () => {
        render(<SiteLayoutBase {...ready} />)

        const sections = screen.getByRole("navigation", { name: "Sections of the storefront" })
        expect(sections).toBeInTheDocument()
        expect(screen.getByRole("link", { name: "Curated picks" })).toHaveAttribute("href", "#catalogue")
        expect(screen.getByRole("link", { name: "Why Northwind" })).toHaveAttribute("href", "#about")
    })

    it("the hand-off to the shop origin is offered twice, from the top bar and from the footer", () => {
        render(<SiteLayoutBase {...ready} />)

        expect(screen.getByRole("link", { name: "Enter the shop" })).toHaveAttribute("href", "http://shop.test/en")
        expect(screen.getByRole("link", { name: "Shop the full catalogue" })).toHaveAttribute("href", "http://shop.test/en")
        expect(screen.getByText("Gear that lasts.")).toBeInTheDocument()
    })

    it("the routed page is placed in the document's main region, never inside the chrome's own bar", () => {
        render(<SiteLayoutBase {...ready} />)

        expect(screen.getByRole("main")).toHaveTextContent("The routed landing page")
    })
})

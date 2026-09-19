import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import type { Product } from "../../../data/catalog"
import { LandingPageBase, type LandingPageProps } from "./component"

const teaser: ReadonlyArray<Product> = [
    {
        id: "aurelis-desk-lamp",
        name: "Aurelis Desk Lamp",
        blurb: "Warm, dimmable light with a weighted brass base.",
        priceCents: 8900,
        currency: "USD",
    },
    {
        id: "solstice-notebook",
        name: "Solstice Notebook",
        blurb: "Lay-flat binding, 120gsm pages, dot grid.",
        priceCents: 2400,
        currency: "USD",
    },
]

/** The resolved fixture the connected half hands down: every string and link already settled. */
const ready: LandingPageProps = {
    state: "ready",
    props: {
        heroTitle: "Northwind",
        heroLede: "Gear that lasts longer than the trend that sold it.",
        startShopping: "Start shopping",
        seePicks: "See the picks",
        catalogueTitle: "Curated picks",
        catalogueDescription: "The three we would keep ourselves.",
        viewFull: "View the full catalogue",
        pillarsTitle: "Why Northwind",
        pillars: [
            { title: "Repairable", copy: "Spare parts for ten years, listed with the product." },
            { title: "One price", copy: "The same number for everyone, no surge." },
        ],
        teaser,
        shopHref: "http://shop.test/en",
    },
    on: {},
}

describe("LandingPageBase", () => {
    it("welcome hero: the display line, the lede, and both doors the landing offers", () => {
        render(<LandingPageBase {...ready} />)

        expect(screen.getByRole("heading", { level: 1, name: "Northwind" })).toBeInTheDocument()
        expect(screen.getByText("Gear that lasts longer than the trend that sold it.")).toBeInTheDocument()
        expect(screen.getByRole("link", { name: "Start shopping" })).toHaveAttribute("href", "http://shop.test/en")
        expect(screen.getByRole("link", { name: "See the picks" })).toHaveAttribute("href", "#catalogue")
    })

    it("the welcome surface is the mascot's, and it is decoration, not a statement", () => {
        const { container } = render(<LandingPageBase {...ready} />)

        const mark = container.querySelector("svg")
        expect(mark).not.toBeNull()
        expect(mark).toHaveAttribute("aria-hidden", "true")
    })

    it("teaser: every curated row becomes a tile whose price is the formatted amount, never the minor units", () => {
        const { container } = render(<LandingPageBase {...ready} />)
        const picks = screen.getByRole("region", { name: "Curated picks" })

        expect(screen.getByRole("heading", { level: 3, name: "Aurelis Desk Lamp" })).toBeInTheDocument()
        expect(screen.getByRole("heading", { level: 3, name: "Solstice Notebook" })).toBeInTheDocument()
        expect(within(picks).getByText("$89.00")).toBeInTheDocument()
        expect(within(picks).getByText("$24.00")).toBeInTheDocument()
        expect(container.textContent).not.toContain("8900")
    })

    it("teaser: an empty curation still holds the section, so the page reads as chosen, not broken", () => {
        render(<LandingPageBase {...ready} props={{ ...ready.props, teaser: [] }} />)

        expect(screen.getByRole("region", { name: "Curated picks" })).toBeInTheDocument()
        expect(screen.queryByRole("heading", { level: 3, name: "Aurelis Desk Lamp" })).not.toBeInTheDocument()
    })

    it("pillars: each one is a card carrying its own sentence", () => {
        render(<LandingPageBase {...ready} />)

        expect(screen.getByRole("heading", { level: 2, name: "Why Northwind" })).toBeInTheDocument()
        expect(screen.getByRole("heading", { level: 3, name: "Repairable" })).toBeInTheDocument()
        expect(screen.getByText("Spare parts for ten years, listed with the product.")).toBeInTheDocument()
        expect(screen.getByText("The same number for everyone, no surge.")).toBeInTheDocument()
    })

    it("the hand-off to the shop is repeated from the foot of the picks, on the same locale-joined origin", () => {
        render(<LandingPageBase {...ready} />)

        expect(screen.getByRole("link", { name: "View the full catalogue" })).toHaveAttribute("href", "http://shop.test/en")
    })
})

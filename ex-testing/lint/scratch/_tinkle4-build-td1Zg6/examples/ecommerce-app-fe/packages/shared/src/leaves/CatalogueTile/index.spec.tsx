import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { CatalogueTile } from "./index"

const lamp = {
    name: "Aurelis Desk Lamp",
    price: "$89.00",
    blurb: "Warm, dimmable light with a weighted brass base.",
}

describe("CatalogueTile", () => {
    it("carries the name as the card label and the already-formatted amount as the label-row fact", () => {
        render(<CatalogueTile {...lamp} />)

        const label = screen.getByRole("heading", { level: 3, name: lamp.name })
        expect(label).toHaveTextContent(lamp.name)
        expect(label.parentElement).toHaveTextContent(lamp.price)
    })

    it("shows the editorial line only when the row actually has one", () => {
        const { rerender } = render(<CatalogueTile {...lamp} />)
        expect(screen.getByText(lamp.blurb)).toBeInTheDocument()

        rerender(<CatalogueTile name={lamp.name} price={lamp.price} />)
        expect(screen.queryByText(lamp.blurb)).not.toBeInTheDocument()
    })

    it("renders the URL the service served, untouched", () => {
        const { container } = render(<CatalogueTile {...lamp} imageUrl="https://cdn.test/lamp.png" />)

        const image = container.querySelector("img")
        expect(image).not.toBeNull()
        expect(image).toHaveAttribute("src", "https://cdn.test/lamp.png")
        expect(screen.queryByText("A")).not.toBeInTheDocument()
    })

    it("draws the neutral initial-letter tile instead of a broken image when the row ships none", () => {
        const { container } = render(<CatalogueTile {...lamp} />)

        expect(container.querySelector("img")).toBeNull()
        const initial = screen.getByText("A")
        expect(initial).toHaveAttribute("aria-hidden", "true")
    })

    it("lifts the first letter of the name rather than any letter, so two rows never share a glyph by accident", () => {
        render(<CatalogueTile name="meridian carry tote" price="$145.00" />)

        expect(screen.getByText("M")).toBeInTheDocument()
    })
})

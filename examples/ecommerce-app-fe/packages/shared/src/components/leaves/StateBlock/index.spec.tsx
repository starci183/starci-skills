import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { Button } from "@starci/grammar/common"
import { StateBlock } from "./index"

describe("StateBlock", () => {
    it("names what is missing and why, so a gated route never reads as a silent blank", () => {
        render(<StateBlock title="No orders yet" description="Orders appear once an order is placed." />)

        expect(screen.getByText("No orders yet")).toBeInTheDocument()
        expect(screen.getByText("Orders appear once an order is placed.")).toBeInTheDocument()
    })

    it("omits the description line when the surface has no reason to give", () => {
        render(<StateBlock title="Nothing to show" />)

        expect(screen.getByText("Nothing to show")).toBeInTheDocument()
    })

    it("draws the mascot only where the caller marks the surface a genuine empty one", () => {
        const { container, rerender } = render(<StateBlock title="Orders unreachable" description="The order service did not answer." />)
        expect(container.querySelector("svg")).toBeNull()

        rerender(<StateBlock mascot title="No orders yet" description="Nothing ordered so far." />)
        expect(container.querySelector("svg")).not.toBeNull()
    })

    it("keeps the mascot decorative, so the message stays the thing a reader hears", () => {
        const { container } = render(<StateBlock mascot title="No orders yet" />)

        expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
        expect(screen.getByText("No orders yet")).toBeInTheDocument()
    })

    it("places the caller's way out after the notice", () => {
        const { container } = render(
            <StateBlock title="Cart is empty" description="Add something from the catalogue.">
                <Button href="/en/browse" variant="secondary" size="sm">
                    Browse the catalogue
                </Button>
            </StateBlock>
        )

        const door = screen.getByRole("link", { name: "Browse the catalogue" })
        expect(door).toHaveAttribute("href", "/en/browse")
        const spoken = container.textContent ?? ""
        expect(spoken.indexOf("Cart is empty")).toBeLessThan(spoken.indexOf("Browse the catalogue"))
    })
})

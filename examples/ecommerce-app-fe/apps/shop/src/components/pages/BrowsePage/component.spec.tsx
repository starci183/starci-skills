import { describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

vi.mock("../../blocks/AddToCart/actions", () => ({
    addToCart: vi.fn(async () => ({ ok: true as const, quantity: 1 })),
}))

import { addToCart } from "../../blocks/AddToCart/actions"
import type { Product } from "../../../modules/api/catalog"
import { BrowsePageBase, type BrowsePageProps, type BrowsePageState } from "./component"

const rows: ReadonlyArray<Product> = [
    {
        id: "aurelis-desk-lamp",
        name: "Aurelis Desk Lamp",
        priceCents: 8900,
        currency: "USD",
        stock: 12,
        imageUrl: "https://cdn.test/lamp.png",
    },
    {
        id: "solstice-notebook",
        name: "Solstice Notebook",
        priceCents: 2400,
        currency: "USD",
        stock: 3,
    },
]

const words = {
    title: "Catalogue",
    description: "Everything the order service serves today.",
    stockLabel: "{count} in stock",
    addToCart: "Add to cart",
    addingToCart: "Adding…",
    inCartLabel: "In your cart: {count}",
    addRefused: "The order service refused the add.",
    signedOutTitle: "Sign in to browse",
    signedOutDescription: "The catalogue is read through your session.",
    unreachableTitle: "Catalogue unavailable",
    unreachableDescription: "The order service did not answer.",
    emptyTitle: "Nothing on the shelf",
    emptyDescription: "The catalogue answered with no rows.",
}

const surfaceFor = (state: BrowsePageState, products: ReadonlyArray<Product> = rows): BrowsePageProps => ({
    state,
    props: { ...words, products },
    on: {},
})

describe("BrowsePageBase", () => {
    it("ready: every served row becomes a tile, priced in the currency a reader expects", () => {
        const { container } = render(<BrowsePageBase {...surfaceFor("ready")} />)

        expect(screen.getByRole("heading", { level: 1, name: "Catalogue" })).toBeInTheDocument()
        expect(screen.getByRole("heading", { level: 3, name: "Aurelis Desk Lamp" })).toBeInTheDocument()
        expect(screen.getByRole("heading", { level: 3, name: "Solstice Notebook" })).toBeInTheDocument()
        expect(screen.getByText("$89.00")).toBeInTheDocument()
        expect(screen.getByText("$24.00")).toBeInTheDocument()
        expect(container.textContent).not.toContain("8900")
    })

    it("ready: a served image is used as served, and the row without one takes the neutral tile", () => {
        const { container } = render(<BrowsePageBase {...surfaceFor("ready")} />)

        expect(container.querySelector("img")).toHaveAttribute("src", "https://cdn.test/lamp.png")
        expect(screen.getByText("S")).toHaveAttribute("aria-hidden", "true")
    })

    it("ready: each tile shows the served stock and carries the real add affordance", () => {
        render(<BrowsePageBase {...surfaceFor("ready")} />)

        expect(screen.getByText("12 in stock")).toBeInTheDocument()
        expect(screen.getByText("3 in stock")).toBeInTheDocument()
        expect(screen.getAllByRole("button", { name: "Add to cart" })).toHaveLength(2)
    })

    it("ready: an answered add shows the line's running quantity, never a fabricated success", async () => {
        render(<BrowsePageBase {...surfaceFor("ready")} />)

        fireEvent.click(screen.getAllByRole("button", { name: "Add to cart" })[0])
        expect(await screen.findByText("In your cart: 1")).toBeInTheDocument()
        expect(addToCart).toHaveBeenCalledWith("aurelis-desk-lamp")
    })

    it("ready: a refused add is named inline, and no running count is invented", async () => {
        vi.mocked(addToCart).mockResolvedValueOnce({ ok: false, reason: "no signed-in session", code: "SESSION_INVALID" })
        render(<BrowsePageBase {...surfaceFor("ready")} />)

        fireEvent.click(screen.getAllByRole("button", { name: "Add to cart" })[0])
        expect(await screen.findByText("The order service refused the add.")).toBeInTheDocument()
        expect(screen.queryByText(/In your cart:/)).not.toBeInTheDocument()
    })

    it("signedOut: an absent session is the gate - the catalogue is a signed-in read", () => {
        const { container } = render(<BrowsePageBase {...surfaceFor("signedOut", [])} />)

        expect(screen.getByText("Sign in to browse")).toBeInTheDocument()
        expect(container.querySelector("svg")).toBeNull()
        expect(screen.queryByRole("button", { name: "Add to cart" })).not.toBeInTheDocument()
    })

    it("empty: a reachable service with no rows is a genuine empty state, so the mascot joins", () => {
        const { container } = render(<BrowsePageBase {...surfaceFor("empty", [])} />)

        expect(screen.getByText("Nothing on the shelf")).toBeInTheDocument()
        expect(screen.getByText("The catalogue answered with no rows.")).toBeInTheDocument()
        expect(container.querySelector("svg")).not.toBeNull()
        expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument()
    })

    it("failed: an unreachable service is a refusal, not an empty shelf - the mascot stays away", () => {
        const { container } = render(<BrowsePageBase {...surfaceFor("failed", [])} />)

        expect(screen.getByText("Catalogue unavailable")).toBeInTheDocument()
        expect(screen.getByText("The order service did not answer.")).toBeInTheDocument()
        expect(container.querySelector("svg")).toBeNull()
        expect(screen.queryByText("Nothing on the shelf")).not.toBeInTheDocument()
    })

    it("the heading stands in all four situations, so the reader always knows which screen refused", () => {
        for (const state of ["ready", "empty", "signedOut", "failed"] as const) {
            render(<BrowsePageBase {...surfaceFor(state, state === "ready" ? rows : [])} />)
            expect(screen.getByRole("heading", { level: 1, name: "Catalogue" })).toBeInTheDocument()
            cleanup()
        }
    })
})

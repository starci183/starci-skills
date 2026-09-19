import { describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: vi.fn() }),
}))
vi.mock("../../blocks/ClearCart/actions", () => ({
    clearCartAction: vi.fn(async () => ({ ok: true as const })),
}))

import { CartPageBase, type CartLineRow, type CartPageProps, type CartPageState } from "./component"

const lines: ReadonlyArray<CartLineRow> = [
    { productId: "sku-mug", name: "Enamel mug", quantityLabel: "× 2", lineTotal: "$25.98" },
    { productId: "sku-notebook", name: "Dot-grid notebook", quantityLabel: "× 1", lineTotal: "$8.99" },
]

const words = {
    title: "Cart",
    description: "What you are about to order.",
    linesTitle: "Your cart",
    cartTotal: "$34.97",
    clearLabel: "Clear cart",
    clearingLabel: "Clearing…",
    clearRefused: "The service refused the clear - the cart is unchanged.",
    checkoutCta: "Go to checkout",
    checkoutHref: "/en/checkout",
    emptyTitle: "Your cart is empty",
    emptyDescription: "Items you add while browsing will appear here.",
    backToBrowse: "Back to browse",
    browseHref: "/en/browse",
    accountCta: "Your account",
    accountHref: "/en/account",
    signedOutTitle: "Sign in to see your cart",
    signedOutDescription: "Your cart lives on the order service under your session.",
    unreachableTitle: "Cart unavailable",
    unreachableDescription: "The order service did not answer.",
}

const surfaceFor = (state: CartPageState, rows: ReadonlyArray<CartLineRow> = lines): CartPageProps => ({
    state,
    props: { ...words, lines: rows },
    on: {},
})

describe("CartPageBase", () => {
    it("ready: every cart line names its product, its quantity and its line total", () => {
        render(<CartPageBase {...surfaceFor("ready")} />)

        expect(screen.getByRole("heading", { level: 1, name: "Cart" })).toBeInTheDocument()
        expect(screen.getByText("Enamel mug")).toBeInTheDocument()
        expect(screen.getByText("× 2")).toBeInTheDocument()
        expect(screen.getByText("$25.98")).toBeInTheDocument()
        expect(screen.getByText("Dot-grid notebook")).toBeInTheDocument()
        expect(screen.getByText("$34.97")).toBeInTheDocument()
    })

    it("ready: the doors that are really open - clear the cart, or go to checkout", () => {
        render(<CartPageBase {...surfaceFor("ready")} />)

        expect(screen.getByRole("button", { name: "Clear cart" })).toBeInTheDocument()
        expect(screen.getByRole("link", { name: "Go to checkout" })).toHaveAttribute("href", "/en/checkout")
    })

    it("empty: a genuinely empty cart is an empty state, so the mascot is welcome", () => {
        const { container } = render(<CartPageBase {...surfaceFor("empty", [])} />)

        expect(screen.getByText("Your cart is empty")).toBeInTheDocument()
        expect(container.querySelector("svg")).not.toBeNull()
        expect(screen.getByRole("link", { name: "Back to browse" })).toHaveAttribute("href", "/en/browse")
    })

    it("signedOut: an absent session is the gate, not an empty cart", () => {
        const { container } = render(<CartPageBase {...surfaceFor("signedOut", [])} />)

        expect(screen.getByText("Sign in to see your cart")).toBeInTheDocument()
        expect(screen.getByRole("link", { name: "Your account" })).toHaveAttribute("href", "/en/account")
        expect(container.querySelector("svg")).toBeNull()
        expect(screen.queryByText("Enamel mug")).not.toBeInTheDocument()
    })

    it("failed: a service that did not answer is a refusal, not an empty cart", () => {
        const { container } = render(<CartPageBase {...surfaceFor("failed", [])} />)

        expect(screen.getByText("Cart unavailable")).toBeInTheDocument()
        expect(screen.getByText("The order service did not answer.")).toBeInTheDocument()
        expect(container.querySelector("svg")).toBeNull()
        expect(screen.queryByText("Your cart is empty")).not.toBeInTheDocument()
    })

    it("the heading stands in every situation, so the reader always knows which screen answered", () => {
        for (const state of ["ready", "empty", "signedOut", "failed"] as const) {
            render(<CartPageBase {...surfaceFor(state, state === "ready" ? lines : [])} />)
            expect(screen.getByRole("heading", { level: 1, name: "Cart" })).toBeInTheDocument()
            cleanup()
        }
    })
})

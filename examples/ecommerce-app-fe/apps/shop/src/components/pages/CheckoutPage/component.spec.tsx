import { describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

vi.mock("../../blocks/ConfirmOrder/actions", () => ({
    placeOrderAction: vi.fn(),
}))

import { placeOrderAction } from "../../blocks/ConfirmOrder/actions"
import { CheckoutPageBase, type CheckoutLineRow, type CheckoutPageProps, type CheckoutPageState } from "./component"

const lines: ReadonlyArray<CheckoutLineRow> = [
    { productId: "sku-thermos", name: "Steel thermos", quantityLabel: "× 3", lineTotal: "$74.97" },
]

const words = {
    title: "Checkout",
    description: "Review and place the order.",
    summaryTitle: "Your order",
    orderTotal: "$74.97",
    attemptKey: "checkout-person-1-abc123",
    productNames: { "sku-thermos": "Steel thermos" },
    confirmLabel: "Confirm order",
    confirmingLabel: "Confirming…",
    confirmedTitle: "Order confirmed",
    confirmedDetail: "Order {orderId} is {status} — {total}. Payment {paymentId}.",
    replayedNote: "This confirmation was already sent - the same order answered.",
    refusedCartEmpty: "The order service refused: your cart is empty. Nothing was placed.",
    refusedStock: "The order service refused: {product} has {available} in stock and you asked for {requested}. Nothing was placed.",
    refusedUnknownProduct: "The order service refused: {productId} is not a product it sells.",
    refusedSession: "The order service refused: your session is not live.",
    refusedGeneric: "The order service refused: {reason}.",
    emptyTitle: "Nothing to check out yet",
    emptyDescription: "Your cart is empty - the order service refuses a confirmation on it.",
    signedOutTitle: "Sign in to check out",
    signedOutDescription: "Checkout confirms against your session.",
    unreachableTitle: "Checkout unavailable",
    unreachableDescription: "The order service did not answer.",
    browseCta: "Browse the catalogue",
    accountCta: "Your account",
    browseHref: "/en/browse",
    accountHref: "/en/account",
}

const surfaceFor = (state: CheckoutPageState, rows: ReadonlyArray<CheckoutLineRow> = lines): CheckoutPageProps => ({
    state,
    props: { ...words, lines: rows },
    on: {},
})

describe("CheckoutPageBase", () => {
    it("ready: the summary names every line and the total before the confirm affordance", () => {
        render(<CheckoutPageBase {...surfaceFor("ready")} />)

        expect(screen.getByRole("heading", { level: 1, name: "Checkout" })).toBeInTheDocument()
        expect(screen.getByText("Steel thermos")).toBeInTheDocument()
        expect(screen.getByText("× 3")).toBeInTheDocument()
        expect(screen.getAllByText("$74.97")).toHaveLength(2)
        expect(screen.getByRole("button", { name: "Confirm order" })).toBeInTheDocument()
    })

    it("confirm sends the rendered attempt's idempotency key, and the answer is drawn verbatim", async () => {
        vi.mocked(placeOrderAction).mockResolvedValue({
            kind: "confirmed",
            confirmation: {
                orderId: "ord-91", status: "paid", totalMinorUnits: 7497,
                currency: "USD", paymentId: "pay-77", replayed: false,
            },
        })
        render(<CheckoutPageBase {...surfaceFor("ready")} />)

        fireEvent.click(screen.getByRole("button", { name: "Confirm order" }))
        expect(placeOrderAction).toHaveBeenCalledWith("checkout-person-1-abc123")
        expect(await screen.findByText("Order confirmed")).toBeInTheDocument()
        expect(screen.getByText(/ord-91/)).toBeInTheDocument()
        expect(screen.getByText(/pay-77/)).toBeInTheDocument()
        expect(screen.queryByText(/already sent/)).not.toBeInTheDocument()
    })

    it("a replayed answer is marked as a replay, not drawn as a fresh order", async () => {
        vi.mocked(placeOrderAction).mockResolvedValue({
            kind: "confirmed",
            confirmation: {
                orderId: "ord-91", status: "paid", totalMinorUnits: 7497,
                currency: "USD", paymentId: "pay-77", replayed: true,
            },
        })
        render(<CheckoutPageBase {...surfaceFor("ready")} />)

        fireEvent.click(screen.getByRole("button", { name: "Confirm order" }))
        expect(await screen.findByText(/already sent/)).toBeInTheDocument()
        expect(screen.getByText(/ord-91/)).toBeInTheDocument()
    })

    it("the empty-cart refusal is shown as the refusal it is, and the confirm stays", async () => {
        vi.mocked(placeOrderAction).mockResolvedValue({
            kind: "refused", reason: "cart-empty", productId: "",
        })
        render(<CheckoutPageBase {...surfaceFor("ready")} />)

        fireEvent.click(screen.getByRole("button", { name: "Confirm order" }))
        expect(await screen.findByText(/your cart is empty/)).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Confirm order" })).toBeInTheDocument()
    })

    it("the stock refusal names the product, the asked quantity and the stock there was", async () => {
        vi.mocked(placeOrderAction).mockResolvedValue({
            kind: "refused", reason: "insufficient-stock",
            productId: "sku-thermos", requested: 3, available: 2,
        })
        render(<CheckoutPageBase {...surfaceFor("ready")} />)

        fireEvent.click(screen.getByRole("button", { name: "Confirm order" }))
        expect(await screen.findByText(/Steel thermos has 2 in stock and you asked for 3/)).toBeInTheDocument()
    })

    it("empty: the cart-empty confirmation stays reachable, because its refusal is a real answer", () => {
        render(<CheckoutPageBase {...surfaceFor("empty", [])} />)

        expect(screen.getByText("Nothing to check out yet")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Confirm order" })).toBeInTheDocument()
        expect(screen.getByRole("link", { name: "Browse the catalogue" })).toHaveAttribute("href", "/en/browse")
    })

    it("signedOut: an absent session is the gate, not a summary", () => {
        render(<CheckoutPageBase {...surfaceFor("signedOut", [])} />)

        expect(screen.getByText("Sign in to check out")).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: "Confirm order" })).not.toBeInTheDocument()
        expect(screen.getByRole("link", { name: "Your account" })).toHaveAttribute("href", "/en/account")
    })

    it("failed: a service that did not answer is a refusal, not an empty checkout", () => {
        const { container } = render(<CheckoutPageBase {...surfaceFor("failed", [])} />)

        expect(screen.getByText("Checkout unavailable")).toBeInTheDocument()
        expect(container.querySelector("svg")).toBeNull()
        expect(screen.queryByText("Nothing to check out yet")).not.toBeInTheDocument()
    })

    it("the heading stands in every situation", () => {
        for (const state of ["ready", "empty", "signedOut", "failed"] as const) {
            render(<CheckoutPageBase {...surfaceFor(state, state === "ready" ? lines : [])} />)
            expect(screen.getByRole("heading", { level: 1, name: "Checkout" })).toBeInTheDocument()
            cleanup()
        }
    })
})

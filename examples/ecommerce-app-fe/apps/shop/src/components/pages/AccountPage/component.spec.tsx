import { describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { AccountPageBase, type AccountPageProps, type AccountPageState } from "./component"

const words = {
    title: "Account",
    accountLine: "Signed in as shopper@northwind.test",
    authHeadline: "Your Northwind account.",
    authLede: "Sign in - or create one - to keep a cart and place orders.",
    authForm: <div data-testid="auth-form" />,
    signOut: <button type="button">Sign out</button>,
    ordersTitle: "Orders",
    ordersSignedOutTitle: "Sign in to see orders",
    ordersSignedOutDescription: "Orders belong to a signed-in account; nobody is signed in here.",
    ordersUnreachableTitle: "No order status to show",
    ordersUnreachableDescription: "The account service did not answer.",
    ordersEmptyTitle: "No orders yet",
    ordersEmptyDescription: "The order service confirms this account has placed none.",
    ordersBuyerTitle: "The order service confirms this account has placed orders.",
    ordersBuyerDescription: "A per-order list is not served yet.",
}

const surfaceFor = (state: AccountPageState): AccountPageProps => ({
    state,
    props: { ...words },
    on: {},
})

describe("AccountPageBase", () => {
    it("signedOut: the auth split carries the welcome panel and the connected session form", () => {
        render(<AccountPageBase {...surfaceFor("signedOut")} />)

        expect(screen.getByRole("heading", { level: 2, name: "Your Northwind account." })).toBeInTheDocument()
        expect(screen.getByText("Sign in - or create one - to keep a cart and place orders.")).toBeInTheDocument()
        expect(screen.getByTestId("auth-form")).toBeInTheDocument()
        expect(screen.getByRole("heading", { name: "Orders" })).toBeInTheDocument()
        expect(screen.getByText("Sign in to see orders")).toBeInTheDocument()
    })

    it("signed-in: says who the shopper is before anything about their orders", () => {
        render(<AccountPageBase {...surfaceFor("buyer")} />)

        expect(screen.getByRole("heading", { level: 1, name: "Account" })).toBeInTheDocument()
        expect(screen.getByText("Signed in as shopper@northwind.test")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument()
    })

    it("buyer: the confirmed-buyer answer is stated as what it is - not drawn as fabricated rows", () => {
        render(<AccountPageBase {...surfaceFor("buyer")} />)

        expect(screen.getByRole("heading", { name: "Orders" })).toBeInTheDocument()
        expect(screen.getByText("The order service confirms this account has placed orders.")).toBeInTheDocument()
        expect(screen.getByText("A per-order list is not served yet.")).toBeInTheDocument()
        expect(screen.queryByRole("listitem")).not.toBeInTheDocument()
    })

    it("empty: the service's no-orders answer is the honest empty state, and the duck belongs there", () => {
        const { container } = render(<AccountPageBase {...surfaceFor("empty")} />)

        expect(screen.getByText("No orders yet")).toBeInTheDocument()
        expect(screen.getByText("The order service confirms this account has placed none.")).toBeInTheDocument()
        expect(container.querySelector("svg")).not.toBeNull()
    })

    it("unreachable: a service that did not answer is reported as a refusal, never as an empty history", () => {
        render(<AccountPageBase {...surfaceFor("unreachable")} />)

        expect(screen.getByText("No order status to show")).toBeInTheDocument()
        expect(screen.getByText("The account service did not answer.")).toBeInTheDocument()
        expect(screen.queryByText("No orders yet")).not.toBeInTheDocument()
    })

    it("the orders heading stands in every settled situation", () => {
        for (const state of ["signedOut", "unreachable", "empty", "buyer"] as const) {
            render(<AccountPageBase {...surfaceFor(state)} />)
            expect(screen.getByRole("heading", { name: "Orders" })).toBeInTheDocument()
            cleanup()
        }
    })
})

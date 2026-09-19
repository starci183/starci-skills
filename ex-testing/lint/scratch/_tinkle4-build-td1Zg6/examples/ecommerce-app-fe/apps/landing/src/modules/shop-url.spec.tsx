import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { ShopUrlProvider, useShopUrl } from "./shop-url"

const Reader = () => <span>{useShopUrl()}</span>

describe("shop-url", () => {
    it("hands the origin the server resolved to the client tree, untouched", () => {
        render(
            <ShopUrlProvider shopUrl="http://shop.test:3001">
                <Reader />
            </ShopUrlProvider>
        )

        expect(screen.getByText("http://shop.test:3001")).toBeInTheDocument()
    })

    it("carries each app's own answer when the tree is mounted twice", () => {
        render(
            <>
                <ShopUrlProvider shopUrl="http://shop.test:3001">
                    <Reader />
                </ShopUrlProvider>
                <ShopUrlProvider shopUrl="http://shop.test:3002">
                    <Reader />
                </ShopUrlProvider>
            </>
        )

        expect(screen.getByText("http://shop.test:3001")).toBeInTheDocument()
        expect(screen.getByText("http://shop.test:3002")).toBeInTheDocument()
    })

    it("refuses to invent an origin when no provider answered - a missing bridge is a bug, not a state", () => {
        expect(() => render(<Reader />)).toThrow("useShopUrl must run under ShopUrlProvider")
    })
})

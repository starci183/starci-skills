import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Button } from "./index.js"

describe("Button", () => {
    it("owns visible pending feedback and blocks duplicate presses", () => {
        const markup = renderToStaticMarkup(
            <Button variant="primary" isPending onPress={() => undefined}>
                Sign in
            </Button>,
        )
        expect(markup).toContain("data-component=\"Button\"")
        expect(markup).toContain("data-action-pending=\"true\"")
        expect(markup).toContain("aria-busy=\"true\"")
        expect(markup).toContain("disabled=\"\"")
        expect(markup).toContain("data-slot=\"spinner\"")
        expect(markup).toContain("Sign in")
    })

    it("binds explicit disabled state without claiming pending", () => {
        const markup = renderToStaticMarkup(<Button isDisabled>Continue</Button>)
        expect(markup).toContain("disabled=\"\"")
        expect(markup).toContain("data-action-pending=\"false\"")
    })

    it("keeps the pending spinner out of the accessible name", () => {
        const markup = renderToStaticMarkup(<Button isPending>Share</Button>)
        expect(markup).toContain("aria-hidden=\"true\"")
        expect(markup).not.toContain("aria-hidden=\"true\">Share")
    })

    it("keeps its label reachable while skeleton", () => {
        const markup = renderToStaticMarkup(<Button isSkeleton>Enroll</Button>)
        expect(markup).toContain("data-loading=\"true\"")
        expect(markup).not.toContain("<span aria-hidden")
        expect(markup).toContain("Enroll")
    })

    it("renders an anchor with button appearance when given a destination", () => {
        const markup = renderToStaticMarkup(<Button variant="primary" href="/checkout">Buy now</Button>)
        expect(markup).toContain("<a")
        expect(markup).toContain("href=\"/checkout\"")
        expect(markup).toContain("data-element=\"a\"")
        expect(markup).toContain("button--primary")
        expect(markup).not.toContain("<button")
    })

    it("withholds the destination while pending", () => {
        const markup = renderToStaticMarkup(<Button href="/checkout" isPending>Buy now</Button>)
        expect(markup).toContain("<a")
        expect(markup).not.toContain("href=")
        expect(markup).toContain("aria-disabled=\"true\"")
        expect(markup).toContain("role=\"link\"")
    })
})

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TextAction } from "./index.js"

describe("TextAction", () => {
    afterEach(cleanup)

    it("uses button semantics for state-only actions", () => {
        const press = vi.fn()
        render(<TextAction onPress={press}>Show more</TextAction>)
        fireEvent.click(screen.getByRole("button", { name: "Show more" }))
        expect(press).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole("link")).toBeNull()
    })

    it("retains its label and blocks presses while pending", () => {
        const press = vi.fn()
        render(<TextAction onPress={press} isPending>Saving</TextAction>)
        const action = screen.getByRole("button", { name: "Saving" })
        expect((action as HTMLButtonElement).disabled).toBe(true)
        expect(action.getAttribute("aria-busy")).toBe("true")
        fireEvent.click(action)
        expect(press).not.toHaveBeenCalled()
    })

    it("renders a real anchor when given a destination", () => {
        render(<TextAction href="/courses" appearance="route" isCurrent>Courses</TextAction>)
        const link = screen.getByRole("link", { name: "Courses" })
        expect(link.getAttribute("href")).toBe("/courses")
        expect(link.getAttribute("aria-current")).toBe("page")
        expect(screen.queryByRole("button")).toBeNull()
    })

    it("secures new browsing contexts by default", () => {
        const markup = renderToStaticMarkup(<TextAction href="https://example.test" target="_blank">Docs</TextAction>)
        expect(markup).toContain("target=\"_blank\"")
        expect(markup).toContain("rel=\"noopener noreferrer\"")
    })

    it("withholds the destination while pending instead of becoming a button", () => {
        const follow = vi.fn()
        render(<TextAction href="/checkout" onFollow={follow} isPending>Continue</TextAction>)
        const link = screen.getByRole("link", { name: "Continue" })
        expect(link.hasAttribute("href")).toBe(false)
        expect(link.getAttribute("aria-disabled")).toBe("true")
        expect(link.getAttribute("aria-busy")).toBe("true")
        fireEvent.click(link)
        expect(follow).not.toHaveBeenCalled()
        expect(screen.queryByRole("button")).toBeNull()
    })
})

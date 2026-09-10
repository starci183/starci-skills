import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ExampleBlockBase } from "./component"

afterEach(cleanup)

const labels = {
    title: "Status",
    pendingMessage: "Loading status",
    failedMessage: "Status unavailable",
    retryLabel: "Retry",
    detailsLabel: "Open details",
    helpLabel: "Open help",
} as const

describe("ExampleBlockBase", () => {
    it("renders resolved ready content and keeps destination on href", () => {
        const retry = vi.fn()
        const openHelp = vi.fn()
        render(
            <ExampleBlockBase
                state="ready"
                props={{ labels, value: "All clear", detailsHref: "/example/details" }}
                on={{ retry, openHelp }}
            />,
        )

        expect(screen.getByText("Status")).toBeTruthy()
        expect(screen.getByText("All clear")).toBeTruthy()
        const details = screen.getByRole("link", { name: "Open details" })
        expect(details.getAttribute("href")).toBe("/example/details")
        fireEvent.click(screen.getByRole("button", { name: "Open help" }))
        expect(openHelp).toHaveBeenCalledOnce()
        expect(retry).not.toHaveBeenCalled()
    })

    it("renders failed copy and dispatches retry through onPress", () => {
        const retry = vi.fn()
        const openHelp = vi.fn()
        render(
            <ExampleBlockBase
                state="failed"
                props={{ labels, detailsHref: "/example/details" }}
                on={{ retry, openHelp }}
            />,
        )

        expect(screen.getByText("Status unavailable")).toBeTruthy()
        fireEvent.click(screen.getByRole("button", { name: "Retry" }))
        expect(retry).toHaveBeenCalledOnce()
        expect(screen.getByRole("link", { name: "Open details" }).getAttribute("href")).toBe("/example/details")
    })

    it("renders pending without action controls", () => {
        render(
            <ExampleBlockBase
                state="pending"
                props={{ labels, detailsHref: "/example/details" }}
                on={{ retry: vi.fn(), openHelp: vi.fn() }}
            />,
        )

        expect(screen.getByText("Loading status")).toBeTruthy()
        expect(screen.queryByRole("button", { name: "Retry" })).toBeNull()
        expect(screen.queryByRole("link", { name: "Open details" })).toBeNull()
    })
})

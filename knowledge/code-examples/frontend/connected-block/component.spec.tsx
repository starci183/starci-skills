import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ExampleBlockBase, type ExampleBlockData, type ExampleBlockState } from "./component"

afterEach(cleanup)

const statusLabels = { empty: "No status yet", forbidden: "No access", error: "Status unavailable", retry: "Retry" }
const ready: ExampleBlockData = {
    status: { items: { value: "All clear", checks: ["Database", "Queue"] } },
    labels: { title: "Status", detailsLabel: "Open details", helpLabel: "Open help", status: statusLabels },
    detailsHref: "/example/details",
}
const shapes: ReadonlyArray<ExampleBlockState> = ["summary", "detail"]

describe("ExampleBlockBase", () => {
    it.each(shapes)("%s renders ready content and keeps destination on href", (state) => {
        const openHelp = vi.fn()
        render(<ExampleBlockBase state={state} props={ready} on={{ retry: vi.fn(), openHelp }} />)

        expect(screen.getByText("All clear")).toBeTruthy()
        expect(screen.getByRole("link", { name: "Open details" }).getAttribute("href")).toBe("/example/details")
        fireEvent.click(screen.getByRole("button", { name: "Open help" }))
        expect(openHelp).toHaveBeenCalledOnce()
    })

    it("only the detail shape lists the checks", () => {
        const { rerender } = render(<ExampleBlockBase state="summary" props={ready} on={{ retry: vi.fn(), openHelp: vi.fn() }} />)
        expect(screen.queryByText("Queue")).toBeNull()
        rerender(<ExampleBlockBase state="detail" props={ready} on={{ retry: vi.fn(), openHelp: vi.fn() }} />)
        expect(screen.getByText("Queue")).toBeTruthy()
    })

    it("an errored slot offers retry through the recipe, and the frame stays", () => {
        const retry = vi.fn()
        render(<ExampleBlockBase state="summary" props={{ ...ready, status: { isError: true } }} on={{ retry, openHelp: vi.fn() }} />)

        expect(screen.getByText("Status unavailable")).toBeTruthy()
        fireEvent.click(screen.getByRole("button", { name: "Retry" }))
        expect(retry).toHaveBeenCalledOnce()
        expect(screen.getByRole("link", { name: "Open details" })).toBeTruthy()
    })

    it("a forbidden slot says so in place", () => {
        render(<ExampleBlockBase state="summary" props={{ ...ready, status: { isForbidden: true } }} on={{ retry: vi.fn(), openHelp: vi.fn() }} />)
        expect(screen.getByText("No access")).toBeTruthy()
    })
})

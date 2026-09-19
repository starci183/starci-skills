import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { DuckMascot } from "./index"

describe("DuckMascot", () => {
    it("ships the mark as real inline artwork at the brand size, never as a remote image", () => {
        const { container } = render(<DuckMascot />)

        const mark = container.querySelector("svg")
        expect(mark).not.toBeNull()
        expect(mark).toHaveAttribute("viewBox", "0 0 64 64")
        expect(mark).toHaveAttribute("width", "64")
        expect(mark).toHaveAttribute("height", "64")
        expect(container.querySelector("img")).toBeNull()
    })

    it("takes the edge length from `size` so a hero can ask for a larger mark", () => {
        const { container } = render(<DuckMascot size={96} />)

        const mark = container.querySelector("svg")
        expect(mark).toHaveAttribute("width", "96")
        expect(mark).toHaveAttribute("height", "96")
    })

    it("passes the glyph contract attributes straight onto the root, so it mounts in an Icon slot without an adapter", () => {
        render(
            <DuckMascot
                role="img"
                aria-label="Northwind duck"
                focusable="false"
                data-tier="atom"
                data-component="DuckMascot"
                data-usage="leading"
            />
        )

        const mark = screen.getByRole("img", { name: "Northwind duck" })
        expect(mark).toHaveAttribute("focusable", "false")
        expect(mark).toHaveAttribute("data-tier", "atom")
        expect(mark).toHaveAttribute("data-usage", "leading")
    })

    it("stays out of the way when a caller marks it hidden", () => {
        const { container } = render(<DuckMascot aria-hidden />)

        expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
        expect(screen.queryByRole("img")).not.toBeInTheDocument()
    })
})

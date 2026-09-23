// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FAMILY_ROOTS, expectedFamilyScope } from "../../../__test__/navigationFamilies.js"
import { Image } from "./index.js"

afterEach(cleanup)

describe.each(FAMILY_ROOTS)("Image under %s", (family, wrap) => {
    it("reserves its aspect ratio and defers loading by default", () => {
        const { container } = render(wrap(<Image src="/hero.png" alt="Mountain lake" aspect="wide" />))
        expect(screen.getByTestId("grammar-root").getAttribute("data-grammar-family")).toBe(expectedFamilyScope(family))
        const frame = container.querySelector("[data-component='Image']")
        expect(frame?.getAttribute("data-grammar-image-aspect")).toBe("wide")
        expect(frame?.getAttribute("data-grammar-image-fit")).toBe("cover")
        expect(frame?.getAttribute("data-grammar-image-state")).toBe("loading")
        const image = screen.getByRole("img", { name: "Mountain lake" })
        expect(image.getAttribute("loading")).toBe("lazy")
        expect(image.getAttribute("decoding")).toBe("async")
    })

    it("reports loaded and error states", () => {
        const onLoadStateChange = vi.fn()
        const { container } = render(wrap(<Image src="/a.png" alt="A" onLoadStateChange={onLoadStateChange} loading="eager" />))
        fireEvent.load(screen.getByRole("img", { name: "A" }))
        expect(container.querySelector("[data-component='Image']")?.getAttribute("data-grammar-image-state")).toBe("loaded")
        fireEvent.error(screen.getByRole("img", { name: "A" }))
        expect(container.querySelector("[data-component='Image']")?.getAttribute("data-grammar-image-state")).toBe("error")
        expect(onLoadStateChange.mock.calls.map(([state]) => state)).toEqual(["loaded", "error"])
    })

    it("swaps in the fallback with the same accessible name when the image fails", () => {
        const { container } = render(wrap(<Image src="/missing.png" alt="Profile photo" fallback={<span>no image</span>} />))
        fireEvent.error(screen.getByRole("img", { name: "Profile photo" }))
        const fallback = screen.getByRole("img", { name: "Profile photo" })
        expect(fallback.getAttribute("data-grammar-image-fallback")).toBe("true")
        expect(container.querySelector("img")).toBeNull()
    })

    it("keeps decorative images out of the accessibility tree", () => {
        const { container } = render(wrap(<Image src="/ornament.png" alt="" />))
        expect(screen.queryByRole("img")).toBeNull()
        expect(container.querySelector("img")?.getAttribute("alt")).toBe("")
    })
})

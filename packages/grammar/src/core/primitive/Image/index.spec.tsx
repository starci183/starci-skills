// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FAMILY_WRAPS, expectedFamilyScope } from "../../../__test__/grammarRoots.js"
import { MediaFrame } from "../MediaFrame/index.js"
import { Image } from "./index.js"

afterEach(cleanup)

describe.each(FAMILY_WRAPS)("Image under %s", (family, wrap) => {
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

describe.each(FAMILY_WRAPS)("asset slot attributes under %s", (_family, wrap) => {
    it("passes the Image slot, sha256 and prompt through as data-asset-* on its root", () => {
        const { container } = render(wrap(<Image src="/hero.png" alt="" assetSlot="nivo.dashboard.overview-art" assetSha256="7f1b56d0" assetPrompt="One white unicorn" />))
        const root = container.querySelector("[data-component='Image']")!
        expect(root.getAttribute("data-asset-slot")).toBe("nivo.dashboard.overview-art")
        expect(root.getAttribute("data-asset-sha256")).toBe("7f1b56d0")
        expect(root.getAttribute("data-asset-prompt")).toBe("One white unicorn")
    })

    it("passes them through on a MediaFrame, and emits none when unset", () => {
        const { container } = render(wrap(<>
            <MediaFrame assetSlot="landing.hero" treatment="plain"><img alt="" src="/a.png" /></MediaFrame>
            <MediaFrame><img alt="" src="/b.png" /></MediaFrame>
        </>))
        const [slotted, plain] = [...container.querySelectorAll("[data-component='MediaFrame']")]
        expect(slotted?.tagName).toBe("FIGURE")
        expect(slotted?.getAttribute("data-asset-slot")).toBe("landing.hero")
        expect(slotted?.hasAttribute("data-asset-sha256")).toBe(false)
        expect(plain?.hasAttribute("data-asset-slot")).toBe(false)
        expect(container.querySelector("[data-component='Image']")).toBeNull()
    })
})

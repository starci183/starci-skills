// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { GRAMMAR_ROOT_CASES, expectInFamilyScope } from "../../../__test__/overlayRoots.js"
import { Button } from "../../primitive/Button/index.js"
import { Popover } from "./index.js"

afterEach(cleanup)

describe.each(GRAMMAR_ROOT_CASES)("Common Popover under $name", ({ Root, family }) => {
    it("opens a titled non-modal dialog anchored to its trigger, inside the family scope", async () => {
        render(
            <Root>
                <Popover title="Share link" trigger={<Button>Share</Button>} showArrow>
                    <Button>Copy link</Button>
                </Popover>
            </Root>,
        )
        const trigger = screen.getByRole("button", { name: "Share" })
        act(() => trigger.focus())
        act(() => { fireEvent.click(trigger) })

        const panel = await screen.findByRole("dialog", { name: "Share link" })
        expect(panel.getAttribute("data-component")).toBe("Popover")
        expect(trigger.getAttribute("aria-expanded")).toBe("true")
        const surface = panel.closest("[data-grammar-overlay-surface=\"popover\"]")
        expect(surface).toBeTruthy()
        expect(surface?.querySelector("[data-grammar-popover-arrow]")).toBeTruthy()
        expectInFamilyScope(panel, family)
        await waitFor(() => expect(panel.contains(document.activeElement)).toBe(true))

        act(() => { fireEvent.keyDown(document.activeElement ?? panel, { key: "Escape" }) })
        expect(screen.queryByRole("dialog")).toBeNull()
        await waitFor(() => expect(document.activeElement).toBe(trigger))
    })

    it("takes an accessible label when it has no visible title", async () => {
        render(<Root><Popover label="Colour options" trigger={<Button>Colour</Button>} defaultOpen>Swatches</Popover></Root>)
        const panel = await screen.findByRole("dialog", { name: "Colour options" })
        expect(panel.getAttribute("aria-label")).toBe("Colour options")
        expect(screen.queryByRole("heading")).toBeNull()
        expectInFamilyScope(panel, family)
    })
})

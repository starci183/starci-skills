// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { GRAMMAR_ROOT_CASES, expectInFamilyScope } from "../../../__test__/grammarRoots.js"
import { Button } from "../../primitive/Button/index.js"
import { Drawer } from "./index.js"

afterEach(cleanup)

describe.each(GRAMMAR_ROOT_CASES)("Common Drawer under $name", ({ Root, family }) => {
    it("opens a side sheet dialog inside the family scope without a handle", async () => {
        render(
            <Root>
                <Drawer title="Filters" description="Narrow the list." closeLabel="Close filters" trigger={<Button>Filters</Button>}>
                    <p>Filter body</p>
                </Drawer>
            </Root>,
        )
        const trigger = screen.getByRole("button", { name: "Filters" })
        act(() => trigger.focus())
        act(() => { fireEvent.click(trigger) })

        const sheet = await screen.findByRole("dialog")
        expect(sheet.getAttribute("data-component")).toBe("Drawer")
        expect(sheet.getAttribute("data-placement")).toBe("right")
        expect(sheet.getAttribute("data-grammar-overlay-surface")).toBe("drawer")
        expect(sheet.getAttribute("aria-labelledby")).toBe(screen.getByRole("heading", { name: "Filters" }).id)
        expect(sheet.querySelector("[data-grammar-drawer-handle]")).toBeNull()
        expectInFamilyScope(sheet, family)
        expect(sheet.closest("[data-grammar-overlay-backdrop=\"Drawer\"]")?.parentElement?.classList.contains("grammar-common-root")).toBe(true)
        await waitFor(() => expect(sheet.contains(document.activeElement)).toBe(true))

        act(() => { fireEvent.click(screen.getByRole("button", { name: "Close filters" })) })
        expect(screen.queryByRole("dialog")).toBeNull()
        await waitFor(() => expect(document.activeElement).toBe(trigger))
    })

    it("draws a decorative grab handle on a bottom sheet and closes on Escape", async () => {
        render(<Root><Drawer title="Share" placement="bottom" defaultOpen /></Root>)
        const sheet = await screen.findByRole("dialog")

        expect(sheet.getAttribute("data-placement")).toBe("bottom")
        const handle = sheet.querySelector("[data-grammar-drawer-handle]")
        expect(handle?.getAttribute("aria-hidden")).toBe("true")
        expectInFamilyScope(sheet, family)

        act(() => { fireEvent.keyDown(sheet, { key: "Escape" }) })
        expect(screen.queryByRole("dialog")).toBeNull()
    })
})

describe("Common Drawer handle override", () => {
    it("lets a side sheet opt into the handle and a bottom sheet opt out", async () => {
        const { rerender } = render(<Drawer title="Side" placement="left" showHandle isOpen />)
        expect((await screen.findByRole("dialog")).querySelector("[data-grammar-drawer-handle]")).toBeTruthy()
        rerender(<Drawer title="Side" placement="bottom" showHandle={false} isOpen />)
        expect(screen.getByRole("dialog").querySelector("[data-grammar-drawer-handle]")).toBeNull()
    })
})

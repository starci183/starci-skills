// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FAMILY_ROOTS, describedTexts, familyOf, installDomShims } from "../../../__test__/grammarRoots.js"
import { Select, type ListOption } from "./index.js"

installDomShims()
afterEach(cleanup)

const OPTIONS: ReadonlyArray<ListOption> = [
    { id: "one", label: "One" },
    { id: "two", label: "Two", description: "Second choice" },
    { id: "three", label: "Three", isDisabled: true },
]

const openWithKeyboard = async (trigger: HTMLElement) => {
    await act(async () => {
        fireEvent.keyDown(trigger, { key: "ArrowDown" })
        fireEvent.keyUp(trigger, { key: "ArrowDown" })
    })
}

describe.each(FAMILY_ROOTS)("Select under %s", (family, Root) => {
    it("names the trigger from its label and wires description and error", () => {
        const { container } = render(<Root>
            <Select label="Size" options={OPTIONS} description="Pick one" errorMessage="Required" isRequired />
        </Root>)
        expect(familyOf(container)).toBe(family)
        const root = container.querySelector("[data-component='Select']")
        expect(root?.getAttribute("data-grammar-field")).toBe("true")
        expect(root?.getAttribute("data-grammar-invalid")).toBe("true")
        expect(root?.getAttribute("data-grammar-field-state")).toBe("negative")
        expect(root?.getAttribute("data-grammar-required")).toBe("true")
        const trigger = screen.getByRole("button", { name: /Size/ })
        expect(trigger.getAttribute("data-grammar-field-control")).toBe("true")
        expect(describedTexts(trigger)).toEqual(expect.arrayContaining(["Pick one", "Required"]))
    })

    it("opens from the keyboard inside the family root and selects an option", async () => {
        const onValueChange = vi.fn()
        const { container } = render(<Root><Select label="Size" options={OPTIONS} onValueChange={onValueChange} /></Root>)
        const trigger = screen.getByRole("button", { name: /Size/ })
        await openWithKeyboard(trigger)
        const listbox = await screen.findByRole("listbox")
        // The popover portals into the Grammar root so the family's scoped paint reaches it.
        expect(container.querySelector(".grammar-common-root")?.contains(listbox)).toBe(true)
        const options = within(listbox).getAllByRole("option")
        expect(options).toHaveLength(3)
        expect(options[2]?.getAttribute("aria-disabled")).toBe("true")
        expect(options[1]?.textContent).toContain("Second choice")
        await act(async () => {
            fireEvent.click(options[1]!)
        })
        expect(onValueChange).toHaveBeenCalledWith("two")
        expect(trigger.textContent).toContain("Two")
    })
})

describe("Select states", () => {
    it("is controlled", async () => {
        const Controlled = () => {
            const [value, setValue] = useState<string | null>("one")
            return <><Select label="Size" options={OPTIONS} value={value} onValueChange={setValue} /><output>{value}</output></>
        }
        render(<Controlled />)
        const trigger = screen.getByRole("button", { name: /Size/ })
        expect(trigger.textContent).toContain("One")
        await openWithKeyboard(trigger)
        await act(async () => {
            fireEvent.click(within(await screen.findByRole("listbox")).getAllByRole("option")[1]!)
        })
        expect(screen.getByRole("status").textContent).toBe("two")
    })

    it("disables the trigger", () => {
        const { container } = render(<Select label="Size" options={OPTIONS} isDisabled />)
        expect(screen.getByRole("button", { name: /Size/ }).hasAttribute("disabled")).toBe(true)
        expect(container.querySelector("[data-component='Select']")?.getAttribute("data-grammar-field-state")).toBe("unavailable")
    })

    it("holds the value and never opens when read-only", async () => {
        const onValueChange = vi.fn()
        const { container } = render(<Select label="Size" options={OPTIONS} defaultValue="one" isReadOnly onValueChange={onValueChange} />)
        const trigger = screen.getByRole("button", { name: /Size/ })
        await openWithKeyboard(trigger)
        expect(screen.queryByRole("listbox")).toBeNull()
        expect(trigger.textContent).toContain("One")
        expect(onValueChange).not.toHaveBeenCalled()
        expect(container.querySelector("[data-component='Select']")?.getAttribute("data-grammar-readonly")).toBe("true")
    })

    it("announces pending on the trigger and does not open", async () => {
        const { container } = render(<Select label="Size" options={OPTIONS} isPending />)
        const trigger = screen.getByRole("button", { name: /Size/ })
        expect(trigger.getAttribute("data-pending")).toBe("true")
        expect(trigger.getAttribute("aria-disabled")).toBe("true")
        expect(container.querySelector("[data-component='Select']")?.getAttribute("data-grammar-pending")).toBe("true")
        await openWithKeyboard(trigger)
        expect(screen.queryByRole("listbox")).toBeNull()
    })
})

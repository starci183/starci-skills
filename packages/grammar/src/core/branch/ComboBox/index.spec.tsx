// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FAMILY_ROOTS, describedTexts, familyOf, installOverlayShims } from "../../../__test__/familyRoots.js"
import type { ListOption } from "../Select/index.js"
import { ComboBox } from "./index.js"

installOverlayShims()
afterEach(cleanup)

const OPTIONS: ReadonlyArray<ListOption> = [
    { id: "apple", label: "Apple" },
    { id: "apricot", label: "Apricot" },
    { id: "banana", label: "Banana" },
]

describe.each(FAMILY_ROOTS)("ComboBox under %s", (family, Root) => {
    it("is a labelled combobox that filters while typing and selects with the keyboard", async () => {
        const onValueChange = vi.fn()
        const { container } = render(<Root>
            <ComboBox label="Fruit" options={OPTIONS} description="Type to filter" onValueChange={onValueChange} />
        </Root>)
        expect(familyOf(container)).toBe(family)
        const input = screen.getByRole("combobox", { name: "Fruit" })
        expect(input.getAttribute("aria-expanded")).toBe("false")
        expect(describedTexts(input)).toContain("Type to filter")
        await act(async () => {
            input.focus()
            fireEvent.change(input, { target: { value: "ap" } })
        })
        const listbox = await screen.findByRole("listbox")
        expect(container.querySelector(".grammar-common-root")?.contains(listbox)).toBe(true)
        expect(within(listbox).getAllByRole("option").map((option) => option.textContent)).toEqual(["Apple", "Apricot"])
        await act(async () => {
            fireEvent.keyDown(input, { key: "ArrowDown" })
            fireEvent.keyDown(input, { key: "Enter" })
        })
        expect(onValueChange).toHaveBeenCalledWith("apple")
        expect((input as HTMLInputElement).value).toBe("Apple")
    })
})

describe("ComboBox states", () => {
    it("wires the error and the invalid state", () => {
        const { container } = render(<ComboBox label="Fruit" options={OPTIONS} errorMessage="Pick a fruit" />)
        const input = screen.getByRole("combobox", { name: "Fruit" })
        expect(input.getAttribute("aria-invalid")).toBe("true")
        expect(describedTexts(input)).toContain("Pick a fruit")
        expect(container.querySelector("[data-component='ComboBox']")?.getAttribute("data-grammar-field-state")).toBe("negative")
    })

    it("supports controlled input text, read-only and disabled", () => {
        render(<>
            <ComboBox label="Controlled" options={OPTIONS} inputValue="Ban" onInputChange={() => undefined} />
            <ComboBox label="Fixed" options={OPTIONS} defaultValue="banana" isReadOnly />
            <ComboBox label="Off" options={OPTIONS} isDisabled />
        </>)
        expect((screen.getByRole("combobox", { name: "Controlled" }) as HTMLInputElement).value).toBe("Ban")
        const fixed = screen.getByRole("combobox", { name: "Fixed" }) as HTMLInputElement
        expect(fixed.readOnly).toBe(true)
        expect(fixed.value).toBe("Banana")
        expect((screen.getByRole("combobox", { name: "Off" }) as HTMLInputElement).disabled).toBe(true)
    })

    it("marks pending as busy while keeping the input editable", () => {
        const { container } = render(<ComboBox label="Fruit" options={[]} isPending />)
        const input = screen.getByRole("combobox", { name: "Fruit" }) as HTMLInputElement
        expect(input.getAttribute("aria-busy")).toBe("true")
        expect(input.disabled).toBe(false)
        expect(container.querySelector("[data-component='ComboBox']")?.getAttribute("data-grammar-pending")).toBe("true")
    })
})

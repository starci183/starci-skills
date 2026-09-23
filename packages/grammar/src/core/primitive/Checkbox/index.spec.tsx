// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FAMILY_ROOTS, describedTexts, familyOf } from "../../../__test__/familyRoots.js"
import { Checkbox } from "./index.js"

afterEach(cleanup)

describe.each(FAMILY_ROOTS)("Checkbox under %s", (family, Root) => {
    it("is a labelled checkbox whose label is part of the hit area", async () => {
        const onSelectedChange = vi.fn()
        const { container } = render(<Root>
            <Checkbox label="Accept" description="Required to continue" onSelectedChange={onSelectedChange} name="accept" value="yes" />
        </Root>)
        expect(familyOf(container)).toBe(family)
        const box = screen.getByRole("checkbox", { name: "Accept" }) as HTMLInputElement
        expect(box.name).toBe("accept")
        expect(box.value).toBe("yes")
        expect(describedTexts(box)).toContain("Required to continue")
        const text = screen.getByText("Accept")
        await act(async () => {
            fireEvent.pointerDown(text, { pointerType: "mouse", button: 0, pointerId: 1 })
            fireEvent.pointerUp(text, { pointerType: "mouse", button: 0, pointerId: 1 })
            fireEvent.click(text)
        })
        expect(onSelectedChange).toHaveBeenLastCalledWith(true)
        const root = container.querySelector("[data-component='Checkbox']")
        expect(root?.getAttribute("data-selected")).toBe("true")
        expect(root?.querySelector("[data-grammar-choice-control='checkbox']")).not.toBeNull()
    })
})

describe("Checkbox states", () => {
    it("is controlled", () => {
        const Controlled = () => {
            const [on, setOn] = useState(true)
            return <><Checkbox label="Keep" isSelected={on} onSelectedChange={setOn} /><output>{String(on)}</output></>
        }
        render(<Controlled />)
        const box = screen.getByRole("checkbox", { name: "Keep" }) as HTMLInputElement
        expect(box.checked).toBe(true)
        fireEvent.click(box)
        expect(screen.getByRole("status").textContent).toBe("false")
        expect(box.checked).toBe(false)
    })

    it("announces mixed, invalid, disabled and read-only", () => {
        render(<>
            <Checkbox label="All" isIndeterminate />
            <Checkbox label="Terms" errorMessage="Accept the terms" isRequired />
            <Checkbox label="Off" isDisabled />
            <Checkbox label="Fixed" isReadOnly defaultSelected />
        </>)
        expect((screen.getByRole("checkbox", { name: "All" }) as HTMLInputElement).indeterminate).toBe(true)
        const terms = screen.getByRole("checkbox", { name: "Terms" })
        expect(terms.getAttribute("aria-invalid")).toBe("true")
        expect(describedTexts(terms)).toContain("Accept the terms")
        expect((screen.getByRole("checkbox", { name: "Off" }) as HTMLInputElement).disabled).toBe(true)
        const fixed = screen.getByRole("checkbox", { name: "Fixed" }) as HTMLInputElement
        fireEvent.click(fixed)
        expect(fixed.checked).toBe(true)
    })
})

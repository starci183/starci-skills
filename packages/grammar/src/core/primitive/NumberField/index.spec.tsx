// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FAMILY_ROOTS, describedTexts, familyOf } from "../../../__test__/familyRoots.js"
import { NumberField } from "./index.js"

afterEach(cleanup)

describe.each(FAMILY_ROOTS)("NumberField under %s", (family, Root) => {
    it("steps with the arrow keys and the named stepper buttons, clamped to its range", () => {
        const onValueChange = vi.fn()
        const { container } = render(<Root>
            <NumberField label="Seats" defaultValue={2} minValue={1} maxValue={3} description="Up to three" onValueChange={onValueChange} />
        </Root>)
        expect(familyOf(container)).toBe(family)
        const input = screen.getByRole("textbox", { name: "Seats" }) as HTMLInputElement
        expect(describedTexts(input)).toContain("Up to three")
        fireEvent.keyDown(input, { key: "ArrowUp" })
        expect(onValueChange).toHaveBeenLastCalledWith(3)
        expect(input.value).toBe("3")
        const increase = screen.getByRole("button", { name: /Increase/ })
        expect(increase.hasAttribute("disabled")).toBe(true)
        expect(screen.getByRole("button", { name: /Decrease/ })).toBeTruthy()
    })
})

describe("NumberField states", () => {
    it("is controlled", () => {
        const Controlled = () => {
            const [value, setValue] = useState(5)
            return <><NumberField label="Count" value={value} onValueChange={setValue} /><output>{value}</output></>
        }
        render(<Controlled />)
        fireEvent.keyDown(screen.getByRole("textbox", { name: "Count" }), { key: "ArrowDown" })
        expect(screen.getByRole("status").textContent).toBe("4")
    })

    it("carries invalid, disabled, read-only and hidden steppers", () => {
        render(<>
            <NumberField label="Bad" errorMessage="Too many" />
            <NumberField label="Off" isDisabled />
            <NumberField label="Fixed" isReadOnly defaultValue={1} hideSteppers />
        </>)
        const bad = screen.getByRole("textbox", { name: "Bad" })
        expect(bad.getAttribute("aria-invalid")).toBe("true")
        expect(describedTexts(bad)).toContain("Too many")
        expect((screen.getByRole("textbox", { name: "Off" }) as HTMLInputElement).disabled).toBe(true)
        expect((screen.getByRole("textbox", { name: "Fixed" }) as HTMLInputElement).readOnly).toBe(true)
        expect(screen.queryAllByRole("button", { name: /Fixed/ })).toHaveLength(0)
    })
})

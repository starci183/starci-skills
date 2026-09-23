// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FAMILY_ROOTS, describedTexts, familyOf } from "../../../__test__/familyRoots.js"
import type { ChoiceOption } from "../CheckboxGroup/index.js"
import { RadioGroup } from "./index.js"

afterEach(cleanup)

const OPTIONS: ReadonlyArray<ChoiceOption> = [
    { value: "s", label: "Small" },
    { value: "m", label: "Medium" },
    { value: "l", label: "Large", isDisabled: true },
]

describe.each(FAMILY_ROOTS)("RadioGroup under %s", (family, Root) => {
    it("is a labelled radiogroup with one tab stop and arrow-key selection", async () => {
        const onValueChange = vi.fn()
        const { container } = render(<Root>
            <RadioGroup label="Size" description="Choose one" options={OPTIONS} defaultValue="s" onValueChange={onValueChange} />
        </Root>)
        expect(familyOf(container)).toBe(family)
        const group = screen.getByRole("radiogroup", { name: "Size" })
        expect(describedTexts(group)).toContain("Choose one")
        const radios = within(group).getAllByRole("radio") as Array<HTMLInputElement>
        expect(radios.slice(0, 2).map((radio) => radio.tabIndex)).toEqual([0, -1])
        await act(async () => {
            radios[0]!.focus()
            fireEvent.keyDown(radios[0]!, { key: "ArrowDown" })
        })
        expect(onValueChange).toHaveBeenLastCalledWith("m")
        expect(radios[1]?.checked).toBe(true)
        expect(radios[2]?.disabled).toBe(true)
    })
})

describe("RadioGroup states", () => {
    it("is controlled", () => {
        const Controlled = () => {
            const [value, setValue] = useState("m")
            return <><RadioGroup label="Size" options={OPTIONS} value={value} onValueChange={setValue} /><output>{value}</output></>
        }
        render(<Controlled />)
        expect((screen.getByRole("radio", { name: "Medium" }) as HTMLInputElement).checked).toBe(true)
        fireEvent.click(screen.getByRole("radio", { name: "Small" }))
        expect(screen.getByRole("status").textContent).toBe("s")
    })

    it("carries invalid, required, disabled, read-only and orientation", () => {
        render(<>
            <RadioGroup label="Bad" options={OPTIONS} errorMessage="Required" isRequired orientation="horizontal" />
            <RadioGroup label="Off" options={OPTIONS} isDisabled />
            <RadioGroup label="Fixed" options={OPTIONS} isReadOnly defaultValue="s" />
        </>)
        const bad = screen.getByRole("radiogroup", { name: "Bad" })
        expect(bad.getAttribute("aria-invalid")).toBe("true")
        expect(bad.getAttribute("aria-required")).toBe("true")
        expect(bad.getAttribute("aria-orientation")).toBe("horizontal")
        expect(describedTexts(bad)).toContain("Required")
        expect(screen.getByRole("radiogroup", { name: "Off" }).getAttribute("aria-disabled")).toBe("true")
        const fixed = screen.getByRole("radiogroup", { name: "Fixed" })
        expect(fixed.getAttribute("aria-readonly")).toBe("true")
        fireEvent.click(within(fixed).getByRole("radio", { name: "Medium" }))
        expect((within(fixed).getByRole("radio", { name: "Small" }) as HTMLInputElement).checked).toBe(true)
    })
})

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FAMILY_ROOTS, describedTexts, familyOf } from "../../../__test__/grammarRoots.js"
import { CheckboxGroup, type ChoiceOption } from "./index.js"

afterEach(cleanup)

const OPTIONS: ReadonlyArray<ChoiceOption> = [
    { value: "email", label: "Email" },
    { value: "sms", label: "SMS", description: "Carrier rates apply" },
    { value: "push", label: "Push", isDisabled: true },
]

describe.each(FAMILY_ROOTS)("CheckboxGroup under %s", (family, Root) => {
    it("is a labelled group of checkboxes collecting several values", () => {
        const onValueChange = vi.fn()
        const { container } = render(<Root>
            <CheckboxGroup label="Channels" description="Pick any" options={OPTIONS} defaultValue={["email"]} onValueChange={onValueChange} name="channels" />
        </Root>)
        expect(familyOf(container)).toBe(family)
        const group = screen.getByRole("group", { name: "Channels" })
        expect(describedTexts(group)).toContain("Pick any")
        const boxes = within(group).getAllByRole("checkbox") as Array<HTMLInputElement>
        expect(boxes.map((box) => box.checked)).toEqual([true, false, false])
        expect(boxes[2]?.disabled).toBe(true)
        expect(boxes.every((box) => box.name === "channels")).toBe(true)
        fireEvent.click(boxes[1]!)
        expect(onValueChange).toHaveBeenLastCalledWith(["email", "sms"])
        expect(container.querySelector("[data-component='CheckboxGroup']")?.getAttribute("data-grammar-orientation")).toBe("vertical")
    })
})

describe("CheckboxGroup states", () => {
    it("is controlled", () => {
        const Controlled = () => {
            const [value, setValue] = useState<ReadonlyArray<string>>(["sms"])
            return <><CheckboxGroup label="Channels" options={OPTIONS} value={value} onValueChange={setValue} /><output>{value.join(",")}</output></>
        }
        render(<Controlled />)
        fireEvent.click(screen.getByRole("checkbox", { name: "Email" }))
        expect(screen.getByRole("status").textContent).toBe("sms,email")
    })

    it("owns one error slot and carries invalid, disabled and read-only", () => {
        const { container } = render(<>
            <CheckboxGroup label="Bad" options={OPTIONS} errorMessage="Pick one" isRequired orientation="horizontal" />
            <CheckboxGroup label="Off" options={OPTIONS} isDisabled />
            <CheckboxGroup label="Fixed" options={OPTIONS} isReadOnly defaultValue={["email"]} />
        </>)
        const bad = screen.getByRole("group", { name: "Bad" })
        expect(bad.getAttribute("data-invalid")).toBe("true")
        expect(describedTexts(bad)).toContain("Pick one")
        expect(bad.querySelectorAll("[data-grammar-field-error]")).toHaveLength(1)
        const off = screen.getByRole("group", { name: "Off" })
        expect((within(off).getAllByRole("checkbox") as Array<HTMLInputElement>).every((box) => box.disabled)).toBe(true)
        const fixed = within(screen.getByRole("group", { name: "Fixed" })).getByRole("checkbox", { name: "SMS" }) as HTMLInputElement
        fireEvent.click(fixed)
        expect(fixed.checked).toBe(false)
        expect(container.querySelector("[data-grammar-orientation='horizontal']")).not.toBeNull()
    })
})

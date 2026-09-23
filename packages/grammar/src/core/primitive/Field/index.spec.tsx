// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { FAMILY_ROOTS, describedTexts, familyOf } from "../../../__test__/familyRoots.js"
import { Field, fieldPresentationState } from "./index.js"

afterEach(cleanup)

describe.each(FAMILY_ROOTS)("Field under %s", (family, Root) => {
    it("labels a native control and wires description and error into it", () => {
        const { container } = render(<Root>
            <Field label="Nickname" description="Shown to others" errorMessage="Too short" isRequired name="nick">
                {(control) => <input {...control} />}
            </Field>
        </Root>)
        expect(familyOf(container)).toBe(family)
        const input = screen.getByRole("textbox", { name: /Nickname/ })
        expect(input.getAttribute("name")).toBe("nick")
        expect(input.getAttribute("aria-invalid")).toBe("true")
        expect(input.getAttribute("aria-required")).toBe("true")
        expect(input.hasAttribute("required")).toBe(true)
        expect(describedTexts(input)).toEqual(["Shown to others", "Too short"])
        const root = container.querySelector("[data-component='Field']")
        expect(root?.getAttribute("data-grammar-field-state")).toBe("negative")
        expect(root?.querySelector("[data-grammar-field-error]")?.textContent).toBe("Too short")
    })

    it("works for any element: select, disabled and read-only", () => {
        render(<Root>
            <Field label="Plan" isDisabled>{(control) => <select {...control}><option>A</option></select>}</Field>
            <Field label="Code" isReadOnly id="code">{(control) => <input {...control} />}</Field>
        </Root>)
        expect((screen.getByRole("combobox", { name: "Plan" }) as HTMLSelectElement).disabled).toBe(true)
        const code = screen.getByRole("textbox", { name: "Code" })
        expect(code.id).toBe("code")
        expect(code.hasAttribute("readonly")).toBe(true)
        expect(code.hasAttribute("aria-describedby")).toBe(false)
    })
})

describe("Field contract", () => {
    it("keeps the label for assistive technology when hidden", () => {
        const { container } = render(<Field label="Search" isLabelHidden>{(control) => <input {...control} />}</Field>)
        expect(screen.getByRole("textbox", { name: "Search" })).toBeTruthy()
        expect(container.querySelector("[data-grammar-field-label]")?.className).toContain("starci-core-form-label--screen-reader")
    })

    it("folds state into the presentation vocabulary", () => {
        expect(fieldPresentationState({})).toBe("neutral")
        expect(fieldPresentationState({ isInvalid: true })).toBe("negative")
        expect(fieldPresentationState({ isPending: true, isInvalid: true })).toBe("pending")
        expect(fieldPresentationState({ isDisabled: true, isInvalid: true })).toBe("unavailable")
    })
})

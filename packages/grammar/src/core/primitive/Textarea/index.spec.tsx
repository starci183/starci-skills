// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FAMILY_ROOTS, describedTexts, familyOf } from "../../../__test__/familyRoots.js"
import { Textarea } from "./index.js"

afterEach(cleanup)

describe.each(FAMILY_ROOTS)("Textarea under %s", (family, Root) => {
    it("is a labelled multi-line textbox with guidance, error and a live count", () => {
        const onValueChange = vi.fn()
        const { container } = render(<Root>
            <Textarea label="Bio" description="Short intro" errorMessage="Required" maxLength={20} rows={3} onValueChange={onValueChange} isRequired />
        </Root>)
        expect(familyOf(container)).toBe(family)
        const textarea = screen.getByRole("textbox", { name: /Bio/ }) as HTMLTextAreaElement
        expect(textarea.tagName).toBe("TEXTAREA")
        expect(textarea.rows).toBe(3)
        expect(textarea.maxLength).toBe(20)
        expect(textarea.getAttribute("aria-invalid")).toBe("true")
        expect(describedTexts(textarea)).toEqual(expect.arrayContaining(["Short intro", "Required"]))
        fireEvent.change(textarea, { target: { value: "hello" } })
        expect(onValueChange).toHaveBeenCalledWith("hello")
        expect(container.querySelector("[data-grammar-field-count]")?.textContent).toBe("5/20")
        expect(container.querySelector("[data-component='Textarea']")?.getAttribute("data-grammar-invalid")).toBe("true")
    })
})

describe("Textarea states", () => {
    it("is controlled", () => {
        const Controlled = () => {
            const [value, setValue] = useState("ab")
            return <Textarea label="Note" value={value} onValueChange={(next) => setValue(next.toUpperCase())} maxLength={5} />
        }
        const { container } = render(<Controlled />)
        const textarea = screen.getByRole("textbox", { name: "Note" }) as HTMLTextAreaElement
        fireEvent.change(textarea, { target: { value: "abc" } })
        expect(textarea.value).toBe("ABC")
        expect(container.querySelector("[data-grammar-field-count]")?.textContent).toBe("3/5")
    })

    it("carries disabled and read-only to the element", () => {
        render(<>
            <Textarea label="Off" isDisabled />
            <Textarea label="Fixed" isReadOnly defaultValue="kept" />
        </>)
        expect((screen.getByRole("textbox", { name: "Off" }) as HTMLTextAreaElement).disabled).toBe(true)
        const fixed = screen.getByRole("textbox", { name: "Fixed" }) as HTMLTextAreaElement
        expect(fixed.readOnly).toBe(true)
        expect(fixed.value).toBe("kept")
    })
})

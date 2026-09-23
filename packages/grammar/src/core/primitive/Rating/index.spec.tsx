// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FAMILY_WRAPS, expectedFamilyScope } from "../../../__test__/grammarRoots.js"
import { Rating } from "./index.js"

afterEach(cleanup)

const valueLabel = (value: number, max: number) => `${value} of ${max}`

describe.each(FAMILY_WRAPS)("Rating under %s", (family, wrap) => {
    it("is a native radio group with one named option per position", () => {
        render(wrap(<Rating label="Quality" defaultValue={3} valueLabel={valueLabel} />))
        expect(screen.getByTestId("grammar-root").getAttribute("data-grammar-family")).toBe(expectedFamilyScope(family))
        const group = screen.getByRole("radiogroup", { name: "Quality" })
        expect(group.getAttribute("data-component")).toBe("Rating")
        expect(group.getAttribute("data-grammar-rating-mode")).toBe("interactive")
        const options = screen.getAllByRole("radio")
        expect(options).toHaveLength(5)
        expect((screen.getByRole("radio", { name: "3 of 5" }) as HTMLInputElement).checked).toBe(true)
        const fills = [...group.querySelectorAll("[data-grammar-rating-fill]")].map((node) => node.getAttribute("data-grammar-rating-fill"))
        expect(fills).toEqual(["full", "full", "full", "empty", "empty"])
        expect(group.querySelector("[data-grammar-selected='true'] input")).toBe(screen.getByRole("radio", { name: "3 of 5" }))
    })

    it("changes uncontrolled and reports the chosen value", () => {
        const onChange = vi.fn()
        render(wrap(<Rating label="Quality" valueLabel={valueLabel} onChange={onChange} />))
        fireEvent.click(screen.getByRole("radio", { name: "4 of 5" }))
        expect(onChange).toHaveBeenCalledWith(4)
        expect((screen.getByRole("radio", { name: "4 of 5" }) as HTMLInputElement).checked).toBe(true)
    })

    it("stays controlled by its value", () => {
        const Controlled = () => {
            const [value, setValue] = useState(1)
            return <Rating label="Quality" value={value} onChange={setValue} max={3} valueLabel={valueLabel} />
        }
        render(wrap(<Controlled />))
        fireEvent.click(screen.getByRole("radio", { name: "3 of 3" }))
        expect((screen.getByRole("radio", { name: "3 of 3" }) as HTMLInputElement).checked).toBe(true)
        expect(screen.getAllByRole("radio")).toHaveLength(3)
    })

    it("disables every option", () => {
        render(wrap(<Rating label="Quality" valueLabel={valueLabel} isDisabled />))
        for (const option of screen.getAllByRole("radio")) expect((option as HTMLInputElement).disabled).toBe(true)
        expect(screen.getByRole("radiogroup").getAttribute("data-grammar-disabled")).toBe("true")
    })

    it("renders read-only values, including halves, as one labelled image", () => {
        render(wrap(<Rating label="Average" value={3.5} isReadOnly valueLabel={valueLabel} />))
        const image = screen.getByRole("img", { name: "Average: 3.5 of 5" })
        expect(image.getAttribute("data-grammar-rating-mode")).toBe("read-only")
        expect(screen.queryAllByRole("radio")).toHaveLength(0)
        const fills = [...image.querySelectorAll("[data-grammar-rating-fill]")].map((node) => node.getAttribute("data-grammar-rating-fill"))
        expect(fills).toEqual(["full", "full", "full", "half", "empty"])
    })
})

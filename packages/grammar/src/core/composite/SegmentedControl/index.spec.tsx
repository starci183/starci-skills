// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FAMILY_ROOTS, describedTexts, familyOf } from "../../../__test__/familyRoots.js"
import { SegmentedControl, type SegmentOption } from "./index.js"

afterEach(cleanup)

const OPTIONS: ReadonlyArray<SegmentOption> = [
    { value: "day", label: "Day" },
    { value: "week", label: "Week" },
    { value: "month", label: "Month", isDisabled: true },
]

const press = async (element: HTMLElement) => {
    await act(async () => {
        fireEvent.pointerDown(element, { pointerType: "mouse", button: 0, pointerId: 1 })
        fireEvent.pointerUp(element, { pointerType: "mouse", button: 0, pointerId: 1 })
        fireEvent.click(element)
    })
}

describe.each(FAMILY_ROOTS)("SegmentedControl under %s", (family, Root) => {
    it("is a labelled radiogroup of segments that never deselects", async () => {
        const onValueChange = vi.fn()
        const { container } = render(<Root>
            <SegmentedControl label="Range" description="Chart period" options={OPTIONS} defaultValue="day" onValueChange={onValueChange} name="range" />
        </Root>)
        expect(familyOf(container)).toBe(family)
        const group = screen.getByRole("radiogroup", { name: "Range" })
        expect(describedTexts(group)).toContain("Chart period")
        const segments = within(group).getAllByRole("radio")
        expect(segments.map((segment) => segment.getAttribute("aria-checked"))).toEqual(["true", "false", "false"])
        await press(segments[1]!)
        expect(onValueChange).toHaveBeenLastCalledWith("week")
        await press(segments[1]!)
        expect(segments[1]?.getAttribute("aria-checked")).toBe("true")
        expect((container.querySelector("input[type='hidden'][name='range']") as HTMLInputElement).value).toBe("week")
        expect(segments[2]?.hasAttribute("disabled")).toBe(true)
    })
})

describe("SegmentedControl states", () => {
    it("is controlled", async () => {
        const Controlled = () => {
            const [value, setValue] = useState("week")
            return <><SegmentedControl label="Range" options={OPTIONS} value={value} onValueChange={setValue} /><output>{value}</output></>
        }
        render(<Controlled />)
        await press(screen.getByRole("radio", { name: "Day" }))
        expect(screen.getByRole("status").textContent).toBe("day")
    })

    it("holds the value when read-only and carries disabled, invalid and fill width", async () => {
        const { container } = render(<>
            <SegmentedControl label="Fixed" options={OPTIONS} defaultValue="day" isReadOnly />
            <SegmentedControl label="Off" options={OPTIONS} isDisabled />
            <SegmentedControl label="Bad" options={OPTIONS} errorMessage="Pick again" width="fill" />
        </>)
        const fixed = screen.getByRole("radiogroup", { name: "Fixed" })
        await press(within(fixed).getByRole("radio", { name: "Week" }))
        expect(within(fixed).getByRole("radio", { name: "Day" }).getAttribute("aria-checked")).toBe("true")
        expect(within(screen.getByRole("radiogroup", { name: "Off" })).getAllByRole("radio").every((segment) => segment.hasAttribute("disabled"))).toBe(true)
        expect(describedTexts(screen.getByRole("radiogroup", { name: "Bad" }))).toContain("Pick again")
        expect(container.querySelector("[data-component='SegmentedControl'][data-width='fill']")?.getAttribute("data-grammar-invalid")).toBe("true")
    })
})

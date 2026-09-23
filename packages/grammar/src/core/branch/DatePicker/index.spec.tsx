// @vitest-environment jsdom
import { parseDate } from "@internationalized/date"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { DateValue } from "@heroui/react"
import { FAMILY_ROOTS, describedTexts, familyOf, installOverlayShims } from "../../../__test__/familyRoots.js"
import { DatePicker } from "./index.js"

installOverlayShims()
afterEach(cleanup)

const day = (grid: HTMLElement, text: string) =>
    within(grid).getAllByRole("button").find((cell) => cell.textContent === text && cell.getAttribute("aria-disabled") !== "true")
        ?? within(grid).getAllByRole("button").find((cell) => cell.textContent === text)!

const press = async (element: HTMLElement) => {
    await act(async () => {
        fireEvent.pointerDown(element, { pointerType: "mouse", button: 0, pointerId: 1 })
        fireEvent.pointerUp(element, { pointerType: "mouse", button: 0, pointerId: 1 })
        fireEvent.click(element)
    })
}

describe.each(FAMILY_ROOTS)("DatePicker under %s", (family, Root) => {
    it("opens a month grid dialog from its named trigger and picks a day", async () => {
        const onValueChange = vi.fn()
        const { container } = render(<Root>
            <DatePicker label="Start" description="First day" defaultValue={parseDate("2024-06-10")} onValueChange={onValueChange} />
        </Root>)
        expect(familyOf(container)).toBe(family)
        const group = screen.getByRole("group", { name: "Start" })
        expect(describedTexts(within(group).getAllByRole("spinbutton")[0]!)).toContain("First day")
        const trigger = within(group).getByRole("button")
        expect(trigger.getAttribute("aria-haspopup")).toBe("dialog")
        expect(trigger.getAttribute("aria-label")).toBeTruthy()
        await press(trigger)
        const dialog = await screen.findByRole("dialog")
        expect(container.querySelector(".grammar-common-root")?.contains(dialog)).toBe(true)
        const grid = within(dialog).getByRole("grid")
        const twelfth = day(grid, "12")
        await press(twelfth)
        expect(String(onValueChange.mock.lastCall?.[0])).toBe("2024-06-12")
    })
})

describe("DatePicker states", () => {
    it("is controlled and marks unavailable days", async () => {
        const Controlled = () => {
            const [value, setValue] = useState<DateValue | null>(parseDate("2024-06-10"))
            return <>
                <DatePicker label="Due" value={value} onValueChange={setValue} isDateUnavailable={(date) => date.day === 15} />
                <output>{String(value)}</output>
            </>
        }
        render(<Controlled />)
        await press(within(screen.getByRole("group", { name: "Due" })).getByRole("button"))
        const grid = within(await screen.findByRole("dialog")).getByRole("grid")
        const fifteenth = day(grid, "15")
        expect(fifteenth.getAttribute("aria-disabled")).toBe("true")
        await press(day(grid, "20"))
        expect(screen.getByRole("status").textContent).toBe("2024-06-20")
    })

    it("carries invalid, disabled and read-only", () => {
        const { container } = render(<>
            <DatePicker label="Bad" errorMessage="In the past" />
            <DatePicker label="Off" isDisabled />
            <DatePicker label="Fixed" isReadOnly defaultValue={parseDate("2024-01-01")} />
        </>)
        expect(describedTexts(within(screen.getByRole("group", { name: "Bad" })).getAllByRole("spinbutton")[0]!)).toContain("In the past")
        expect(within(screen.getByRole("group", { name: "Off" })).getByRole("button").hasAttribute("disabled")).toBe(true)
        expect(within(screen.getByRole("group", { name: "Fixed" })).getAllByRole("spinbutton").every((segment) => segment.getAttribute("aria-readonly") === "true")).toBe(true)
        expect(container.querySelector("[data-component='DatePicker'][data-grammar-field-state='negative']")).not.toBeNull()
    })
})

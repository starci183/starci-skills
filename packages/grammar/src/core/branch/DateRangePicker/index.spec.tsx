// @vitest-environment jsdom
import { parseDate } from "@internationalized/date"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FAMILY_ROOTS, describedTexts, familyOf, installOverlayShims } from "../../../__test__/familyRoots.js"
import { DateRangePicker, type DateRangeValue } from "./index.js"

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

const RANGE = { start: parseDate("2024-06-10"), end: parseDate("2024-06-12") }

describe.each(FAMILY_ROOTS)("DateRangePicker under %s", (family, Root) => {
    it("types a start and an end, and picks a span on the range grid", async () => {
        const onValueChange = vi.fn()
        const { container } = render(<Root>
            <DateRangePicker label="Stay" description="Check-in to check-out" defaultValue={RANGE} onValueChange={onValueChange} startName="from" endName="to" />
        </Root>)
        expect(familyOf(container)).toBe(family)
        const group = screen.getByRole("group", { name: "Stay" })
        const segments = within(group).getAllByRole("spinbutton")
        expect(segments).toHaveLength(6)
        expect(segments[0]?.getAttribute("aria-label")).toMatch(/Start/)
        expect(segments[3]?.getAttribute("aria-label")).toMatch(/End/)
        expect(describedTexts(segments[0]!)).toContain("Check-in to check-out")
        expect(container.querySelector("input[name='from']")).not.toBeNull()
        await press(within(group).getByRole("button"))
        const dialog = await screen.findByRole("dialog")
        expect(container.querySelector(".grammar-common-root")?.contains(dialog)).toBe(true)
        const grid = within(dialog).getByRole("grid")
        await press(day(grid, "20"))
        await press(day(grid, "22"))
        const range = onValueChange.mock.lastCall?.[0] as DateRangeValue
        expect([String(range.start), String(range.end)]).toEqual(["2024-06-20", "2024-06-22"])
    })
})

describe("DateRangePicker states", () => {
    it("is controlled", async () => {
        const Controlled = () => {
            const [value, setValue] = useState<DateRangeValue | null>(RANGE)
            return <><DateRangePicker label="Trip" value={value} onValueChange={setValue} /><output>{value === null ? "" : `${String(value.start)}/${String(value.end)}`}</output></>
        }
        render(<Controlled />)
        const day = within(screen.getByRole("group", { name: "Trip" })).getAllByRole("spinbutton").filter((segment) => segment.getAttribute("data-type") === "day")[1]!
        await act(async () => {
            day.focus()
            fireEvent.keyDown(day, { key: "ArrowUp" })
        })
        expect(screen.getByRole("status").textContent).toBe("2024-06-10/2024-06-13")
    })

    it("carries invalid, disabled and read-only", () => {
        const { container } = render(<>
            <DateRangePicker label="Bad" errorMessage="End before start" />
            <DateRangePicker label="Off" isDisabled />
            <DateRangePicker label="Fixed" isReadOnly defaultValue={RANGE} />
        </>)
        expect(describedTexts(within(screen.getByRole("group", { name: "Bad" })).getAllByRole("spinbutton")[0]!)).toContain("End before start")
        expect(within(screen.getByRole("group", { name: "Off" })).getByRole("button").hasAttribute("disabled")).toBe(true)
        expect(within(screen.getByRole("group", { name: "Fixed" })).getAllByRole("spinbutton").every((segment) => segment.getAttribute("aria-readonly") === "true")).toBe(true)
        expect(container.querySelector("[data-component='DateRangePicker'][data-grammar-invalid='true']")).not.toBeNull()
    })
})

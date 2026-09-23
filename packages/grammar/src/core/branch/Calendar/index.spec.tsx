// @vitest-environment jsdom
import { CalendarDate } from "@internationalized/date"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import type { DateValue } from "@heroui/react"
import { FAMILY_ROOTS, expectedFamilyScope, installVendorDomStubs } from "../../../__test__/navigationFamilies.js"
import { Calendar } from "./index.js"

beforeAll(installVendorDomStubs)
afterEach(cleanup)

const navLabels = { previousLabel: "Previous month", nextLabel: "Next month" }

const selectedDay = () => document.querySelector("[aria-selected='true']")

describe.each(FAMILY_ROOTS)("Calendar under %s", (family, wrap) => {
    it("renders a named month grid with navigation buttons", () => {
        render(wrap(<Calendar label="Delivery date" defaultValue={new CalendarDate(2026, 3, 10)} {...navLabels} />))
        expect(screen.getByTestId("grammar-root").getAttribute("data-grammar-family")).toBe(expectedFamilyScope(family))
        const root = document.querySelector("[data-component='Calendar']")
        expect(root).not.toBeNull()
        expect(screen.getByRole("grid")).not.toBeNull()
        expect(screen.getByRole("button", { name: "Previous month" })).not.toBeNull()
        expect(screen.getByRole("button", { name: "Next month" })).not.toBeNull()
        expect(selectedDay()?.textContent).toBe("10")
        expect(document.querySelectorAll("[data-grammar-calendar-day]").length).toBeGreaterThanOrEqual(28)
    })

    it("selects a day by pointer and by keyboard", () => {
        const onChange = vi.fn()
        const Controlled = () => {
            const [value, setValue] = useState<DateValue>(new CalendarDate(2026, 3, 10))
            return <Calendar label="Date" value={value} onChange={(next) => { setValue(next); onChange(next) }} {...navLabels} />
        }
        render(wrap(<Controlled />))
        fireEvent.click(screen.getByRole("button", { name: /March 12, 2026/ }))
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ year: 2026, month: 3, day: 12 }))
        expect(selectedDay()?.textContent).toBe("12")
        const focused = screen.getByRole("button", { name: /March 12, 2026/ })
        focused.focus()
        fireEvent.keyDown(focused, { key: "ArrowRight" })
        const next = document.activeElement as HTMLElement
        expect(next.textContent).toBe("13")
        fireEvent.keyDown(next, { key: "Enter" })
        fireEvent.keyUp(next, { key: "Enter" })
        expect(selectedDay()?.textContent).toBe("13")
    })

    it("pages months with the navigation buttons and refuses unavailable dates", () => {
        const onChange = vi.fn()
        render(wrap(<Calendar label="Date" defaultValue={new CalendarDate(2026, 3, 10)} onChange={onChange}
            isDateUnavailable={(date) => date.day === 15} {...navLabels} />))
        fireEvent.click(screen.getByRole("button", { name: /March 15, 2026/ }))
        expect(onChange).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole("button", { name: "Next month" }))
        expect(screen.getByRole("button", { name: /April 1, 2026/ })).not.toBeNull()
    })
})

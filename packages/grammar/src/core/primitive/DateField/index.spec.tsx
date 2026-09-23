// @vitest-environment jsdom
import { parseDate } from "@internationalized/date"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { DateValue } from "@heroui/react"
import { FAMILY_ROOTS, describedTexts, familyOf } from "../../../__test__/grammarRoots.js"
import { DateField } from "./index.js"

afterEach(cleanup)

describe.each(FAMILY_ROOTS)("DateField under %s", (family, Root) => {
    it("is one labelled group of spinbutton segments stepped by the arrow keys", async () => {
        const onValueChange = vi.fn()
        const { container } = render(<Root>
            <DateField label="Birthday" description="Day, month, year" defaultValue={parseDate("2024-03-10")} onValueChange={onValueChange} />
        </Root>)
        expect(familyOf(container)).toBe(family)
        const groups = screen.getAllByRole("group", { name: "Birthday" })
        // Exactly one labelled group: the standalone box is not a second vendor Group.
        expect(groups).toHaveLength(1)
        const segments = within(groups[0]!).getAllByRole("spinbutton")
        expect(segments).toHaveLength(3)
        expect(describedTexts(segments[0]!)).toContain("Day, month, year")
        const day = segments.find((segment) => segment.getAttribute("data-type") === "day")!
        await act(async () => {
            day.focus()
            fireEvent.keyDown(day, { key: "ArrowUp" })
        })
        expect(String(onValueChange.mock.lastCall?.[0])).toBe("2024-03-11")
        expect(new Set(Array.from(container.querySelectorAll("[id]"), (node) => node.id)).size)
            .toBe(container.querySelectorAll("[id]").length)
    })
})

describe("DateField states", () => {
    it("is controlled", async () => {
        const Controlled = () => {
            const [value, setValue] = useState<DateValue | null>(parseDate("2024-01-10"))
            return <><DateField label="When" value={value} onValueChange={setValue} /><output>{String(value)}</output></>
        }
        render(<Controlled />)
        const month = screen.getAllByRole("spinbutton").find((segment) => segment.getAttribute("data-type") === "month")!
        await act(async () => {
            month.focus()
            fireEvent.keyDown(month, { key: "ArrowUp" })
        })
        expect(screen.getByRole("status").textContent).toBe("2024-02-10")
    })

    it("carries invalid, disabled and read-only to the segments", () => {
        const { container } = render(<>
            <DateField label="Bad" errorMessage="Too early" />
            <DateField label="Off" isDisabled />
            <DateField label="Fixed" isReadOnly defaultValue={parseDate("2024-05-05")} />
        </>)
        const bad = screen.getByRole("group", { name: "Bad" })
        expect(describedTexts(within(bad).getAllByRole("spinbutton")[0]!)).toContain("Too early")
        expect(within(screen.getByRole("group", { name: "Off" })).getAllByRole("spinbutton").every((segment) => segment.getAttribute("aria-disabled") === "true")).toBe(true)
        expect(within(screen.getByRole("group", { name: "Fixed" })).getAllByRole("spinbutton").every((segment) => segment.getAttribute("aria-readonly") === "true")).toBe(true)
        expect(container.querySelector("[data-component='DateField'][data-grammar-invalid='true'] [data-grammar-field-control][data-invalid='true']")).not.toBeNull()
    })
})

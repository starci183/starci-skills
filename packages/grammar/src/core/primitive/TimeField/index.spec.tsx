// @vitest-environment jsdom
import { Time } from "@internationalized/date"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { TimeValue } from "@heroui/react"
import { FAMILY_ROOTS, describedTexts, familyOf } from "../../../__test__/grammarRoots.js"
import { TimeField } from "./index.js"

afterEach(cleanup)

describe.each(FAMILY_ROOTS)("TimeField under %s", (family, Root) => {
    it("is one labelled group of hour and minute segments", async () => {
        const onValueChange = vi.fn()
        const { container } = render(<Root>
            <TimeField label="Alarm" description="Local time" defaultValue={new Time(9, 30)} hourCycle={24} onValueChange={onValueChange} />
        </Root>)
        expect(familyOf(container)).toBe(family)
        const groups = screen.getAllByRole("group", { name: "Alarm" })
        expect(groups).toHaveLength(1)
        const segments = within(groups[0]!).getAllByRole("spinbutton")
        expect(segments.map((segment) => segment.getAttribute("data-type"))).toEqual(["hour", "minute"])
        expect(describedTexts(segments[0]!)).toContain("Local time")
        await act(async () => {
            segments[1]!.focus()
            fireEvent.keyDown(segments[1]!, { key: "ArrowUp" })
        })
        expect(String(onValueChange.mock.lastCall?.[0])).toBe("09:31:00")
        expect(new Set(Array.from(container.querySelectorAll("[id]"), (node) => node.id)).size)
            .toBe(container.querySelectorAll("[id]").length)
    })
})

describe("TimeField states", () => {
    it("is controlled", async () => {
        const Controlled = () => {
            const [value, setValue] = useState<TimeValue | null>(new Time(10, 0))
            return <><TimeField label="At" value={value} hourCycle={24} onValueChange={setValue} /><output>{String(value)}</output></>
        }
        render(<Controlled />)
        const hour = screen.getAllByRole("spinbutton")[0]!
        await act(async () => {
            hour.focus()
            fireEvent.keyDown(hour, { key: "ArrowDown" })
        })
        expect(screen.getByRole("status").textContent).toBe("09:00:00")
    })

    it("carries invalid, disabled and read-only", () => {
        render(<>
            <TimeField label="Bad" errorMessage="Outside hours" />
            <TimeField label="Off" isDisabled />
            <TimeField label="Fixed" isReadOnly defaultValue={new Time(8, 0)} />
        </>)
        expect(describedTexts(within(screen.getByRole("group", { name: "Bad" })).getAllByRole("spinbutton")[0]!)).toContain("Outside hours")
        expect(within(screen.getByRole("group", { name: "Off" })).getAllByRole("spinbutton").every((segment) => segment.getAttribute("aria-disabled") === "true")).toBe(true)
        expect(within(screen.getByRole("group", { name: "Fixed" })).getAllByRole("spinbutton").every((segment) => segment.getAttribute("aria-readonly") === "true")).toBe(true)
    })
})

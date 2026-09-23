// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FAMILY_ROOTS, describedTexts, familyOf } from "../../../__test__/grammarRoots.js"
import { Switch } from "./index.js"

afterEach(cleanup)

describe.each(FAMILY_ROOTS)("Switch under %s", (family, Root) => {
    it("is a labelled switch toggled by its label", async () => {
        const onSelectedChange = vi.fn()
        const { container } = render(<Root>
            <Switch label="Notifications" description="Sent daily" onSelectedChange={onSelectedChange} />
        </Root>)
        expect(familyOf(container)).toBe(family)
        const toggle = screen.getByRole("switch", { name: "Notifications" }) as HTMLInputElement
        expect(describedTexts(toggle)).toContain("Sent daily")
        const text = screen.getByText("Notifications")
        await act(async () => {
            fireEvent.pointerDown(text, { pointerType: "mouse", button: 0, pointerId: 1 })
            fireEvent.pointerUp(text, { pointerType: "mouse", button: 0, pointerId: 1 })
            fireEvent.click(text)
        })
        expect(onSelectedChange).toHaveBeenLastCalledWith(true)
        expect(toggle.checked).toBe(true)
        expect(container.querySelector("[data-component='Switch']")?.getAttribute("data-selected")).toBe("true")
    })
})

describe("Switch states", () => {
    it("is controlled", () => {
        const Controlled = () => {
            const [on, setOn] = useState(false)
            return <><Switch label="Dark" isSelected={on} onSelectedChange={setOn} /><output>{String(on)}</output></>
        }
        render(<Controlled />)
        fireEvent.click(screen.getByRole("switch", { name: "Dark" }))
        expect(screen.getByRole("status").textContent).toBe("true")
    })

    it("carries invalid, disabled and read-only", () => {
        render(<>
            <Switch label="Bad" errorMessage="Must be on" />
            <Switch label="Off" isDisabled />
            <Switch label="Fixed" isReadOnly defaultSelected />
        </>)
        const bad = screen.getByRole("switch", { name: "Bad" })
        expect(bad.getAttribute("aria-invalid")).toBe("true")
        expect(describedTexts(bad)).toContain("Must be on")
        expect((screen.getByRole("switch", { name: "Off" }) as HTMLInputElement).disabled).toBe(true)
        const fixed = screen.getByRole("switch", { name: "Fixed" }) as HTMLInputElement
        fireEvent.click(fixed)
        expect(fixed.checked).toBe(true)
    })
})

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { FAMILY_ROOTS, expectedFamilyScope, installVendorDomStubs } from "../../../__test__/navigationFamilies.js"
import { Disclosure } from "./index.js"

beforeAll(installVendorDomStubs)
afterEach(cleanup)

const frame = () => document.querySelector("[data-component='Disclosure']")

describe.each(FAMILY_ROOTS)("Disclosure under %s", (family, wrap) => {
    it("puts a button with aria-expanded inside a heading and toggles uncontrolled", () => {
        const onExpandedChange = vi.fn()
        render(wrap(<Disclosure title="Shipping" headingLevel={2} onExpandedChange={onExpandedChange}>Ships in 2 days</Disclosure>))
        expect(screen.getByTestId("grammar-root").getAttribute("data-grammar-family")).toBe(expectedFamilyScope(family))
        expect(screen.getByRole("heading", { level: 2 })).not.toBeNull()
        const trigger = screen.getByRole("button", { name: "Shipping" })
        expect(trigger.getAttribute("aria-expanded")).toBe("false")
        expect(frame()?.getAttribute("data-grammar-disclosure-state")).toBe("closed")
        fireEvent.click(trigger)
        expect(onExpandedChange).toHaveBeenLastCalledWith(true)
        expect(trigger.getAttribute("aria-expanded")).toBe("true")
        expect(frame()?.getAttribute("data-grammar-disclosure-state")).toBe("open")
        const panel = document.getElementById(trigger.getAttribute("aria-controls") ?? "")
        expect(panel?.textContent).toContain("Ships in 2 days")
    })

    it("follows a controlled value and the keyboard", () => {
        const Controlled = () => {
            const [open, setOpen] = useState(true)
            return <Disclosure title="Returns" isExpanded={open} onExpandedChange={setOpen}>Thirty days</Disclosure>
        }
        render(wrap(<Controlled />))
        const trigger = screen.getByRole("button", { name: "Returns" })
        expect(trigger.getAttribute("aria-expanded")).toBe("true")
        trigger.focus()
        fireEvent.keyDown(trigger, { key: "Enter" })
        fireEvent.keyUp(trigger, { key: "Enter" })
        expect(trigger.getAttribute("aria-expanded")).toBe("false")
        expect(frame()?.getAttribute("data-grammar-disclosure-state")).toBe("closed")
    })

    it("does not open while disabled", () => {
        render(wrap(<Disclosure title="Locked" isDisabled>Hidden</Disclosure>))
        const trigger = screen.getByRole("button", { name: "Locked" })
        fireEvent.click(trigger)
        expect(trigger.getAttribute("aria-expanded")).toBe("false")
    })
})

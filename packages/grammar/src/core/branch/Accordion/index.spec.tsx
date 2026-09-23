// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { FAMILY_WRAPS, expectedFamilyScope, installDomShims } from "../../../__test__/grammarRoots.js"
import { Accordion } from "./index.js"

beforeAll(installDomShims)
afterEach(cleanup)

const items = [
    { id: "billing", title: "Billing", content: "Monthly" },
    { id: "access", title: "Access", content: "Roles" },
    { id: "legacy", title: "Legacy", content: "Old", isDisabled: true },
]

const states = () => [...document.querySelectorAll(".starci-core-generic-accordion-item")].map((node) => node.getAttribute("data-grammar-disclosure-state"))

describe.each(FAMILY_WRAPS)("Accordion under %s", (family, wrap) => {
    it("renders a named group of heading-wrapped triggers", () => {
        render(wrap(<Accordion label="Settings" items={items} defaultExpandedIds={["access"]} />))
        expect(screen.getByTestId("grammar-root").getAttribute("data-grammar-family")).toBe(expectedFamilyScope(family))
        const group = screen.getByRole("group", { name: "Settings" })
        expect(group.getAttribute("data-component")).toBe("Accordion")
        expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3)
        expect(screen.getByRole("button", { name: "Access" }).getAttribute("aria-expanded")).toBe("true")
        expect(states()).toEqual(["closed", "open", "closed"])
    })

    it("keeps a single section open by default", () => {
        const onExpandedChange = vi.fn()
        render(wrap(<Accordion label="Settings" items={items} defaultExpandedIds={["access"]} onExpandedChange={onExpandedChange} />))
        fireEvent.click(screen.getByRole("button", { name: "Billing" }))
        expect(onExpandedChange).toHaveBeenLastCalledWith(["billing"])
        expect(states()).toEqual(["open", "closed", "closed"])
    })

    it("allows several open sections when asked and stays controlled", () => {
        const Controlled = () => {
            const [open, setOpen] = useState<ReadonlyArray<string>>([])
            return <Accordion label="Settings" items={items} allowsMultipleExpanded expandedIds={open} onExpandedChange={setOpen} />
        }
        render(wrap(<Controlled />))
        fireEvent.click(screen.getByRole("button", { name: "Billing" }))
        fireEvent.click(screen.getByRole("button", { name: "Access" }))
        expect(states()).toEqual(["open", "open", "closed"])
    })

    it("moves between enabled triggers with Up/Down/Home/End", () => {
        render(wrap(<Accordion label="Settings" items={items} />))
        const billing = screen.getByRole("button", { name: "Billing" })
        const access = screen.getByRole("button", { name: "Access" })
        billing.focus()
        fireEvent.keyDown(billing, { key: "ArrowDown" })
        expect(document.activeElement).toBe(access)
        fireEvent.keyDown(access, { key: "ArrowDown" })
        expect(document.activeElement).toBe(billing)
        fireEvent.keyDown(billing, { key: "End" })
        expect(document.activeElement).toBe(access)
        fireEvent.keyDown(access, { key: "Home" })
        expect(document.activeElement).toBe(billing)
    })
})

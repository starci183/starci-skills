// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { FAMILY_ROOTS, expectedFamilyScope, installVendorDomStubs } from "../../../__test__/navigationFamilies.js"
import { ListBox } from "./index.js"

beforeAll(installVendorDomStubs)
afterEach(cleanup)

const items = [
    { id: "ada", label: "Ada", description: "Owner" },
    { id: "grace", label: "Grace" },
    { id: "alan", label: "Alan", isDisabled: true },
]

const selectedHooks = () => [...document.querySelectorAll(".starci-core-list-box-row")].map((node) => node.getAttribute("data-grammar-selected"))

describe.each(FAMILY_ROOTS)("ListBox under %s", (family, wrap) => {
    it("renders a named listbox of options", () => {
        render(wrap(<ListBox label="Members" items={items} />))
        expect(screen.getByTestId("grammar-root").getAttribute("data-grammar-family")).toBe(expectedFamilyScope(family))
        const list = screen.getByRole("listbox", { name: "Members" })
        expect(list.getAttribute("data-component")).toBe("ListBox")
        expect(list.getAttribute("data-grammar-list-selection")).toBe("single")
        expect(screen.getAllByRole("option")).toHaveLength(3)
        expect(screen.getByRole("option", { name: /Alan/ }).getAttribute("aria-disabled")).toBe("true")
    })

    it("selects uncontrolled rows by pointer and mirrors aria-selected", () => {
        const onSelectionChange = vi.fn()
        render(wrap(<ListBox label="Members" items={items} onSelectionChange={onSelectionChange} />))
        fireEvent.click(screen.getByRole("option", { name: /Grace/ }))
        expect(onSelectionChange).toHaveBeenLastCalledWith(["grace"])
        expect(screen.getByRole("option", { name: /Grace/ }).getAttribute("aria-selected")).toBe("true")
        expect(selectedHooks()).toEqual(["false", "true", "false"])
    })

    it("moves with the arrow keys and selects with the keyboard", () => {
        const Controlled = () => {
            const [selected, setSelected] = useState<ReadonlyArray<string>>(["ada"])
            return <ListBox label="Members" items={items} selectionMode="multiple" selectedIds={selected} onSelectionChange={setSelected} />
        }
        render(wrap(<Controlled />))
        const ada = screen.getByRole("option", { name: /Ada/ })
        ada.focus()
        fireEvent.keyDown(ada, { key: "ArrowDown" })
        const grace = screen.getByRole("option", { name: /Grace/ })
        expect(document.activeElement).toBe(grace)
        fireEvent.keyDown(grace, { key: " " })
        fireEvent.keyUp(grace, { key: " " })
        expect(selectedHooks()).toEqual(["true", "true", "false"])
    })

    it("fires actions for a non-selectable list and shows the empty state", () => {
        const onAction = vi.fn()
        const { unmount } = render(wrap(<ListBox label="Commands" items={items} selectionMode="none" onAction={onAction} />))
        fireEvent.click(screen.getByRole("option", { name: /Ada/ }))
        expect(onAction).toHaveBeenCalledWith("ada")
        unmount()
        render(wrap(<ListBox label="Empty" items={[]} emptyContent="Nobody here" />))
        expect(document.querySelector("[data-grammar-list-empty]")?.textContent).toBe("Nobody here")
    })
})

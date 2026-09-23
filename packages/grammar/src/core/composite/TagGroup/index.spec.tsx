// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { useState } from "react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { FAMILY_ROOTS, expectedFamilyScope, installVendorDomStubs } from "../../../__test__/navigationFamilies.js"
import { TagGroup } from "./index.js"

beforeAll(installVendorDomStubs)
afterEach(cleanup)

const items = [
    { id: "design", label: "Design" },
    { id: "code", label: "Code" },
    { id: "ops", label: "Ops", isDisabled: true },
]

const selectedHooks = () => [...document.querySelectorAll("[data-grammar-tag-label]")].map((node) => node.getAttribute("data-grammar-selected"))

describe.each(FAMILY_ROOTS)("TagGroup under %s", (family, wrap) => {
    it("renders static chips as a named grid of rows", () => {
        render(wrap(<TagGroup label="Topics" items={items} />))
        expect(screen.getByTestId("grammar-root").getAttribute("data-grammar-family")).toBe(expectedFamilyScope(family))
        const group = screen.getByRole("grid", { name: "Topics" })
        expect(group.closest("[data-component='TagGroup']")?.getAttribute("data-grammar-tag-selection")).toBe("none")
        expect(within(group).getAllByRole("row")).toHaveLength(3)
        expect(selectedHooks()).toEqual(["false", "false", "false"])
    })

    it("selects filter chips (uncontrolled) and exposes the selected hook", () => {
        const onSelectionChange = vi.fn()
        render(wrap(<TagGroup label="Filters" items={items} selectionMode="multiple" defaultSelectedIds={["code"]} onSelectionChange={onSelectionChange} />))
        expect(selectedHooks()).toEqual(["false", "true", "false"])
        fireEvent.click(screen.getByRole("row", { name: "Design" }))
        expect(onSelectionChange).toHaveBeenLastCalledWith(expect.arrayContaining(["design", "code"]))
        expect(selectedHooks()).toEqual(["true", "true", "false"])
        expect(screen.getByRole("row", { name: "Design" }).getAttribute("aria-selected")).toBe("true")
    })

    it("follows controlled single selection", () => {
        const Controlled = () => {
            const [selected, setSelected] = useState<ReadonlyArray<string>>(["design"])
            return <TagGroup label="Filters" items={items} selectionMode="single" selectedIds={selected} onSelectionChange={setSelected} />
        }
        render(wrap(<Controlled />))
        fireEvent.click(screen.getByRole("row", { name: "Code" }))
        expect(selectedHooks()).toEqual(["false", "true", "false"])
    })

    it("removes chips by button and by keyboard with app-owned labels", () => {
        const onRemove = vi.fn()
        render(wrap(<TagGroup label="Tokens" items={items} onRemove={onRemove} removeLabel={(label) => `Remove ${label}`} emptyContent="Nothing" />))
        fireEvent.click(screen.getByRole("button", { name: /^Remove Design/ }))
        expect(onRemove).toHaveBeenLastCalledWith(["design"])
        const code = screen.getByRole("row", { name: /Code/ })
        code.focus()
        fireEvent.keyDown(code, { key: "Delete" })
        expect(onRemove).toHaveBeenLastCalledWith(["code"])
    })

    it("shows the empty state when no chips remain", () => {
        render(wrap(<TagGroup label="Tokens" items={[]} emptyContent="No tags" />))
        expect(document.querySelector("[data-grammar-tag-empty]")?.textContent).toBe("No tags")
    })
})

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FAMILY_ROOTS, describedTexts, familyOf } from "../../../__test__/grammarRoots.js"
import { SearchField } from "./index.js"

afterEach(cleanup)

describe.each(FAMILY_ROOTS)("SearchField under %s", (family, Root) => {
    it("is a labelled searchbox: Enter submits, Escape clears", () => {
        const onSubmit = vi.fn()
        const onClear = vi.fn()
        const { container } = render(<Root>
            <SearchField label="Search" isLabelHidden description="Titles only" defaultValue="cats" onSubmit={onSubmit} onClear={onClear} clearLabel="Clear" />
        </Root>)
        expect(familyOf(container)).toBe(family)
        const input = screen.getByRole("searchbox", { name: "Search" }) as HTMLInputElement
        expect(input.type).toBe("search")
        expect(describedTexts(input)).toContain("Titles only")
        expect(screen.getByRole("button", { name: "Clear" })).toBeTruthy()
        fireEvent.keyDown(input, { key: "Enter" })
        expect(onSubmit).toHaveBeenCalledWith("cats")
        fireEvent.keyDown(input, { key: "Escape" })
        expect(onClear).toHaveBeenCalled()
        expect(input.value).toBe("")
    })
})

describe("SearchField states", () => {
    it("is controlled", () => {
        const Controlled = () => {
            const [value, setValue] = useState("")
            return <><SearchField label="Search" value={value} onValueChange={setValue} /><output>{value}</output></>
        }
        render(<Controlled />)
        fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), { target: { value: "dogs" } })
        expect(screen.getByRole("status").textContent).toBe("dogs")
    })

    it("marks pending, invalid, disabled and read-only", () => {
        const { container } = render(<>
            <SearchField label="Busy" isPending />
            <SearchField label="Bad" errorMessage="Too short" />
            <SearchField label="Off" isDisabled />
            <SearchField label="Fixed" isReadOnly />
        </>)
        expect(screen.getByRole("searchbox", { name: "Busy" }).getAttribute("aria-busy")).toBe("true")
        const bad = screen.getByRole("searchbox", { name: "Bad" })
        expect(bad.getAttribute("aria-invalid")).toBe("true")
        expect(describedTexts(bad)).toContain("Too short")
        expect((screen.getByRole("searchbox", { name: "Off" }) as HTMLInputElement).disabled).toBe(true)
        expect((screen.getByRole("searchbox", { name: "Fixed" }) as HTMLInputElement).readOnly).toBe(true)
        expect(container.querySelectorAll("[data-component='SearchField'][data-grammar-pending='true']")).toHaveLength(1)
    })
})

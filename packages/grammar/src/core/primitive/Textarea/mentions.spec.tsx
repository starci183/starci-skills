// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { installDomShims } from "../../../__test__/grammarRoots.js"
import { Textarea, filterMentionOptions, findMentionQuery } from "./index.js"

beforeAll(installDomShims)
afterEach(cleanup)

const PEOPLE = [
    { id: "linh", label: "Linh", description: "Owner" },
    { id: "minh", label: "Minh", description: "Sales" },
    { id: "an", label: "Ân", description: "Kế toán" },
]

describe("mention query helpers", () => {
    it("finds the trigger word that ends at the caret", () => {
        expect(findMentionQuery("hi @li", 6)).toEqual({ start: 3, end: 6, text: "li" })
        expect(findMentionQuery("@", 1)).toEqual({ start: 0, end: 1, text: "" })
        expect(findMentionQuery("mail@li", 7)).toBeNull()
        expect(findMentionQuery("hi @li now", 10)).toBeNull()
        expect(findMentionQuery("hi #li", 6, "#")).toEqual({ start: 3, end: 6, text: "li" })
    })

    it("filters accent- and case-insensitively, on label or description", () => {
        expect(filterMentionOptions(PEOPLE, "an").map((o) => o.id)).toEqual(["an"])
        expect(filterMentionOptions(PEOPLE, "SALES").map((o) => o.id)).toEqual(["minh"])
        expect(filterMentionOptions(PEOPLE, "")).toHaveLength(3)
    })
})

const Composer = ({ onSubmit, onSelect }: { readonly onSubmit: () => void; readonly onSelect?: (id: string) => void }) => {
    const [value, setValue] = useState("")
    return (
        <Textarea
            label="Message"
            value={value}
            onValueChange={setValue}
            onSubmitShortcut={onSubmit}
            mentions={{ options: PEOPLE, label: "People", onSelect: (o) => onSelect?.(o.id) }}
        />
    )
}

const typeInto = (field: HTMLTextAreaElement, text: string) => {
    fireEvent.change(field, { target: { value: text } })
    field.setSelectionRange(text.length, text.length)
    fireEvent.keyUp(field, { key: text.slice(-1) })
}

describe("Textarea mentions and submit shortcut", () => {
    it("opens suggestions after the trigger, navigates and inserts the chosen label", async () => {
        const onSelect = vi.fn()
        render(<Composer onSubmit={vi.fn()} onSelect={onSelect} />)
        const field = screen.getByLabelText("Message") as HTMLTextAreaElement
        typeInto(field, "hello @")
        const list = screen.getByRole("listbox", { name: "People" })
        expect(list.querySelectorAll('[role="option"]')).toHaveLength(3)
        expect(field.getAttribute("aria-controls")).toBe(list.id)
        fireEvent.keyDown(field, { key: "ArrowDown" })
        expect(field.getAttribute("aria-activedescendant")).toContain("minh")
        await act(async () => { fireEvent.keyDown(field, { key: "Enter" }) })
        expect(field.value).toBe("hello @Minh ")
        expect(onSelect).toHaveBeenCalledWith("minh")
        expect(screen.queryByRole("listbox")).toBeNull()
    })

    it("inserts on pointer selection", async () => {
        render(<Composer onSubmit={vi.fn()} />)
        const field = screen.getByLabelText("Message") as HTMLTextAreaElement
        typeInto(field, "@")
        await act(async () => { fireEvent.mouseDown(screen.getByRole("option", { name: /Ân/ })) })
        expect(field.value).toBe("@Ân ")
    })

    it("closes on Escape without submitting", () => {
        const onSubmit = vi.fn()
        render(<Composer onSubmit={onSubmit} />)
        const field = screen.getByLabelText("Message") as HTMLTextAreaElement
        typeInto(field, "@mi")
        expect(screen.getByRole("listbox").querySelectorAll('[role="option"]')).toHaveLength(1)
        fireEvent.keyDown(field, { key: "Escape" })
        expect(screen.queryByRole("listbox")).toBeNull()
        expect(onSubmit).not.toHaveBeenCalled()
    })

    it("submits on Enter, keeps Shift+Enter and IME composition for line breaks", () => {
        const onSubmit = vi.fn()
        render(<Composer onSubmit={onSubmit} />)
        const field = screen.getByLabelText("Message") as HTMLTextAreaElement
        typeInto(field, "ok")
        fireEvent.keyDown(field, { key: "Enter", shiftKey: true })
        fireEvent.keyDown(field, { key: "Enter", isComposing: true })
        expect(onSubmit).not.toHaveBeenCalled()
        fireEvent.keyDown(field, { key: "Enter" })
        expect(onSubmit).toHaveBeenCalledTimes(1)
    })

    it("stays a plain textarea without the new props", () => {
        render(<Textarea label="Notes" defaultValue="a" />)
        const field = screen.getByLabelText("Notes") as HTMLTextAreaElement
        expect(field.getAttribute("aria-autocomplete")).toBeNull()
        expect(field.value).toBe("a")
    })
})

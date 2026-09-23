// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FAMILY_ROOTS, describedTexts, familyOf } from "../../../__test__/familyRoots.js"
import { FileDropzone } from "./index.js"

afterEach(cleanup)

const choose = (input: HTMLInputElement, files: ReadonlyArray<File>) => {
    Object.defineProperty(input, "files", { configurable: true, value: files })
    fireEvent.change(input)
}

describe.each(FAMILY_ROOTS)("FileDropzone under %s", (family, Root) => {
    it("is a labelled native file input stretched over the drop target", () => {
        const onFilesChange = vi.fn()
        const { container } = render(<Root>
            <FileDropzone label="Attachments" prompt="Drop files or browse" description="PDF only" accept=".pdf" multiple name="files" onFilesChange={onFilesChange} />
        </Root>)
        expect(familyOf(container)).toBe(family)
        const input = screen.getByLabelText("Attachments") as HTMLInputElement
        expect(input.type).toBe("file")
        expect(input.accept).toBe(".pdf")
        expect(input.multiple).toBe(true)
        expect(input.name).toBe("files")
        expect(describedTexts(input)).toContain("PDF only")
        const target = container.querySelector("[data-grammar-field-control]")!
        expect(target.contains(input)).toBe(true)
        expect(target.textContent).toContain("Drop files or browse")
        choose(input, [new File(["a"], "one.pdf"), new File(["b"], "two.pdf")])
        expect(onFilesChange).toHaveBeenCalledWith([expect.objectContaining({ name: "one.pdf" }), expect.objectContaining({ name: "two.pdf" })])
        expect(Array.from(container.querySelectorAll("[data-grammar-file-list] li"), (item) => item.textContent)).toEqual(["one.pdf", "two.pdf"])
    })

    it("reflects the drag-over state on the target", () => {
        const { container } = render(<Root><FileDropzone label="Upload" prompt="Drop here" /></Root>)
        const target = container.querySelector("[data-grammar-field-control]")!
        fireEvent.dragEnter(target)
        expect(target.getAttribute("data-grammar-drag")).toBe("over")
        fireEvent.dragLeave(target)
        expect(target.getAttribute("data-grammar-drag")).toBe("idle")
    })
})

describe("FileDropzone states", () => {
    it("carries invalid, required, disabled and read-only", () => {
        const { container } = render(<>
            <FileDropzone label="Bad" prompt="Drop" errorMessage="Too large" isRequired />
            <FileDropzone label="Off" prompt="Drop" isDisabled />
            <FileDropzone label="Fixed" prompt="Drop" isReadOnly />
        </>)
        const bad = screen.getByLabelText(/Bad/) as HTMLInputElement
        expect(bad.getAttribute("aria-invalid")).toBe("true")
        expect(bad.required).toBe(true)
        expect(describedTexts(bad)).toContain("Too large")
        expect((screen.getByLabelText("Off") as HTMLInputElement).disabled).toBe(true)
        const fixed = screen.getByLabelText("Fixed") as HTMLInputElement
        expect(fixed.getAttribute("aria-readonly")).toBe("true")
        const click = new MouseEvent("click", { bubbles: true, cancelable: true })
        fixed.dispatchEvent(click)
        expect(click.defaultPrevented).toBe(true)
        expect(container.querySelector("[data-component='FileDropzone'][data-grammar-disabled='true']")).not.toBeNull()
    })

    it("hides the chosen names when asked", () => {
        const { container } = render(<FileDropzone label="Quiet" prompt="Drop" hideFileList />)
        choose(screen.getByLabelText("Quiet") as HTMLInputElement, [new File(["a"], "a.txt")])
        expect(container.querySelector("[data-grammar-file-list]")).toBeNull()
    })
})

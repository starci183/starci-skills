// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { GRAMMAR_ROOT_CASES, expectInFamilyScope } from "../../../__test__/grammarRoots.js"
import { Button } from "../../primitive/Button/index.js"
import { AlertDialog } from "./index.js"

afterEach(cleanup)

const pressOutside = (element: Element) => act(() => {
    fireEvent.pointerDown(element, { button: 0, pointerId: 1 })
    fireEvent.mouseDown(element, { button: 0 })
    fireEvent.pointerUp(element, { button: 0, pointerId: 1 })
    fireEvent.mouseUp(element, { button: 0 })
    fireEvent.click(element, { button: 0 })
})

describe.each(GRAMMAR_ROOT_CASES)("Common AlertDialog under $name", ({ Root, family }) => {
    it("interrupts with alertdialog semantics inside the family scope, focusing the safe choice", async () => {
        render(
            <Root>
                <AlertDialog
                    title="Delete project?"
                    description="This cannot be undone."
                    confirmLabel="Delete"
                    cancelLabel="Keep"
                    onConfirm={() => undefined}
                    trigger={<Button>Delete project</Button>}
                />
            </Root>,
        )
        act(() => { fireEvent.click(screen.getByRole("button", { name: "Delete project" })) })

        const dialog = await screen.findByRole("alertdialog")
        expect(dialog.getAttribute("data-component")).toBe("AlertDialog")
        expect(dialog.getAttribute("data-grammar-tone")).toBe("negative")
        expect(dialog.getAttribute("aria-labelledby")).toBe(screen.getByRole("heading", { name: "Delete project?" }).id)
        expect(dialog.getAttribute("aria-describedby")).toBe(screen.getByText("This cannot be undone.").id)
        expect(dialog.querySelector("[data-grammar-overlay-action=\"confirm\"][data-grammar-tone=\"negative\"]")).toBeTruthy()
        expectInFamilyScope(dialog, family)
        await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Keep" })))
    })

    it("never dismisses on an outside press; Escape cancels", async () => {
        const onCancel = vi.fn()
        render(<Root><AlertDialog title="Leave?" confirmLabel="Leave" cancelLabel="Stay" onConfirm={() => undefined} onCancel={onCancel} defaultOpen /></Root>)
        const dialog = await screen.findByRole("alertdialog")
        const backdrop = dialog.closest("[data-grammar-overlay-backdrop=\"AlertDialog\"]")
        expect(backdrop).toBeTruthy()

        if (backdrop !== null) pressOutside(backdrop)
        expect(screen.getByRole("alertdialog")).toBeTruthy()
        expect(onCancel).not.toHaveBeenCalled()

        act(() => { fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" }) })
        expect(screen.queryByRole("alertdialog")).toBeNull()
        expect(onCancel).toHaveBeenCalledTimes(1)
    })
})

describe("Common AlertDialog decisions", () => {
    it("confirms and closes without reporting a cancel", async () => {
        const onConfirm = vi.fn()
        const onCancel = vi.fn()
        render(<AlertDialog title="Archive?" tone="neutral" confirmLabel="Archive" cancelLabel="Cancel" onConfirm={onConfirm} onCancel={onCancel} defaultOpen />)
        await screen.findByRole("alertdialog")

        act(() => { fireEvent.click(screen.getByRole("button", { name: "Archive" })) })
        expect(onConfirm).toHaveBeenCalledTimes(1)
        expect(onCancel).not.toHaveBeenCalled()
        expect(screen.queryByRole("alertdialog")).toBeNull()
    })

    it("holds open and pending while an async confirm runs, and stays open when it fails", async () => {
        let settle: { resolve: () => void; reject: () => void } = { resolve: () => undefined, reject: () => undefined }
        const onConfirm = vi.fn(() => new Promise<void>((resolve, reject) => { settle = { resolve, reject: () => reject(new Error("nope")) } }))
        render(<AlertDialog title="Publish?" tone="informative" confirmLabel="Publish" cancelLabel="Cancel" onConfirm={onConfirm} defaultOpen />)
        await screen.findByRole("alertdialog")

        act(() => { fireEvent.click(screen.getByRole("button", { name: "Publish" })) })
        expect(screen.getByRole("alertdialog")).toBeTruthy()
        await waitFor(() => expect(screen.getByRole("alertdialog").querySelector("[data-action-pending=\"true\"]")).toBeTruthy())

        await act(async () => { settle.reject() })
        expect(screen.getByRole("alertdialog")).toBeTruthy()
        await waitFor(() => expect(screen.getByRole("alertdialog").querySelector("[data-action-pending=\"true\"]")).toBeNull())

        act(() => { fireEvent.click(screen.getByRole("button", { name: "Publish" })) })
        await act(async () => { settle.resolve() })
        await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
        expect(onConfirm).toHaveBeenCalledTimes(2)
    })
})

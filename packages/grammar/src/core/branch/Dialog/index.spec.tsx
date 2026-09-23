// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { GRAMMAR_ROOT_CASES, expectInFamilyScope } from "../../../__test__/overlayRoots.js"
import { Button } from "../../primitive/Button/index.js"
import { Dialog } from "./index.js"

afterEach(cleanup)

const openWith = (name: string) => act(() => {
    fireEvent.click(screen.getByRole("button", { name }))
})

describe.each(GRAMMAR_ROOT_CASES)("Common Dialog under $name", ({ Root, family }) => {
    it("opens from its trigger into the same family scope with dialog semantics", async () => {
        render(
            <Root>
                <Dialog
                    title="Rename file"
                    description="Choose a short name."
                    closeLabel="Close"
                    trigger={<Button>Rename</Button>}
                    footer={(close) => <Button variant="primary" onPress={close}>Save</Button>}
                >
                    <p>Body copy</p>
                </Dialog>
            </Root>,
        )

        expect(screen.queryByRole("dialog")).toBeNull()
        openWith("Rename")

        const dialog = await screen.findByRole("dialog")
        expect(dialog.getAttribute("data-component")).toBe("Dialog")
        expect(dialog.getAttribute("data-grammar-overlay-surface")).toBe("dialog")
        const heading = screen.getByRole("heading", { name: "Rename file" })
        expect(dialog.getAttribute("aria-labelledby")).toBe(heading.id)
        const description = screen.getByText("Choose a short name.")
        expect(dialog.getAttribute("aria-describedby")).toBe(description.id)
        await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))

        // The portal lands INSIDE the Grammar root, never as a bare child of <body>.
        expectInFamilyScope(dialog, family)
        const backdrop = dialog.closest("[data-grammar-overlay-backdrop=\"Dialog\"]")
        expect(backdrop?.parentElement?.classList.contains("grammar-common-root")).toBe(true)
        expect(backdrop?.parentElement).not.toBe(document.body)
    })

    it("dismisses on Escape and returns focus to the trigger", async () => {
        render(<Root><Dialog title="Details" closeLabel="Close" trigger={<Button>Open</Button>} /></Root>)
        const trigger = screen.getByRole("button", { name: "Open" })
        act(() => trigger.focus())
        openWith("Open")
        const dialog = await screen.findByRole("dialog")

        act(() => { fireEvent.keyDown(dialog, { key: "Escape" }) })
        expect(screen.queryByRole("dialog")).toBeNull()
        await waitFor(() => expect(document.activeElement).toBe(trigger))
    })

    it("closes from the named header close button and from footer actions", async () => {
        render(
            <Root>
                <Dialog
                    title="Details"
                    closeLabel="Close details"
                    trigger={<Button>Open</Button>}
                    footer={(close) => <Button onPress={close}>Done</Button>}
                />
            </Root>,
        )
        openWith("Open")
        await screen.findByRole("dialog")
        act(() => { fireEvent.click(screen.getByRole("button", { name: "Close details" })) })
        expect(screen.queryByRole("dialog")).toBeNull()

        openWith("Open")
        await screen.findByRole("dialog")
        act(() => { fireEvent.click(screen.getByRole("button", { name: "Done" })) })
        expect(screen.queryByRole("dialog")).toBeNull()
    })

    it("locks page scroll while open", async () => {
        render(<Root><Dialog title="Details" trigger={<Button>Open</Button>} /></Root>)
        openWith("Open")
        await screen.findByRole("dialog")
        expect(document.documentElement.style.overflow).toBe("hidden")
    })
})

const pressOutside = (element: Element) => act(() => {
    fireEvent.pointerDown(element, { button: 0, pointerId: 1 })
    fireEvent.mouseDown(element, { button: 0 })
    fireEvent.pointerUp(element, { button: 0, pointerId: 1 })
    fireEvent.mouseUp(element, { button: 0 })
    fireEvent.click(element, { button: 0 })
})

describe("Common Dialog open-state and dismiss rules", () => {
    it("dismisses on an outside press unless isDismissable is false", async () => {
        const { rerender } = render(<Dialog title="Outside" defaultOpen />)
        const backdrop = (await screen.findByRole("dialog")).closest("[data-grammar-overlay-backdrop]")
        if (backdrop !== null) pressOutside(backdrop)
        expect(screen.queryByRole("dialog")).toBeNull()

        rerender(<Dialog key="sticky" title="Sticky" defaultOpen isDismissable={false} />)
        const sticky = (await screen.findByRole("dialog")).closest("[data-grammar-overlay-backdrop]")
        if (sticky !== null) pressOutside(sticky)
        expect(screen.getByRole("dialog")).toBeTruthy()
    })

    it("is controllable: Escape requests close but the owner decides", async () => {
        const onOpenChange = vi.fn()
        render(<Dialog title="Controlled" isOpen onOpenChange={onOpenChange} />)
        const dialog = await screen.findByRole("dialog")
        act(() => { fireEvent.keyDown(dialog, { key: "Escape" }) })
        expect(onOpenChange).toHaveBeenCalledWith(false)
        expect(screen.getByRole("dialog")).toBeTruthy()
    })

    it("keeps Escape inert when keyboard dismiss is disabled", async () => {
        render(<Dialog title="Unsaved" defaultOpen isKeyboardDismissDisabled />)
        const dialog = await screen.findByRole("dialog")
        act(() => { fireEvent.keyDown(dialog, { key: "Escape" }) })
        expect(screen.getByRole("dialog")).toBeTruthy()
    })

    it("falls back to the document body when no Grammar root exists", async () => {
        render(<Dialog title="Rootless" defaultOpen />)
        const dialog = await screen.findByRole("dialog")
        expect(dialog.closest(".grammar-common-root")).toBeNull()
        expect(document.body.contains(dialog)).toBe(true)
    })

    it("server-renders only the trigger and an inert anchor", () => {
        const markup = renderToStaticMarkup(<Dialog title="Server" trigger={<Button>Open</Button>} defaultOpen />)
        expect(markup).toContain("data-grammar-overlay-anchor=\"Dialog\"")
        expect(markup).toContain("hidden")
        expect(markup).not.toContain("role=\"dialog\"")
    })
})

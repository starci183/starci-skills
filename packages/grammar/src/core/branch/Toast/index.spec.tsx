// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { GRAMMAR_ROOT_CASES, expectInFamilyScope } from "../../../__test__/grammarRoots.js"
import { DEFAULT_TOAST_TIMEOUT, Toaster, createToastQueue, toastTimeoutFor } from "./index.js"

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => {
    cleanup()
    vi.useRealTimers()
})

const region = (name = "Notifications") => screen.getByRole("region", { name })
const toasts = () => Array.from(document.querySelectorAll("[data-component=\"Toast\"]"))

describe.each(GRAMMAR_ROOT_CASES)("Common Toaster under $name", ({ Root, family }) => {
    it("renders a labelled region in place (inside the family scope) with persistent live regions", () => {
        const queue = createToastQueue()
        render(<Root><Toaster label="Notifications" dismissLabel="Dismiss" queue={queue} /></Root>)
        const toaster = region()

        expect(toaster.getAttribute("data-component")).toBe("Toaster")
        expect(toaster.getAttribute("data-placement")).toBe("bottom-end")
        expectInFamilyScope(toaster, family)
        // The live regions exist BEFORE any toast arrives, so the first announcement is not lost.
        expect(toaster.querySelector("[role=\"status\"][aria-live=\"polite\"]")).toBeTruthy()
        expect(toaster.querySelector("[role=\"alert\"][aria-live=\"assertive\"]")).toBeTruthy()

        act(() => { queue.add({ title: "Saved", description: "All changes stored.", tone: "affirmative" }) })
        const toast = toasts()[0]
        expect(toast?.getAttribute("data-grammar-tone")).toBe("affirmative")
        expect(toast?.getAttribute("data-grammar-overlay-surface")).toBe("toast")
        expectInFamilyScope(toast ?? null, family)
        expect(toaster.querySelector("[data-grammar-toaster-live=\"polite\"]")?.textContent).toBe("Saved. All changes stored.")

        act(() => { queue.add({ title: "Upload failed", tone: "negative" }) })
        expect(toaster.querySelector("[data-grammar-toaster-live=\"assertive\"]")?.textContent).toBe("Upload failed")
    })

    it("dismisses from its named close button, from Escape, and after its timeout", () => {
        const queue = createToastQueue()
        render(<Root><Toaster label="Notifications" dismissLabel="Dismiss notification" queue={queue} /></Root>)

        act(() => { queue.add({ title: "One" }) })
        act(() => { fireEvent.click(within(region()).getByRole("button", { name: "Dismiss notification" })) })
        expect(toasts()).toHaveLength(0)

        act(() => { queue.add({ title: "Two" }) })
        act(() => { fireEvent.keyDown(toasts()[0] as Element, { key: "Escape" }) })
        expect(toasts()).toHaveLength(0)

        act(() => { queue.add({ title: "Three" }) })
        act(() => { vi.advanceTimersByTime(DEFAULT_TOAST_TIMEOUT - 1) })
        expect(toasts()).toHaveLength(1)
        act(() => { vi.advanceTimersByTime(1) })
        expect(toasts()).toHaveLength(0)
    })
})

describe("Common Toaster timing and actions", () => {
    it("pauses every timer while hovered and resumes with the remaining time", () => {
        const queue = createToastQueue()
        render(<Toaster label="Notifications" dismissLabel="Dismiss" queue={queue} />)
        act(() => { queue.add({ title: "Paused", timeout: 5000 }) })

        act(() => { vi.advanceTimersByTime(3000) })
        act(() => { fireEvent.pointerEnter(region()) })
        expect(region().getAttribute("data-paused")).toBe("true")
        act(() => { vi.advanceTimersByTime(10000) })
        expect(toasts()).toHaveLength(1)

        act(() => { fireEvent.pointerLeave(region()) })
        act(() => { vi.advanceTimersByTime(1999) })
        expect(toasts()).toHaveLength(1)
        act(() => { vi.advanceTimersByTime(1) })
        expect(toasts()).toHaveLength(0)
    })

    it("keeps action, negative and pending toasts until dismissed; the action runs and dismisses", () => {
        expect(toastTimeoutFor({ title: "x", action: { label: "Undo", onAction: () => undefined } })).toBe(0)
        expect(toastTimeoutFor({ title: "x", tone: "negative" })).toBe(0)
        expect(toastTimeoutFor({ title: "x", tone: "pending" })).toBe(0)
        expect(toastTimeoutFor({ title: "x" })).toBe(DEFAULT_TOAST_TIMEOUT)

        const onAction = vi.fn()
        const queue = createToastQueue()
        render(<Toaster label="Notifications" dismissLabel="Dismiss" queue={queue} />)
        act(() => { queue.add({ title: "Archived", action: { label: "Undo", onAction } }) })
        act(() => { vi.advanceTimersByTime(60000) })
        expect(toasts()[0]?.getAttribute("data-persistent")).toBe("true")

        act(() => { fireEvent.click(screen.getByRole("button", { name: "Undo" })) })
        expect(onAction).toHaveBeenCalledTimes(1)
        expect(toasts()).toHaveLength(0)
    })

    it("updates a toast in place and restarts its timer", () => {
        const queue = createToastQueue()
        render(<Toaster label="Notifications" dismissLabel="Dismiss" queue={queue} />)
        let id = ""
        act(() => { id = queue.add({ title: "Uploading", tone: "pending" }) })
        expect(toasts()[0]?.querySelector("[data-slot=\"spinner\"]")).toBeTruthy()

        act(() => { queue.update(id, { title: "Uploaded", tone: "affirmative", timeout: 4000 }) })
        expect(toasts()[0]?.textContent).toContain("Uploaded")
        expect(toasts()[0]?.getAttribute("data-grammar-tone")).toBe("affirmative")
        act(() => { vi.advanceTimersByTime(4000) })
        expect(toasts()).toHaveLength(0)
    })

    it("draws at most maxVisible toasts, newest first", () => {
        const queue = createToastQueue()
        render(<Toaster label="Notifications" dismissLabel="Dismiss" queue={queue} maxVisible={2} placement="top" />)
        act(() => {
            queue.add({ title: "First", timeout: 0 })
            queue.add({ title: "Second", timeout: 0 })
            queue.add({ title: "Third", timeout: 0 })
        })
        expect(toasts().map((toast) => toast.querySelector(".starci-core-toast-title")?.textContent)).toEqual(["Third", "Second"])
        expect(region().getAttribute("data-placement")).toBe("top")

        act(() => { queue.clear() })
        expect(toasts()).toHaveLength(0)
    })
})

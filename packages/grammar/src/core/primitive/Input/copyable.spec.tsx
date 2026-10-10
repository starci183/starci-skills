// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { installDomShims } from "../../../__test__/grammarRoots.js"
import { Input } from "./index.js"

beforeAll(installDomShims)
afterEach(cleanup)

/** Replaces only `navigator.clipboard`, so the rest of the navigator (user agent, platform) stays real. */
const stubClipboard = (writeText: (text: string) => Promise<void>) =>
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })

describe("Core Input copy action", () => {
    it("renders no copy action unless it is copyable and labelled", () => {
        render(<Input id="a" name="a" label="Webhook URL" defaultValue="https://x" isCopyable />)
        expect(screen.queryByRole("button")).toBeNull()
        cleanup()
        render(<Input id="b" name="b" label="Webhook URL" defaultValue="https://x" copyLabel="Copy" />)
        expect(screen.queryByRole("button", { name: "Copy" })).toBeNull()
    })

    it("copies the current controlled value, confirms, and reports it", async () => {
        const writeText = vi.fn(() => Promise.resolve())
        stubClipboard(writeText)
        const onCopy = vi.fn()
        const Controlled = () => {
            const [value, setValue] = useState("nivo_first")
            return <Input id="key" name="key" label="API Key" value={value} onValueChange={setValue} isCopyable copyLabel="Copy" copiedLabel="Copied" onCopy={onCopy} />
        }
        render(<Controlled />)
        fireEvent.change(screen.getByLabelText("API Key"), { target: { value: "nivo_second" } })
        await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Copy" })) })
        expect(writeText).toHaveBeenCalledWith("nivo_second")
        expect(onCopy).toHaveBeenCalledWith("nivo_second")
        expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy()
    })

    it("copies a masked secret without revealing it", async () => {
        const writeText = vi.fn(() => Promise.resolve())
        stubClipboard(writeText)
        render(<Input id="s" name="s" label="Secret" kind="password" defaultValue="hunter22" revealLabel="Show" hideLabel="Hide" isCopyable copyLabel="Copy" />)
        await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Copy" })) })
        expect(writeText).toHaveBeenCalledWith("hunter22")
        expect((screen.getByLabelText("Secret") as HTMLInputElement).type).toBe("password")
    })

    it("selects the value when the clipboard is refused", async () => {
        stubClipboard(() => Promise.reject(new Error("denied")))
        render(<Input id="u" name="u" label="URL" defaultValue="https://nivo.vn/hook" isCopyable copyLabel="Copy" copiedLabel="Copied" />)
        const field = screen.getByLabelText("URL") as HTMLInputElement
        await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Copy" })) })
        expect(field.selectionStart).toBe(0)
        expect(field.selectionEnd).toBe("https://nivo.vn/hook".length)
        expect(screen.queryByRole("button", { name: "Copied" })).toBeNull()
    })

    it("disables the copy action with the field", () => {
        render(<Input id="d" name="d" label="URL" defaultValue="x" isDisabled isCopyable copyLabel="Copy" />)
        expect((screen.getByRole("button", { name: "Copy" }) as HTMLButtonElement).disabled).toBe(true)
    })
})

describe("Core Input value ownership", () => {
    it("shows an uncontrolled default value and reports edits", () => {
        const onValueChange = vi.fn()
        render(<Input id="n" name="n" label="Name" defaultValue="NIVO" onValueChange={onValueChange} />)
        const field = screen.getByLabelText("Name") as HTMLInputElement
        expect(field.value).toBe("NIVO")
        fireEvent.change(field, { target: { value: "NIVO OS" } })
        expect(onValueChange).toHaveBeenLastCalledWith("NIVO OS")
        expect(field.value).toBe("NIVO OS")
    })

    it("follows a controlled value", () => {
        const { rerender } = render(<Input id="c" name="c" label="Name" value="one" onValueChange={vi.fn()} />)
        expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("one")
        rerender(<Input id="c" name="c" label="Name" value="two" onValueChange={vi.fn()} />)
        expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("two")
    })
})

describe("Core Input read-only", () => {
    it("keeps the value selectable but not editable, at full contrast", () => {
        const onValueChange = vi.fn()
        render(<Input id="r" name="r" label="Webhook URL" value="https://nivo.vn/hook" isReadOnly onValueChange={onValueChange} />)
        const field = screen.getByLabelText("Webhook URL") as HTMLInputElement
        expect(field.readOnly).toBe(true)
        expect(field.disabled).toBe(false)
        expect(field.closest("[data-component=\"Input\"]")?.getAttribute("data-grammar-readonly")).toBe("true")
    })

    it("marks an editable field as not read-only", () => {
        render(<Input id="w" name="w" label="Name" defaultValue="NIVO" />)
        expect((screen.getByLabelText("Name") as HTMLInputElement).readOnly).toBe(false)
    })
})

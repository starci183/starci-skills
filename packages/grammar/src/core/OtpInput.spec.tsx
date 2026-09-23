// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { GRAMMAR_ROOT_CASES, expectInFamilyScope, installDomShims } from "../__test__/grammarRoots.js"
import { OtpInput } from "./OtpInput.js"

installDomShims()
afterEach(cleanup)

describe.each(GRAMMAR_ROOT_CASES)("Common OtpInput under $name", ({ Root, family }) => {
    it("names the slot group and the input with its visible label", () => {
        render(<Root><OtpInput id="otp" name="otp" label="Verification code" /></Root>)
        const group = screen.getByRole("group", { name: "Verification code" })
        expect(group.getAttribute("data-grammar-overflow")).toBe("always")
        expect(group.hasAttribute("tabindex")).toBe(false)
        const input = screen.getByRole("textbox", { name: "Verification code" })
        expect(input.id).toBe("otp")
        expect(group.contains(input)).toBe(true)
        const label = screen.getByText("Verification code")
        expect(label.tagName).toBe("LABEL")
        expect(label.getAttribute("for")).toBe("otp")
        expectInFamilyScope(group, family)
    })

    it("keeps the name when the drawn label is hidden", () => {
        render(<Root><OtpInput id="otp" name="otp" label="Verification code" isLabelHidden /></Root>)
        expect(screen.getByText("Verification code").classList.contains("starci-core-visually-hidden")).toBe(true)
        expect(screen.getByRole("group", { name: "Verification code" })).toBeTruthy()
        expect(screen.getByRole("textbox", { name: "Verification code" })).toBeTruthy()
    })

    it("can be named by an app-owned element", () => {
        render(<Root><h2 id="otp-heading">Enter the code we sent</h2><OtpInput id="otp" name="otp" labelledBy="otp-heading" describedBy="otp-help" /><p id="otp-help">Six digits.</p></Root>)
        expect(screen.getByRole("group", { name: "Enter the code we sent" })).toBeTruthy()
        const input = screen.getByRole("textbox", { name: "Enter the code we sent" })
        expect(input.getAttribute("aria-describedby")).toBe("otp-help")
    })

    it("stays a bare strip without a name source (backwards compatible)", () => {
        const { container } = render(<Root><OtpInput id="otp" name="otp" /></Root>)
        expect(container.querySelector("[data-grammar-otp-field]")).toBeNull()
        expect(screen.queryByRole("group")).toBeNull()
    })
})

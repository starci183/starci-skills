// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { GRAMMAR_ROOT_CASES, expectInFamilyScope } from "../../../__test__/grammarRoots.js"
import { CloseButton } from "./index.js"

afterEach(cleanup)

describe.each(GRAMMAR_ROOT_CASES)("Common CloseButton under $name", ({ Root, family }) => {
    it("is a named native button that reports presses", () => {
        const onPress = vi.fn()
        render(<Root><CloseButton label="Dismiss notice" onPress={onPress} /></Root>)
        const button = screen.getByRole("button", { name: "Dismiss notice" })

        expect(button.tagName).toBe("BUTTON")
        expect(button.getAttribute("type")).toBe("button")
        expect(button.getAttribute("data-component")).toBe("CloseButton")
        expect(button.getAttribute("data-size")).toBe("md")
        expect(button.classList.contains("starci-core-close-button")).toBe(true)
        expect(button.querySelector("svg")).toBeTruthy()
        expectInFamilyScope(button, family)

        act(() => { fireEvent.click(button) })
        expect(onPress).toHaveBeenCalledTimes(1)
    })

    it("is inert while disabled", () => {
        const onPress = vi.fn()
        render(<Root><CloseButton label="Dismiss" size="sm" isDisabled onPress={onPress} /></Root>)
        const button = screen.getByRole("button", { name: "Dismiss" })

        expect(button.hasAttribute("disabled")).toBe(true)
        expect(button.getAttribute("data-size")).toBe("sm")
        act(() => { fireEvent.click(button) })
        expect(onPress).not.toHaveBeenCalled()
    })
})

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { PresentationState } from "../../../common/state.js"
import { GRAMMAR_ROOT_CASES, expectInFamilyScope } from "../../../__test__/grammarRoots.js"
import { Alert } from "./index.js"

afterEach(cleanup)

describe.each(GRAMMAR_ROOT_CASES)("Common Alert under $name", ({ Root, family }) => {
    it("is a polite in-flow status banner by default", () => {
        render(<Root><Alert title="Changes saved" description="Everyone on the team can see them." /></Root>)
        const banner = screen.getByRole("status")

        expect(banner.getAttribute("data-component")).toBe("Alert")
        expect(banner.getAttribute("data-grammar-tone")).toBe("informative")
        expect(banner.getAttribute("data-urgency")).toBe("polite")
        expect(banner.textContent).toContain("Changes saved")
        expect(banner.textContent).toContain("Everyone on the team can see them.")
        expect(banner.querySelector("svg")).toBeTruthy()
        expect(screen.queryByRole("button")).toBeNull()
        expectInFamilyScope(banner, family)
    })

    it("interrupts assertively for a negative tone and offers its action", () => {
        const onAction = vi.fn()
        render(<Root><Alert tone="negative" title="Payment failed" action={{ label: "Retry", onAction }} /></Root>)
        const banner = screen.getByRole("alert")

        expect(banner.getAttribute("data-grammar-tone")).toBe("negative")
        expect(banner.querySelector("[data-grammar-alert-actions]")).toBeTruthy()
        act(() => { fireEvent.click(screen.getByRole("button", { name: "Retry" })) })
        expect(onAction).toHaveBeenCalledTimes(1)
    })

    it("removes itself when dismissed through its named close button", () => {
        const onDismiss = vi.fn()
        render(<Root><Alert tone="cautionary" title="Storage almost full" dismissLabel="Dismiss" onDismiss={onDismiss} /></Root>)

        act(() => { fireEvent.click(screen.getByRole("button", { name: "Dismiss" })) })
        expect(onDismiss).toHaveBeenCalledTimes(1)
        expect(screen.queryByText("Storage almost full")).toBeNull()
    })

    it("swaps the glyph for a decorative spinner while pending", () => {
        render(<Root><Alert tone="pending" title="Syncing" /></Root>)
        const banner = screen.getByRole("status")
        expect(banner.querySelector("[data-slot=\"spinner\"]")?.getAttribute("aria-hidden")).toBe("true")
    })
    // HeroUI v3 Alert examples: accent Alert -> primary Button, danger Alert -> danger Button; no success or
    // warning Button variant exists, so every other tone keeps secondary.
    const ACTION_VARIANT_BY_TONE: ReadonlyArray<readonly [PresentationState, string]> = [
        ["informative", "primary"],
        ["negative", "danger"],
        ["affirmative", "secondary"],
        ["cautionary", "secondary"],
        ["neutral", "secondary"],
        ["pending", "secondary"],
        ["unavailable", "secondary"],
    ]

    it.each(ACTION_VARIANT_BY_TONE)("gives a %s Alert a %s action Button", (tone, variant) => {
        render(<Root><Alert tone={tone} title="Heads up" action={{ label: "Act", onAction: () => undefined }} /></Root>)
        const button = screen.getByRole("button", { name: "Act" })
        const others = ["primary", "secondary", "danger", "danger-soft", "tertiary", "outline", "ghost"].filter((v) => v !== variant)

        expect(button.closest("[data-grammar-alert-actions]")).toBeTruthy()
        expect(button.classList.contains(`button--${variant}`)).toBe(true)
        for (const other of others) expect(button.classList.contains(`button--${other}`)).toBe(false)
        expect(button.classList.contains("button--sm")).toBe(true)
    })
})

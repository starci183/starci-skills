// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FAMILY_WRAPS, expectedFamilyScope } from "../../../__test__/grammarRoots.js"
import { Stepper, stepStateFor } from "./index.js"

afterEach(cleanup)

const steps = [
    { id: "account", label: "Account" },
    { id: "details", label: "Details", description: "Tell us more" },
    { id: "review", label: "Review" },
    { id: "done", label: "Done" },
]

describe("stepStateFor", () => {
    it("derives complete/current/upcoming from position and honours explicit states", () => {
        expect(steps.map((_, index) => stepStateFor(steps, "review", index))).toEqual(["complete", "complete", "current", "upcoming"])
        const withError = steps.map((step) => step.id === "details" ? { ...step, state: "error" as const } : step)
        expect(stepStateFor(withError, "review", 1)).toBe("error")
    })
})

describe.each(FAMILY_WRAPS)("Stepper under %s", (family, wrap) => {
    it("renders an ordered, named progress list with one current step", () => {
        render(wrap(<Stepper label="Sign-up progress" steps={steps} currentStepId="details" stateLabel={(state) => state === "complete" ? "completed" : undefined} />))
        expect(screen.getByTestId("grammar-root").getAttribute("data-grammar-family")).toBe(expectedFamilyScope(family))
        const nav = screen.getByRole("navigation", { name: "Sign-up progress" })
        expect(nav.getAttribute("data-component")).toBe("Stepper")
        expect(nav.getAttribute("data-grammar-stepper-orientation")).toBe("horizontal")
        expect(nav.getAttribute("data-grammar-stepper-interactive")).toBe("false")
        const items = screen.getAllByRole("listitem")
        expect(items.map((item) => item.getAttribute("data-grammar-step-state"))).toEqual(["complete", "current", "upcoming", "upcoming"])
        expect(items.map((item) => item.getAttribute("aria-current"))).toEqual([null, "step", null, null])
        expect(items[1]?.getAttribute("data-grammar-current")).toBe("true")
        expect(items[0]?.textContent).toContain("completed")
        expect(items[1]?.querySelector("[data-grammar-step-description]")?.textContent).toBe("Tell us more")
        expect(screen.queryAllByRole("button")).toHaveLength(0)
    })

    it("makes steps buttons with arrow-key movement when selectable", () => {
        const onStepSelect = vi.fn()
        render(wrap(<Stepper label="Progress" orientation="vertical" steps={steps.map((step) => step.id === "done" ? { ...step, isDisabled: true } : step)} currentStepId="details" onStepSelect={onStepSelect} />))
        expect(screen.getByRole("navigation").getAttribute("data-grammar-stepper-orientation")).toBe("vertical")
        const buttons = screen.getAllByRole("button")
        expect(buttons).toHaveLength(4)
        buttons[0]?.focus()
        fireEvent.keyDown(buttons[0]!, { key: "ArrowDown" })
        expect(document.activeElement).toBe(buttons[1])
        fireEvent.keyDown(buttons[1]!, { key: "End" })
        // The disabled final step is skipped.
        expect(document.activeElement).toBe(buttons[2])
        fireEvent.keyDown(buttons[2]!, { key: "Home" })
        expect(document.activeElement).toBe(buttons[0])
        fireEvent.click(buttons[2]!)
        expect(onStepSelect).toHaveBeenCalledWith("review")
        expect((buttons[3] as HTMLButtonElement).disabled).toBe(true)
    })
})

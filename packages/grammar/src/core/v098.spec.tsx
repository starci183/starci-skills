// @vitest-environment jsdom
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { installDomShims } from "../__test__/grammarRoots.js"
import { COMMON_GRAMMAR_COMPONENTS, ComboBox, Disclosure, Input, SearchField, Select, Textarea } from "../common/index.js"

installDomShims()
afterEach(cleanup)

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8")
const rules = (source: string) => [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1]!.trim(), body: m[2]! }))
const forms = read("../common/components-forms.css")
const navigation = read("../common/components-navigation.css")
const overlays = read("../common/components-overlays.css")
const offsetPopForms = read("../offset-pop/components-forms.css")
const packageJson = JSON.parse(read("../../package.json")) as { version: string }
const changelog = read("../../CHANGELOG.md")
/** A needle ending in " {" must be a whole selector of a rule; any other needle is a substring of the selector list. */
const body = (source: string, selector: string) => {
    const exact = selector.endsWith(" {") ? selector.slice(0, -2) : null
    return rules(source)
        .filter((r) => exact === null ? r.selector.includes(selector) : r.selector.replace(/\/\*[\s\S]*?\*\//g, "").split(",").some((part) => part.trim() === exact))
        .map((r) => r.body)
        .join("\n")
}
/** The rule whose selector list names every hook. */
const anatomy = rules(forms).find((r) => [".starci-core-input-field", ".starci-core-select-trigger", ".starci-core-combo-box-group", ".starci-core-search-field-group", ".starci-core-number-field-group", ".starci-core-date-group"].every((hook) => r.selector.includes(hook)))

const LONG = "Enterprise annual plan with dedicated onboarding, priority support and a custom data retention agreement"
const OPTIONS = [{ id: "long", label: LONG, description: "Billed yearly" }, { id: "short", label: "Short" }]

describe("0.9.8: one single-line field anatomy", () => {
    it("is at 0.9.8 with a changelog entry and adds no catalog component", () => {
        expect(packageJson.version).toBe("0.9.8")
        expect(changelog).toContain("## 0.9.8 - 2026-10-12")
        expect(Object.keys(COMMON_GRAMMAR_COMPONENTS)).toHaveLength(104)
    })

    it("gives Input, Select, ComboBox, SearchField, NumberField and the date fields one radius token, one min-height and border-box sizing", () => {
        expect(anatomy, "one shared anatomy rule").toBeDefined()
        expect(anatomy!.body).toContain("border-radius: var(--field-radius")
        expect(anatomy!.body).toContain("min-block-size: var(--starci-core-field-min-height, 2.5rem)")
        expect(anatomy!.body).toContain("box-sizing: border-box")
        expect(body(forms, ".starci-core-field-control > :where(input:not(")).toContain("min-height: var(--starci-core-field-min-height, 2.5rem)")
    })

    it("makes the ComboBox input take the group's corner and height, with the trigger 0.5rem from the end like the Select chevron", () => {
        expect(body(forms, ".starci-core-combo-box-group {")).toContain("align-items: stretch")
        const input = body(forms, ".starci-core-combo-box-input {")
        expect(input).toContain("border-radius: inherit")
        expect(input).toContain("padding-inline: 0.75rem 1.75rem")
        expect(input).toContain("text-overflow: ellipsis")
        expect(body(forms, ".starci-core-combo-box-trigger {")).toContain("padding-inline-end: 0.5rem")
        expect(body(forms, ".starci-core-select-trigger {")).toContain("padding-inline: 0.75rem 1.75rem")
    })

    it("keeps the touch floor above the field minimum", () => {
        expect(forms).toMatch(/@media \(pointer: coarse\), \(max-width: 40rem\) \{[\s\S]*?\.starci-core-combo-box-group,[\s\S]*?min-block-size: var\(--starci-core-control-min-size, 2\.75rem\)/)
    })

    it("paints the Offset Pop ComboBox on its group, the input inside is bare text", () => {
        const rule = body(offsetPopForms, '[data-component="ComboBox"] .starci-core-combo-box-input')
        expect(rule).toContain("background: transparent")
        expect(rule).toContain("border-radius: inherit")
        expect(rule).toContain("border: 0")
        expect(offsetPopForms).toMatch(/\[data-component="ComboBox"\] \[data-grammar-field-control="true"\],/)
    })
})

describe("0.9.8: the selected value stays on one line", () => {
    it("ellipsizes the Select value, shows only the label and never wraps", () => {
        const value = body(forms, ".starci-core-select-value {")
        expect(value).toContain("white-space: nowrap")
        expect(value).toContain("text-overflow: ellipsis")
        expect(value).toContain("overflow: hidden")
        expect(value).toContain("overflow-wrap: normal")
        expect(body(forms, ".starci-core-select-value .starci-core-list-option-description")).toContain("display: none")
        expect(body(forms, ".starci-core-select-value .starci-core-list-option-label")).toContain("overflow-wrap: normal")
        // popover options keep wrapping
        expect(body(forms, ".starci-core-list-option-label {")).toContain("overflow-wrap: anywhere")
    })

    it("keeps the full selected text as the Select value title (default and chosen value)", () => {
        const { container } = render(<Select label="Plan" options={OPTIONS} defaultValue="long" />)
        expect(container.querySelector(".starci-core-select-value-text")?.getAttribute("title")).toBe(LONG)
    })

    it("has no Select title while nothing is selected, and follows a controlled value", () => {
        const { container, rerender } = render(<Select label="Plan" options={OPTIONS} />)
        expect(container.querySelector(".starci-core-select-value-text")).toBeNull()
        rerender(<Select label="Plan" options={OPTIONS} value="short" />)
        expect(container.querySelector(".starci-core-select-value-text")?.getAttribute("title")).toBe("Short")
    })

    it("keeps the full ComboBox text as the input title", () => {
        const { container } = render(<ComboBox label="Plan" options={OPTIONS} defaultValue="long" />)
        expect(container.querySelector(".starci-core-combo-box-input")?.getAttribute("title")).toBe(LONG)
    })
})

describe("0.9.8: every emitted skeleton and flow-graph root has a rule", () => {
    it("styles the roots in their group sheets", () => {
        expect(forms).toMatch(/\.starci-core-field-skeleton \{/)
        expect(body(forms, ".starci-core-field-skeleton {")).toContain("pointer-events: none")
        expect(body(navigation, ".starci-core-list-box-skeleton {")).toContain("flex-direction: column")
        expect(body(overlays, ".starci-core-meter-skeleton {")).toContain("flex-direction: column")
        expect(body(navigation, ".starci-core-flow-graph-background")).toContain("position: absolute")
        expect(body(navigation, ".starci-core-flow-graph .starci-core-flow-graph-edge {")).toContain("pointer-events: none")
    })
})

describe("0.9.8: Input hooks for an app drawer", () => {
    it("forwards onBlur, onPaste and autoFocus to the input", () => {
        const onBlur = vi.fn()
        const onPaste = vi.fn()
        render(<Input id="n" name="n" label="Name" onBlur={onBlur} onPaste={onPaste} autoFocus />)
        const input = screen.getByLabelText("Name")
        expect(document.activeElement).toBe(input)
        fireEvent.paste(input, { clipboardData: { getData: () => "pasted" } })
        expect(onPaste).toHaveBeenCalledTimes(1)
        expect(onPaste.mock.calls[0]![0].clipboardData.getData("text")).toBe("pasted")
        fireEvent.blur(input)
        expect(onBlur).toHaveBeenCalledTimes(1)
    })

    it("hides the label visually but keeps it as the accessible name with isLabelHidden", () => {
        const { container } = render(<Input id="l" name="l" label="Liên kết 1" isLabelHidden />)
        expect(screen.getByLabelText("Liên kết 1")).toBe(container.querySelector("input"))
        expect(container.querySelector("label")?.className).toContain("starci-core-form-label--screen-reader")
        cleanup()
        const shown = render(<Input id="l" name="l" label="Liên kết 1" />)
        expect(shown.container.querySelector("label")?.className ?? "").not.toContain("screen-reader")
    })

    it("does not focus or call anything unasked", () => {
        render(<Input id="n" name="n" label="Name" />)
        expect(document.activeElement).not.toBe(screen.getByLabelText("Name"))
    })

    it("gives SearchField and Textarea the same three hooks", () => {
        const onBlur = vi.fn()
        const onPaste = vi.fn()
        render(<><SearchField label="Find" onBlur={onBlur} onPaste={onPaste} autoFocus /><Textarea label="Notes" onBlur={onBlur} onPaste={onPaste} /></>)
        const search = screen.getByLabelText("Find")
        const notes = screen.getByLabelText("Notes")
        expect(document.activeElement).toBe(search)
        fireEvent.paste(search)
        fireEvent.paste(notes)
        expect(onPaste).toHaveBeenCalledTimes(2)
        fireEvent.blur(notes)
        expect(onBlur).toHaveBeenCalledTimes(1)
    })

    it("reserves no space for the error and names the control box a row can align to", () => {
        const plain = render(<Input id="a" name="a" label="Name" />)
        expect(plain.container.querySelector('[data-grammar-input-control="true"]')).not.toBeNull()
        expect(plain.container.querySelector("[slot='errorMessage'], .field-error")).toBeNull()
        plain.unmount()
        const failed = render(<Input id="a" name="a" label="Name" errorMessage="Required" />)
        const control = failed.container.querySelector('[data-grammar-input-control="true"]')!
        // the error is the last child of the field, after the control box: nothing above it moves
        expect(control.nextElementSibling?.textContent).toBe("Required")
        expect(control.parentElement?.lastElementChild).toBe(control.nextElementSibling)
        expect(body(read("../common/styles.css"), ".starci-core-input {")).toContain("display: grid")
    })
})

describe("0.9.8: Disclosure summary", () => {
    it("renders the summary at the trigger's trailing end, as its description and not its name", () => {
        render(<Disclosure title="Filters" summary="3 active">Body</Disclosure>)
        const trigger = screen.getByRole("button", { name: "Filters" })
        const summary = trigger.querySelector(".starci-core-disclosure-summary")!
        expect(summary.textContent).toBe("3 active")
        expect(summary.getAttribute("aria-hidden")).toBe("true")
        expect(trigger.getAttribute("aria-describedby")).toBe(summary.id)
        const kids = [...trigger.children]
        expect(kids.indexOf(summary)).toBeGreaterThan(kids.findIndex((k) => k.classList.contains("starci-core-disclosure-title")))
        expect(kids.indexOf(summary)).toBeLessThan(kids.findIndex((k) => k.classList.contains("starci-core-disclosure-indicator")))
    })

    it("stays visible closed and open, and is absent when not passed", () => {
        render(<Disclosure title="Filters" summary="3 active" defaultExpanded>Body</Disclosure>)
        const trigger = screen.getByRole("button", { name: "Filters" })
        expect(trigger.querySelector(".starci-core-disclosure-summary")).not.toBeNull()
        fireEvent.click(trigger)
        expect(trigger.querySelector(".starci-core-disclosure-summary")).not.toBeNull()
        cleanup()
        render(<Disclosure title="Plain">Body</Disclosure>)
        const plain = screen.getByRole("button", { name: "Plain" })
        expect(plain.querySelector(".starci-core-disclosure-summary")).toBeNull()
        expect(plain.hasAttribute("aria-describedby")).toBe(false)
    })

    it("styles the summary muted and on one line with an ellipsis", () => {
        const rule = body(navigation, ".starci-core-disclosure-summary {")
        expect(rule).toContain("color: var(--muted")
        expect(rule).toContain("white-space: nowrap")
        expect(rule).toContain("text-overflow: ellipsis")
        expect(rule).toContain("min-width: 0")
    })
})

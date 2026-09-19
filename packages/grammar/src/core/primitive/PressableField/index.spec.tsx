/** @vitest-environment jsdom */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { COMMON_SPACING_SCALE } from "../../../common/spacing.js"
import { PressableField } from "./index.js"
import {
    pressableFieldClassName,
    pressableFieldContentClassName,
    pressableFieldPlaceholderClassName,
    pressableFieldShortcutClassName,
} from "./classNames.js"

afterEach(cleanup)

/** jsdom rewrites `import.meta.url` to an http URL, so the sheet is resolved from the package root. */
const stylesPath = ["src/common/styles.css", "packages/grammar/src/common/styles.css"]
    .map((candidate) => resolve(process.cwd(), candidate))
    .find((candidate) => existsSync(candidate)) ?? ""
const css = readFileSync(stylesPath, "utf8")
const fieldCss = css.slice(css.indexOf(".starci-core-pressable-field {"), css.indexOf(".starci-core-horizontal-scroll-region {"))

const declarationsFor = (className: string) => [...fieldCss.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@media[^{]*\{/g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selector]) => (selector ?? "").split(",").map((part) => part.trim().split(/\s+/).at(-1) ?? "").some((subject) => new RegExp(`\\.${className}(?![\\w-])`).test(subject)))
    .flatMap(([, , body]) => (body ?? "").split(";"))
    .map((declaration) => declaration.split(":"))
    .filter((parts) => parts.length >= 2)
    .map((parts) => ({ property: (parts[0] ?? "").trim(), value: parts.slice(1).join(":").replace("!important", "").trim() }))

/** Same claims-versus-CSS rule the compositions follow: an id the DOM claims, the sheet must pay. */
const backsClaim = (claim: string, declarations: ReturnType<typeof declarationsFor>): boolean => {
    const [family = "", step = ""] = claim.split(/-(?=\d+$)/)
    const spacing = COMMON_SPACING_SCALE[Number(step) as keyof typeof COMMON_SPACING_SCALE]
    const withValue = (prefix: string) => spacing !== undefined && declarations.some((declaration) => declaration.property.startsWith(prefix) && declaration.value.split(/\s+/).includes(spacing))
    const withProperty = (...prefixes: ReadonlyArray<string>) => declarations.some((declaration) => prefixes.some((prefix) => declaration.property.startsWith(prefix)))
    switch (family) {
    case "PADDING": return withValue("padding")
    case "GAP": return withValue("gap")
    case "FONT": return withProperty("font-size", "font-weight")
    case "TONE": return withProperty("color")
    case "SURFACE": return withProperty("background")
    case "MEASURE": return withProperty("width", "inline-size")
    case "FLOW": return withProperty("text-overflow", "min-width")
    default: return false
    }
}

const SearchGlyph = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />

describe("Core PressableField", () => {
    it("is one named press target wearing field anatomy, never a text input", () => {
        const press = vi.fn()
        render(<PressableField label="Search the workspace" placeholder="Search" source={SearchGlyph} shortcut="Ctrl K" onPress={press} />)
        const field = screen.getByRole("button", { name: "Search the workspace" })
        expect(field.tagName).toBe("BUTTON")
        expect(field.getAttribute("type")).toBe("button")
        expect(field.className).toBe(pressableFieldClassName)
        expect(field.getAttribute("data-tier")).toBe("atom")
        expect(field.getAttribute("data-component")).toBe("PressableField")
        expect(screen.queryByRole("textbox")).toBeNull()
        expect(screen.getByText("Search").className).toBe(pressableFieldPlaceholderClassName)
        expect(field.querySelector(`.${pressableFieldContentClassName}`)).toBeTruthy()
        expect(field.querySelector("svg")).toBeTruthy()
        fireEvent.click(field)
        expect(press).toHaveBeenCalledTimes(1)
    })

    it("renders the shortcut hint as a kbd, and only when one is given", () => {
        const { container, rerender } = render(<PressableField label="Search" placeholder="Search" shortcut="Ctrl K" />)
        const hint = container.querySelector("kbd")
        expect(hint?.textContent).toBe("Ctrl K")
        expect(hint?.className).toBe(pressableFieldShortcutClassName)
        rerender(<PressableField label="Search" placeholder="Search" />)
        expect(container.querySelector("kbd")).toBeNull()
        expect(container.querySelector("svg")).toBeNull()
    })

    it("reports its disabled state and does not report a press while disabled", () => {
        const press = vi.fn()
        render(<PressableField label="Search" placeholder="Search" isDisabled onPress={press} />)
        const field = screen.getByRole("button", { name: "Search" })
        expect(field.hasAttribute("disabled")).toBe(true)
        expect(field.getAttribute("data-disabled")).toBe("true")
        fireEvent.click(field)
        expect(press).not.toHaveBeenCalled()
    })

    it("owns its geometry in the packaged stylesheet, from the field token contract", () => {
        expect(fieldCss).toContain(".starci-core-pressable-field {")
        expect(fieldCss).toMatch(/\.starci-core-pressable-field\s*\{[\s\S]*?width: 100%;/)
        expect(fieldCss).toMatch(/\.starci-core-pressable-field\s*\{[\s\S]*?height: 2\.25rem;/)
        expect(fieldCss).toMatch(/border-radius: var\(--field-radius, calc\(var\(--radius, 0\.5rem\) \* 1\.5\)\);/)
        expect(fieldCss).toContain("var(--field-background,")
        expect(fieldCss).toContain("var(--field-border,")
        expect(fieldCss).toContain("var(--field-foreground,")
        expect(fieldCss).toContain("var(--field-placeholder,")
        expect(fieldCss).toContain("box-shadow: var(--field-shadow, none);")
        expect(fieldCss).toContain(".starci-core-pressable-field:hover")
        expect(fieldCss).toContain(".starci-core-pressable-field:focus-visible")
        expect(fieldCss).toContain(".starci-core-pressable-field:disabled")
        expect(fieldCss).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.starci-core-pressable-field\s*\{[\s\S]*?transition: none;/)
    })

    it("backs every data-contract claim it emits with a shipped rule", () => {
        const { container } = render(<PressableField label="Search" placeholder="Search" source={SearchGlyph} shortcut="Ctrl K" />)
        const claimed = [...container.querySelectorAll("[data-contract]")]
        expect(claimed).toHaveLength(4)
        for (const element of claimed) {
            const className = [...element.classList].find((token) => token.startsWith("starci-core-pressable-field"))
            expect(className, `claimed element without a Grammar class: ${element.outerHTML.slice(0, 120)}`).toBeDefined()
            const declarations = declarationsFor(className ?? "")
            expect(declarations.length, `no shipped declarations for .${className}`).toBeGreaterThan(0)
            for (const claim of (element.getAttribute("data-contract") ?? "").split(" ").filter(Boolean)) {
                expect(backsClaim(claim, declarations), `claim ${claim} on .${className} is not backed by the stylesheet`).toBe(true)
            }
        }
    })
})

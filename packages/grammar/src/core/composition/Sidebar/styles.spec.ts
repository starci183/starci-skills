/** @vitest-environment jsdom */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { cleanup, render } from "@testing-library/react"
import { createElement } from "react"
import { afterEach, describe, expect, it } from "vitest"
import { COMMON_SPACING_SCALE } from "../../../common/spacing.js"
import { Sidebar, type SidebarProps } from "./index.js"

afterEach(cleanup)

/** jsdom rewrites `import.meta.url` to an http URL, so the sheet is resolved from the package root. */
const stylesPath = ["src/common/styles.css", "packages/grammar/src/common/styles.css"]
    .map((candidate) => resolve(process.cwd(), candidate))
    .find((candidate) => existsSync(candidate)) ?? ""
const css = readFileSync(stylesPath, "utf8")
const sidebarStart = css.indexOf(".starci-core-sidebar {")
const sidebarEnd = css.indexOf(".starci-core-chat-workspace {")
const sidebarCss = css.slice(sidebarStart, sidebarEnd)

type Declaration = { readonly property: string; readonly value: string }

/** Every declaration the sheet writes for one Grammar class, across all of its state selectors. */
const declarationsFor = (className: string): ReadonlyArray<Declaration> => {
    const flat = sidebarCss.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@media[^{]*\{/g, "")
    const rules = [...flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    const owns = new RegExp(`\\.${className}(?![\\w-])`)
    /** Only the SUBJECT of a selector owns its declarations; an ancestor state selector does not. */
    const subjects = (selector: string) => selector.split(",").map((part) => part.trim().split(/\s+/).at(-1) ?? "")
    return rules
        .filter(([, selector]) => subjects(selector ?? "").some((subject) => owns.test(subject)))
        .flatMap(([, , body]) => body.split(";"))
        .map((declaration) => declaration.split(":"))
        .filter((parts) => parts.length >= 2)
        .map((parts) => ({
            property: (parts[0] ?? "").trim(),
            value: parts.slice(1).join(":").replace("!important", "").trim(),
        }))
}

const hasValue = (declarations: ReadonlyArray<Declaration>, propertyPrefix: string, value: string) =>
    declarations.some((declaration) => declaration.property.startsWith(propertyPrefix) && declaration.value.split(/\s+/).includes(value))

const hasProperty = (declarations: ReadonlyArray<Declaration>, ...propertyPrefixes: ReadonlyArray<string>) =>
    declarations.some((declaration) => propertyPrefixes.some((prefix) => declaration.property.startsWith(prefix)))

/**
 * A `data-contract` claim is a promise about the paint, so the sheet has to keep it.
 *
 * Sidebar used to make these claims while its geometry lived in JSX utility strings, which meant
 * the claims were only true where a consumer's Tailwind build happened to scan the package. This
 * is the same check 0.4.1 applied to the other Core objects: every id the component emits must be
 * backed by a declaration on the class that carries it.
 */
const backsClaim = (claim: string, declarations: ReadonlyArray<Declaration>): boolean => {
    const [family = "", step = ""] = claim.split(/-(?=\d+$)/)
    const spacing = COMMON_SPACING_SCALE[Number(step) as keyof typeof COMMON_SPACING_SCALE]
    switch (family) {
    case "PADDING": return spacing !== undefined && hasValue(declarations, "padding", spacing)
    case "GAP": return spacing !== undefined && (hasValue(declarations, "gap", spacing) || hasValue(declarations, "row-gap", spacing) || hasValue(declarations, "column-gap", spacing))
    case "FONT": return hasProperty(declarations, "font-size", "font-weight")
    case "TONE": return hasProperty(declarations, "color")
    case "SURFACE": return hasProperty(declarations, "background")
    case "MEASURE": return hasProperty(declarations, "width", "inline-size")
    case "OVERFLOW": return hasProperty(declarations, "overflow")
    case "FLOW": return hasProperty(declarations, "text-overflow", "min-width")
    default: return false
    }
}

const HomeGlyph = (props: React.SVGProps<SVGSVGElement>) => createElement("svg", props)

const props: SidebarProps = {
    label: "Workspace",
    selectedKey: "home",
    collapseLabel: "Collapse",
    expandLabel: "Expand",
    toggleSource: HomeGlyph,
    header: createElement("span", null, "Resume"),
    footer: createElement("span", null, "Sign out"),
    onCollapsedChange: () => {},
    groups: [{ id: "main", label: "Main", items: [{ id: "home", label: "Home", source: HomeGlyph, trailing: createElement("span", null, "3") }] }],
}

const claimedElements = (element: Parameters<typeof render>[0]) => {
    const { container } = render(element)
    return [...container.querySelectorAll("[data-contract]")]
}

describe("Core Sidebar shipped geometry", () => {
    it("packages every Sidebar part in the stylesheet instead of a consumer's Tailwind build", () => {
        expect(sidebarStart).toBeGreaterThanOrEqual(0)
        expect(sidebarEnd).toBeGreaterThan(sidebarStart)
        for (const selector of [
            ".starci-core-sidebar",
            ".starci-core-sidebar-toggle",
            ".starci-core-sidebar-header",
            ".starci-core-sidebar-list",
            ".starci-core-sidebar-section",
            ".starci-core-sidebar-section-label",
            ".starci-core-sidebar-item",
            ".starci-core-sidebar-item-label",
            ".starci-core-sidebar-item-trailing",
            ".starci-core-sidebar-footer",
        ]) expect(sidebarCss, `missing shipped rule for ${selector}`).toContain(`${selector} {`)
    })

    it("draws the rail separator, both rail widths and the drawer width from tokens", () => {
        expect(sidebarCss).toMatch(/\.starci-core-sidebar\[data-presentation="rail"\]\s*\{[\s\S]*?border-inline-end: 1px solid var\(--separator, var\(--starci-core-separator, GrayText\)\);/)
        expect(sidebarCss).toMatch(/\.starci-core-sidebar\[data-presentation="rail"\]\s*\{[\s\S]*?width: var\(--starci-core-sidebar-width, 16rem\);/)
        expect(sidebarCss).toMatch(/\.starci-core-sidebar\[data-presentation="rail"\]\[data-collapsed="true"\]\s*\{[\s\S]*?width: var\(--starci-core-sidebar-collapsed-width, 4rem\);/)
        expect(sidebarCss).toMatch(/\.starci-core-sidebar\[data-presentation="drawer"\]\s*\{[\s\S]*?width: 100%;/)
    })

    it("uses the theme radius ramp rather than a radius name that emits nothing", () => {
        expect(sidebarCss).toContain("border-radius: var(--radius-xl, calc(var(--radius, 0.5rem) * 1.5))")
        expect(sidebarCss).toContain("border-radius: var(--starci-core-pill-radius, 999px)")
        expect(sidebarCss).not.toContain("rounded-large")
    })

    it("keeps the collapsed group label available to assistive technology only", () => {
        expect(sidebarCss).toMatch(/\[data-collapsed="true"\] \.starci-core-sidebar-section-label\s*\{[\s\S]*?position: absolute;[\s\S]*?clip: rect\(0, 0, 0, 0\);/)
    })

    it("keeps the width transition out of a reduced-motion render", () => {
        expect(sidebarCss).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.starci-core-sidebar\[data-presentation="rail"\]\s*\{[\s\S]*?transition: none;/)
    })

    it("carries every React Aria item state the component relies on", () => {
        for (const state of ["data-hovered", "data-selected", "data-focus-visible", "data-disabled"]) {
            expect(sidebarCss, `missing item state ${state}`).toContain(`.starci-core-sidebar-item[${state}="true"]`)
        }
    })

    it("can tell a backed claim from an unbacked one", () => {
        const list = declarationsFor("starci-core-sidebar-list")
        expect(backsClaim("PADDING-3", list)).toBe(true)
        expect(backsClaim("PADDING-8", list)).toBe(false)
        expect(backsClaim("GAP-1", list)).toBe(true)
        expect(backsClaim("GAP-6", list)).toBe(false)
        expect(backsClaim("TONE-1", declarationsFor("starci-core-sidebar-item-trailing"))).toBe(false)
    })

    it("backs every data-contract claim it emits with a shipped rule", () => {
        const elements = [
            ...claimedElements(createElement(Sidebar, props)),
            ...claimedElements(createElement(Sidebar, { ...props, isCollapsed: true })),
            ...claimedElements(createElement(Sidebar, { ...props, presentation: "drawer" })),
        ]
        expect(elements.length).toBeGreaterThan(0)
        for (const element of elements) {
            const className = [...element.classList].find((token) => token.startsWith("starci-core-sidebar"))
            expect(className, `claimed element without a Grammar class: ${element.outerHTML.slice(0, 120)}`).toBeDefined()
            const declarations = declarationsFor(className ?? "")
            expect(declarations.length, `no shipped declarations for .${className}`).toBeGreaterThan(0)
            for (const claim of (element.getAttribute("data-contract") ?? "").split(" ").filter(Boolean)) {
                expect(backsClaim(claim, declarations), `claim ${claim} on .${className} is not backed by the stylesheet`).toBe(true)
            }
        }
    })
})

// @vitest-environment jsdom
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterAll, afterEach, describe, expect, it, vi } from "vitest"
import { COMMON_GRAMMAR_COMPONENTS, IconButton, Tabs } from "../common/index.js"

vi.stubGlobal("ResizeObserver", class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
})
afterEach(cleanup)
const getAnimationsDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "getAnimations")
Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] })
afterAll(() => {
    if (getAnimationsDescriptor) Object.defineProperty(Element.prototype, "getAnimations", getAnimationsDescriptor)
    else Reflect.deleteProperty(Element.prototype, "getAnimations")
})

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8")
const rules = (source: string) => [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1]!.trim(), body: m[2]! }))
const body = (source: string, needle: string) => rules(source).filter((r) => r.selector.includes(needle)).map((r) => r.body).join("\n")
const styles = read("../common/styles.css")
const navigation = read("../common/components-navigation.css")
const offsetPopNavigation = read("../offset-pop/components-navigation.css")
const offsetPopStyles = read("../offset-pop/styles.css")
const packageJson = JSON.parse(read("../../package.json")) as { version: string }
const changelog = read("../../CHANGELOG.md")
const Glyph = () => <svg aria-hidden="true" />
const items = [{ id: "overview", label: "Overview" }, { id: "members", label: "Members" }]

describe("0.9.9: Tabs variant", () => {
    it("is at 0.9.9 with a changelog entry and adds no catalog component", () => {
        expect(packageJson.version).toBe("0.9.9")
        expect(changelog).toContain("## 0.9.9 - 2026-10-12")
        expect(Object.keys(COMMON_GRAMMAR_COMPONENTS)).toHaveLength(104)
    })

    it("defaults to primary and exposes the variant on the frame, pending and ready", () => {
        expect(renderToStaticMarkup(<Tabs label="Areas" selectedKey="overview" items={items} />)).toContain('data-grammar-tabs-variant="primary"')
        expect(renderToStaticMarkup(<Tabs label="Areas" selectedKey="overview" items={items} variant="secondary" />)).toContain('data-grammar-tabs-variant="secondary"')
        const { container } = render(<Tabs label="Areas" selectedKey="overview" items={items} />)
        expect(container.querySelector("[data-grammar-tabs-variant='primary']")).not.toBeNull()
    })

    it("keeps tablist / tab / tabpanel wiring, selection, labelVisibility and inset on the secondary strip", async () => {
        const onSelect = vi.fn()
        const { container } = render(<>
            <Tabs label="Drawer sections" variant="secondary" labelVisibility="always" inset="page" selectedKey="overview" items={items} onSelect={onSelect} panelId={(key) => `drawer-${key}`} />
            <section id="drawer-overview" role="tabpanel" aria-label="Overview">a</section>
            <section id="drawer-members" role="tabpanel" aria-label="Members" hidden>b</section>
        </>)
        expect(container.querySelector("[data-grammar-tabs-variant='secondary'][data-grammar-tab-labels='always'][data-grammar-tabs-inset='page']")).not.toBeNull()
        expect(screen.getByRole("tablist", { name: "Drawer sections" })).not.toBeNull()
        await waitFor(() => expect(screen.getByRole("tab", { name: "Members" }).getAttribute("aria-controls")).toBe("drawer-members"))
        expect(screen.getByRole("tab", { name: "Overview" }).getAttribute("aria-selected")).toBe("true")
        fireEvent.click(screen.getByRole("tab", { name: "Members" }))
        expect(onSelect).toHaveBeenCalledWith("members")
    })

    it("paints the secondary strip as a soft track with an accent-soft pill, scoped to the variant", () => {
        const scope = '.starci-core-tabs-frame[data-grammar-tabs-variant="secondary"]'
        expect(body(navigation, `${scope} .tabs__list-container`)).toContain("background: var(--default")
        expect(body(navigation, `${scope} .tabs__indicator`)).toContain("background: var(--accent-soft")
        expect(body(navigation, `${scope} .tabs__tab[data-selected="true"]`)).toContain("color: var(--accent-soft-foreground")
        expect(body(navigation, `${scope} .tabs__indicator`)).toContain("height: 100% !important")
        expect(navigation).toMatch(/@media \(pointer: coarse\), \(max-width: 40rem\) \{\s*\.starci-core-tabs-frame\[data-grammar-tabs-variant="secondary"\] \.tabs__tab/)
        // the primary underline rules are not variant-scoped and stay where they were
        expect(styles).toContain(".starci-core-tabs .tabs__indicator")
        expect(navigation).not.toMatch(/^\s*\.starci-core-tabs \.tabs__indicator/m)
    })

    it("gives Offset Pop an ink-outlined strip with a pink selected pill", () => {
        const scope = '[data-component="Tabs"][data-grammar-tabs-variant="secondary"]'
        expect(body(offsetPopNavigation, `${scope} .tabs__list-container`)).toContain("border: var(--offset-pop-outline-width) solid var(--offset-pop-ink)")
        expect(body(offsetPopNavigation, `${scope} .tabs__indicator`)).toContain("background: var(--offset-pop-pink)")
    })
})

describe("0.9.9: IconButton danger-soft", () => {
    it("renders the variant with the same label requirement, sizes and hooks", () => {
        const markup = renderToStaticMarkup(<IconButton source={Glyph} label="Delete row" variant="danger-soft" />)
        expect(markup).toContain('data-variant="danger-soft"')
        expect(markup).toContain('aria-label="Delete row"')
        expect(markup).toContain('data-component="IconButton"')
        expect(markup).toContain('data-size="md"')
        expect(renderToStaticMarkup(<IconButton source={Glyph} label="Delete row" variant="danger-soft" size="lg" />)).toContain('data-size="lg"')
    })

    it("paints the danger soft plate and a stronger hover from the danger tokens", () => {
        const rule = body(styles, '.starci-core-icon-button[data-variant="danger-soft"]')
        expect(rule).toContain("--button-bg: var(--danger-soft")
        expect(rule).toContain("--button-bg-hover: var(--danger-soft-hover")
        expect(rule).toContain("--button-fg: var(--danger-soft-foreground")
        expect(rule).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i)
    })

    it("gives Offset Pop the ink outline and a small hard offset", () => {
        const rule = body(offsetPopStyles, '[data-component="IconButton"][data-variant="danger-soft"]')
        expect(rule).toContain("border: var(--offset-pop-outline-width) solid var(--border)")
        expect(rule).toContain("box-shadow: 0.125rem 0.125rem 0 var(--offset-pop-shadow-ink)")
    })
})

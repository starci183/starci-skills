// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createElement } from "react"
import { afterEach, describe, expect, it } from "vitest"
import { COMMON_OVERLAYS_COMPONENTS, Dialog, DropdownMenu, Popover, Toaster, createToastQueue } from "../common/renderers-overlays.js"
import { Button } from "../common/renderers.js"
import { OffsetPopGrammarRoot } from "./index.js"

afterEach(cleanup)

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8")
const css = read("src/offset-pop/components-overlays.css")
const commonCss = read("src/common/components-overlays.css")
const rendererSource = [
    "src/core/branch/AlertDialog/index.tsx",
    "src/core/branch/Dialog/index.tsx",
    "src/core/branch/Drawer/index.tsx",
    "src/core/branch/DropdownMenu/index.tsx",
    "src/core/branch/Popover/index.tsx",
    "src/core/branch/Toast/index.tsx",
    "src/core/composite/Alert/index.tsx",
    "src/core/primitive/CloseButton/index.tsx",
    "src/core/primitive/Kbd/index.tsx",
    "src/core/primitive/Meter/index.tsx",
    "src/core/primitive/ProgressCircle/index.tsx",
    "src/core/primitive/Skeleton/index.tsx",
    "src/core/primitive/Spinner/index.tsx",
    "src/core/primitive/Button/index.tsx",
].map(read).join("\n")

/** The family hook each new Common component is treated through. */
const COMPONENT_HOOKS: Readonly<Record<keyof typeof COMMON_OVERLAYS_COMPONENTS, string>> = {
    Alert: "[data-component=\"Alert\"]",
    AlertDialog: "[data-component=\"AlertDialog\"]",
    CloseButton: "[data-component=\"CloseButton\"]",
    Dialog: "[data-grammar-overlay-surface=\"dialog\"]",
    Drawer: "[data-grammar-overlay-surface=\"drawer\"]",
    DropdownMenu: "[data-grammar-overlay-surface=\"menu\"]",
    Kbd: "[data-component=\"Kbd\"]",
    Meter: "[data-component=\"Meter\"]",
    Popover: "[data-grammar-overlay-surface=\"popover\"]",
    ProgressCircle: "[data-component=\"ProgressCircle\"]",
    Skeleton: "[data-component=\"Skeleton\"]",
    Spinner: "[data-component=\"Spinner\"]",
    Toast: "[data-component=\"Toast\"]",
    Toaster: "[data-component=\"Toaster\"]",
}

const selectorLines = css
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith(".grammar-common-root"))

describe("Offset Pop overlay and feedback treatment CSS", () => {
    it("is one Offset Pop layer, scoped to the family root, importing nothing", () => {
        expect(css).toContain("@layer starci-grammar-offset-pop {")
        expect(css).not.toContain("@import")
        expect(css).not.toContain("data-grammar-family=\"core\"")
        expect(selectorLines.length).toBeGreaterThan(30)
        for (const selector of selectorLines) expect(selector).toContain("[data-grammar-family=\"offset-pop\"]")
    })

    it("targets every new overlay/feedback component through a hook its renderer emits", () => {
        for (const [component, hook] of Object.entries(COMPONENT_HOOKS)) {
            expect(css, `${component} has no Offset Pop treatment`).toContain(hook)
        }
        const hooks = new Set(Array.from(css.matchAll(/\[(data-component|data-grammar-[a-z-]+)(?:=|\])/g), (match) => match[1]))
        for (const hook of hooks) {
            if (hook === "data-grammar-family" || hook === "data-grammar-theme") continue
            expect(rendererSource, `${hook} is not emitted by a renderer`).toContain(hook)
        }
        const components = Array.from(css.matchAll(/\[data-component="([A-Za-z]+)"\]/g), (match) => match[1])
        for (const name of new Set(components)) expect(rendererSource).toContain(`data-component="${name}"`)
    })

    it("carries the family signature: ink outline, hard offset shadow, blush backdrop, pink decision accent", () => {
        const surface = css.slice(css.indexOf("[data-grammar-overlay-surface] {"))
        const surfaceBlock = surface.slice(0, surface.indexOf("}"))
        expect(surfaceBlock).toContain("border: var(--offset-pop-outline-width) solid var(--border)")
        expect(surfaceBlock).toContain("box-shadow: var(--offset-pop-shadow-x) var(--offset-pop-shadow-y) 0 var(--offset-pop-shadow-ink)")
        expect(css).toMatch(/\[data-grammar-overlay-backdrop\] \{\s+background: color-mix\(in srgb, var\(--offset-pop-blush\)/)
        expect(css).toMatch(/\[data-grammar-overlay-action="confirm"\] > \[data-component="Button"\],[\s\S]*?background: var\(--accent\)/)
    })

    it("keeps reduced motion, scoped dark theme and forced colors", () => {
        expect(css).toContain("@media (prefers-reduced-motion: reduce)")
        expect(css).toContain("[data-grammar-theme=\"dark\"]")
        expect(css).toContain("[data-grammar-theme=\"system\"]")
        expect(css).toContain("@media (forced-colors: active)")
        expect(commonCss).toContain("@media (prefers-reduced-motion: reduce)")
        expect(commonCss).toContain("@media (forced-colors: active)")
    })
})

describe("Offset Pop selectors reach portalled overlays", () => {
    const surfaceSelector = ".grammar-common-root[data-grammar-family=\"offset-pop\"] [data-grammar-overlay-surface]"
    const backdropSelector = ".grammar-common-root[data-grammar-family=\"offset-pop\"] [data-grammar-overlay-backdrop]"

    it("matches a dialog surface and its backdrop, because the portal lands inside the family root", async () => {
        render(createElement(OffsetPopGrammarRoot, null, createElement(Dialog, { title: "Scoped", defaultOpen: true })))
        const dialog = await screen.findByRole("dialog")
        expect(css).toContain(surfaceSelector)
        expect(dialog.matches(surfaceSelector)).toBe(true)
        expect(dialog.closest("[data-grammar-overlay-backdrop]")?.matches(backdropSelector)).toBe(true)
    })

    it("matches popover and menu surfaces", async () => {
        render(createElement(OffsetPopGrammarRoot, null,
            createElement(Popover, { label: "Scoped popover", defaultOpen: true, trigger: createElement(Button, null, "Open popover") }, "Body"),
        ))
        const panel = await screen.findByRole("dialog", { name: "Scoped popover" })
        expect(panel.closest("[data-grammar-overlay-surface]")?.matches(surfaceSelector)).toBe(true)
        cleanup()

        render(createElement(OffsetPopGrammarRoot, null,
            createElement(DropdownMenu, { defaultOpen: true, trigger: createElement(Button, null, "Menu"), entries: [{ id: "a", label: "Alpha" }] }),
        ))
        const menu = await screen.findByRole("menu")
        expect(menu.closest("[data-grammar-overlay-surface]")?.matches(surfaceSelector)).toBe(true)
    })

    it("matches toasts rendered by an in-place Toaster", () => {
        const queue = createToastQueue()
        render(createElement(OffsetPopGrammarRoot, null, createElement(Toaster, { label: "Notifications", dismissLabel: "Dismiss", queue })))
        act(() => { queue.add({ title: "Hello" }) })
        const toast = document.querySelector("[data-component=\"Toast\"]")
        expect(toast?.matches(".grammar-common-root[data-grammar-family=\"offset-pop\"] [data-component=\"Toast\"]")).toBe(true)
    })
})

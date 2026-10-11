import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ChatBubble } from "./composite/ChatBubble/index.js"
import { IconButton } from "./primitive/IconButton/index.js"
import { Progress } from "./primitive/Progress/index.js"

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8")
const css = read("../common/styles.css") + read("../common/components-overlays.css")
const Glyph = () => <svg />

describe("0.9.3 additions", () => {
    it("Progress step mode draws one segment per step, filled up to the current one, as a named progressbar", () => {
        const html = renderToStaticMarkup(<Progress label="Setup" steps={{ total: 5, completed: 3 }} valueText="Step 3 of 5" />)
        expect(html).toContain('role="progressbar"')
        expect(html).toContain('aria-valuemax="5"')
        expect(html).toContain('aria-valuenow="3"')
        expect(html).toContain('aria-valuetext="Step 3 of 5"')
        expect(html.match(/data-grammar-progress-step="done"/g)).toHaveLength(3)
        expect(html.match(/data-grammar-progress-step="todo"/g)).toHaveLength(2)
        expect(html).toContain("grid-template-columns:repeat(5, minmax(0, 1fr))")
    })

    it("Progress step mode clamps out-of-range counts", () => {
        const html = renderToStaticMarkup(<Progress label="Setup" steps={{ total: 3, completed: 9 }} />)
        expect(html).toContain('aria-valuenow="3"')
        expect(html).toContain('aria-valuetext="3 / 3"')
        expect(html).not.toContain('data-grammar-progress-step="todo"')
    })

    it("a step segment is the small bar's height and fills with the accent", () => {
        expect(css).toMatch(/\.starci-core-progress-step \{[\s\S]*?height: 0\.25rem;/)
        expect(css).toContain('.starci-core-progress-step[data-grammar-progress-step="done"] { background: var(--accent, Highlight); }')
    })

    it("Label is always the full foreground", () => {
        expect(css).toMatch(/\.starci-core-label \{[\s\S]*?color: var\(--foreground, CanvasText\);/)
    })

    it("an overlay header keeps its title and close action on one row over the vendor's column header", () => {
        expect(css).toMatch(/\.starci-core-overlay-header \{[\s\S]*?flex-direction: row !important;/)
        expect(css).toContain(".starci-core-overlay-header > .starci-core-close-button")
    })

    it("a ChatBubble footer stretches over a definite stack width", () => {
        const html = renderToStaticMarkup(<ChatBubble footer={<div>card</div>}>Hi</ChatBubble>)
        expect(html).toContain('data-grammar-bubble-footer="true"')
        expect(renderToStaticMarkup(<ChatBubble>Hi</ChatBubble>)).toContain('data-grammar-bubble-footer="false"')
        expect(css).toContain('.starci-core-chat-bubble[data-grammar-bubble-footer="true"] .starci-core-chat-bubble-stack { width: min(40rem, 85%); }')
        expect(css).toMatch(/\.starci-core-chat-bubble-footer \{ align-self: stretch; width: 100%;/)
    })

    it("IconButton offers the accent plate, a large size and floating elevation", () => {
        const html = renderToStaticMarkup(<IconButton source={Glyph} label="Ask NIVO" variant="primary" size="lg" isFloating />)
        expect(html).toContain('data-variant="primary"')
        expect(html).toContain('data-size="lg"')
        expect(html).toContain('data-floating="true"')
        const quiet = renderToStaticMarkup(<IconButton source={Glyph} label="Menu" />)
        expect(quiet).toContain('data-size="md"')
        expect(quiet).toContain('data-floating="false"')
        expect(css).toMatch(/\.starci-core-icon-button\[data-size="lg"\] \{[\s\S]*?width: 3\.5rem !important;/)
    })
})

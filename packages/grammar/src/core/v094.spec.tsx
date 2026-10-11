import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { List } from "./primitive/List/index.js"
import { ListItem } from "./primitive/ListItem/index.js"
import { Region } from "./primitive/Region/index.js"

const css = readFileSync(fileURLToPath(new URL("../common/styles.css", import.meta.url)), "utf8")
const baseLayer = css.slice(css.lastIndexOf("@layer base {"))
const commonLayer = css.slice(0, css.lastIndexOf("@layer base {"))

describe("0.9.4: a layout className on the semantic structure primitives wins", () => {
    it.each([".starci-core-semantic-list {", ".starci-core-semantic-list-item {", ".starci-core-region {"])("%s is a base-layer reset, not a grammar-layer rule", (selector) => {
        expect(baseLayer).toContain(selector)
        expect(commonLayer).not.toContain(selector)
    })

    it("the base layer comes after the grammar layer statement, at the top level of the sheet", () => {
        expect(css.indexOf("@layer starci-grammar-common, starci-grammar-core")).toBeLessThan(css.lastIndexOf("@layer base {"))
        expect(baseLayer.trimEnd().endsWith("}")).toBe(true)
    })

    it("keeps the prop-driven Region spacing in the grammar layer", () => {
        expect(commonLayer).toContain('.starci-core-region[data-grammar-region-spacing="spaced"]')
    })

    it("passes the app className through beside the hook class", () => {
        expect(renderToStaticMarkup(<List className="grid gap-3"><ListItem className="flex py-3">a</ListItem></List>))
            .toMatch(/class="starci-core-semantic-list grid gap-3"[\s\S]*class="starci-core-semantic-list-item flex py-3"/)
        expect(renderToStaticMarkup(<Region label="Leads" className="flex">x</Region>)).toContain('class="starci-core-region flex"')
    })
})

import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ListItem } from "../ListItem/index.js"
import { List } from "./index.js"

describe("Core List and ListItem", () => {
    it("renders a real unordered list of real list items", () => {
        const markup = renderToStaticMarkup(<List label="Members"><ListItem>Ada</ListItem><ListItem>Grace</ListItem></List>)

        expect(markup).toMatch(/^<ul /)
        expect(markup).toContain("aria-label=\"Members\"")
        expect(markup).toContain("data-component=\"List\"")
        expect(markup).toContain("<li class=\"starci-core-semantic-list-item\" data-component=\"ListItem\"")
        expect(markup).not.toContain("role=")
    })

    it("renders an ordered list on request", () => {
        const markup = renderToStaticMarkup(<List as="ol"><ListItem>First</ListItem></List>)

        expect(markup).toMatch(/^<ol /)
        expect(markup).not.toContain("aria-label")
    })
})

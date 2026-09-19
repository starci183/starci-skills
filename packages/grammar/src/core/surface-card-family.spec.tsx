import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { StaticStateRow, SurfaceCard, SurfaceListCard } from "../common/index.js"
import { HeritageGrammarRoot } from "../heritage/index.js"
import { CoreGrammarRoot } from "./index.js"

describe("Common SurfaceCard family material anatomy", () => {
    it("renders the HeroUI v3 Card compound root, header, and content slots", () => {
        const markup = renderToStaticMarkup(
            <CoreGrammarRoot>
                <SurfaceCard label="Progress"><p>42%</p></SurfaceCard>
            </CoreGrammarRoot>,
        )
        expect(markup).toContain("data-grammar-family=\"core\"")
        expect(markup).toMatch(/<section[^>]*data-slot="card"/)
        expect(markup).toMatch(/data-slot="card-header"[^>]*data-grammar-surface-label="true"/)
        expect(markup).toMatch(/data-slot="card-content"[^>]*data-grammar-frame="bounded"/)
        expect(markup).toContain("data-grammar-surface-labelled=\"true\"")
        const outer = markup.indexOf("data-grammar-surface-labelled=\"true\"")
        const label = markup.indexOf("data-grammar-surface-label=\"true\"", outer)
        const frame = markup.indexOf("data-grammar-frame=\"bounded\"", label)
        expect(outer).toBeGreaterThanOrEqual(0)
        expect(label).toBeGreaterThan(outer)
        expect(frame).toBeGreaterThan(label)
    })

    it("keeps identical Common anatomy under Heritage for its label-outside paint binding", () => {
        const markup = renderToStaticMarkup(
            <HeritageGrammarRoot>
                <SurfaceCard label="Overview"><p>Content</p></SurfaceCard>
            </HeritageGrammarRoot>,
        )
        expect(markup).toContain("data-grammar-family=\"heritage\"")
        expect(markup).toMatch(/<section[^>]*data-slot="card"/)
        const label = markup.indexOf("data-slot=\"card-header\"")
        const material = markup.indexOf("data-slot=\"card-content\"")
        expect(label).toBeGreaterThanOrEqual(0)
        expect(material).toBeGreaterThan(label)
    })
})

/**
 * One slot contract, two kinds of row.
 *
 * The rows of a verdict list are the caller's children, so no prop of the card can reach them. What
 * the card publishes instead is the attribute: a Grammar row emits it from a `verdict` prop, an
 * application row spells it, and the shipped edge selects both from inside the collection.
 */
describe("Common SurfaceListCard verdict rows", () => {
    it("emits the collection's verdict slot from the Grammar row's own prop", () => {
        const markup = renderToStaticMarkup(
            <CoreGrammarRoot>
                <SurfaceListCard label="Movement" isVerdict>
                    <StaticStateRow item={{ id: "up", label: "Ada", verdict: "success" }} />
                    <StaticStateRow item={{ id: "down", label: "Grace", verdict: "danger" }} />
                    <StaticStateRow item={{ id: "flat", label: "Linus" }} />
                </SurfaceListCard>
            </CoreGrammarRoot>,
        )
        expect(markup).toContain("data-grammar-collection=\"verdict\"")
        expect(markup).toContain("data-verdict=\"success\"")
        expect(markup).toContain("data-verdict=\"danger\"")
        const rows = markup.match(/<li[^>]*>/g) ?? []
        expect(rows).toHaveLength(3)
        expect(rows[2], "a row with no verdict emits no slot at all").not.toContain("data-verdict")
    })

    it("leaves an application-owned row's own verdict attribute untouched", () => {
        const markup = renderToStaticMarkup(
            <CoreGrammarRoot>
                <SurfaceListCard ariaLabel="Movement" isVerdict>
                    <div data-verdict="success">Ada</div>
                </SurfaceListCard>
            </CoreGrammarRoot>,
        )
        const collection = markup.indexOf("data-grammar-collection=\"verdict\"")
        expect(collection).toBeGreaterThanOrEqual(0)
        expect(markup.indexOf("data-verdict=\"success\"")).toBeGreaterThan(collection)
    })
})

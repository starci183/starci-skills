import { readFileSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { cssRules, declarationsFor } from "../__test__/styleClaims.js"
import { SurfaceAccordionCard } from "./branch/SurfaceAccordionCard/index.js"
import { SurfaceCard } from "./branch/SurfaceCard/index.js"
import { SurfaceListCard } from "./branch/SurfaceListCard/index.js"
import { HorizontalScrollRegion } from "./composite/HorizontalScrollRegion/index.js"
import { StaticStateRow } from "./composite/StaticStateRow/index.js"
import { VerticalScrollRegion } from "./composite/VerticalScrollRegion/index.js"
import { OtpInput } from "./OtpInput.js"
import { SectionHeader } from "./primitive/SectionHeader/index.js"
import { Rail } from "./branch/Rail/index.js"

const expectVerticalScrollShadow = (markup: string) => {
    expect(markup).toContain("data-grammar-scroll=\"contained\"")
    expect(markup).toContain("scroll-shadow--vertical")
    expect(markup).toContain("data-orientation=\"vertical\"")
}

/*
 * Stamp versus render.
 *
 * A `data-contract` id is a PROMISE about the paint, and an audit measures the promise against what
 * the node actually renders. The sheet below is the one this package ships, so these cases read the
 * same two things an audit reads - the stamp on the rendered node, and the declaration the shipped
 * rule makes for the class that node carries - and refuse a node that says two different things at
 * once about one property.
 */
const css = readFileSync(new URL("../common/styles.css", import.meta.url), "utf8")

/** The opening tag of the first element carrying `marker`, read out of static markup. */
const tagWith = (markup: string, marker: string): string => {
    const index = markup.indexOf(marker)
    expect(index, `no rendered element carries ${marker}`).toBeGreaterThanOrEqual(0)
    return markup.slice(markup.lastIndexOf("<", index), markup.indexOf(">", index) + 1)
}

/** The rule ids that element promises. */
const claimsOn = (markup: string, marker: string): ReadonlyArray<string> =>
    (tagWith(markup, marker).match(/data-contract="([^"]*)"/)?.[1] ?? "").split(" ").filter(Boolean)

/** The overflow answers one node gives; a node that gives two has already contradicted itself. */
const overflowClaims = (claims: ReadonlyArray<string>) => claims.filter((claim) => /^OVERFLOW-[12]$/.test(claim))
const axisClaims = (claims: ReadonlyArray<string>) => claims.filter((claim) => /^OVERFLOW-[34]$/.test(claim))

/** The declarations of the rules whose selector is exactly `selector`, without the union across states. */
const scopedDeclarations = (selector: string) => cssRules(css)
    .filter((rule) => rule.selector.split(",").some((part) => part.trim() === selector))
    .flatMap((rule) => rule.body.split(";"))
    .map((declaration) => declaration.split(":"))
    .filter((parts) => parts.length >= 2)
    .map((parts) => ({ property: (parts[0] ?? "").trim(), value: parts.slice(1).join(":").trim() }))

/** SurfaceCard puts this only on its content node, so it names that node in either frame. */
const SURFACE_CONTENT_NODE = "data-grammar-surface-depth=\"top\""
const SURFACE_BODY_NODE = "data-grammar-surface-content=\"true\""

describe("scrollable Core surfaces", () => {
    it("owns the three semantic layers of ContextIntro", () => {
        const markup = renderToStaticMarkup(<SectionHeader eyebrow="Next task" title="Personal project" description="Supporting evidence" level={1} composition="context-intro" />)
        expect(markup).toContain("data-grammar-composition=\"context-intro\"")
        expect(markup).toContain("starci-core-section-eyebrow")
        expect(markup).toContain("<h1 class=\"starci-core-section-title\"")
        expect(markup).toContain("starci-core-section-description")
    })

    it("owns right-rail padding and sticky lifecycle", () => {
        const markup = renderToStaticMarkup(<Rail label="Project evidence" mode="sticky" inset="content" isLabelHidden>Facts</Rail>)
        expect(markup).toContain("data-grammar-rail-mode=\"sticky\"")
        expect(markup).toContain("data-grammar-rail-inset=\"content\"")
        expect(markup).toContain("starci-core-visually-hidden")
        expect(markup).toContain("starci-core-rail")
        expect(markup).toContain("starci-core-rail-frame")
        expect(markup).toContain("starci-core-rail-body")
    })

    it("preserves intrinsic-width content in a horizontal ScrollShadow", () => {
        const markup = renderToStaticMarkup(
            <HorizontalScrollRegion><div>Six fixed slots</div></HorizontalScrollRegion>,
        )
        expect(markup).toContain("scroll-shadow--horizontal")
        expect(markup).toContain("data-orientation=\"horizontal\"")
    })

    it("owns the conventional six-slot OTP control inside that horizontal region", () => {
        const markup = renderToStaticMarkup(<OtpInput id="otp" name="otp" />)
        expect(markup).toContain("scroll-shadow--horizontal")
        expect(markup.match(/data-slot="input-otp-slot"/g)).toHaveLength(6)
        expect(markup).toMatch(/auto[Cc]omplete="one-time-code"/)
        expect(markup).toMatch(/input[Mm]ode="numeric"/)
    })

    it("makes SurfaceCard content vertically scrollable", () => {
        const markup = renderToStaticMarkup(
            <SurfaceCard ariaLabel="Card" isScrollable><p>Body</p></SurfaceCard>,
        )
        expectVerticalScrollShadow(markup)
        expect(markup).toContain("starci-core-surface-card")
        expect(markup).toContain("starci-core-surface")
        expect(markup).toContain("starci-core-surface-content")
    })

    it("owns joined composition, form measure, and fill height without consumer selectors", () => {
        const markup = renderToStaticMarkup(
            <SurfaceCard label="Editor" composition="joined" height="fill" isScrollable measure="formCompact">
                <div>Header</div>
                <div>Body</div>
            </SurfaceCard>,
        )

        expect(markup).toContain("starci-core-form-surface")
        expect(markup).toContain("starci-core-form-surface--compact")
        expect(markup).toContain("starci-core-form-scroll-viewport")
        expect(markup).toContain("starci-core-surface-card--fill")
        expect(markup).toContain("<h3")
        expect(markup).toContain("data-grammar-surface-composition=\"joined\"")
        expect(markup).toContain("data-grammar-surface-height=\"fill\"")
    })

    it("binds the frameless SurfaceCard treatment to the Core stylesheet identity", () => {
        const markup = renderToStaticMarkup(
            <SurfaceCard ariaLabel="Frameless card" frame="frameless"><p>Body</p></SurfaceCard>,
        )
        expect(markup).toContain("starci-core-surface-card")
        expect(markup).toContain("starci-core-surface starci-core-frameless-surface")
        expect(markup).toContain("data-grammar-frame=\"frameless\"")
        expect(markup).toContain("starci-core-surface-content")
    })

    it("stamps one overflow claim on the frameless SurfaceCard content and paints it visible", () => {
        const frameless = renderToStaticMarkup(
            <SurfaceCard ariaLabel="Frameless card" frame="frameless"><p>Body</p></SurfaceCard>,
        )
        expect(tagWith(frameless, SURFACE_CONTENT_NODE)).toContain("starci-core-frameless-surface")
        expect(overflowClaims(claimsOn(frameless, SURFACE_CONTENT_NODE))).toEqual(["OVERFLOW-1"])
        expect(declarationsFor(css, "starci-core-frameless-surface")).toContainEqual({ property: "overflow", value: "visible" })

        const bounded = renderToStaticMarkup(
            <SurfaceCard ariaLabel="Bounded card"><p>Body</p></SurfaceCard>,
        )
        expect(tagWith(bounded, SURFACE_CONTENT_NODE)).not.toContain("starci-core-frameless-surface")
        expect(overflowClaims(claimsOn(bounded, SURFACE_CONTENT_NODE))).toEqual(["OVERFLOW-2"])
        expect(declarationsFor(css, "starci-core-surface")).toContainEqual({ property: "overflow", value: "hidden" })
    })

    it("drops the inset with the frame and claims PADDING-0 for it", () => {
        const frameless = renderToStaticMarkup(
            <SurfaceCard ariaLabel="Frameless card" frame="frameless"><p>Body</p></SurfaceCard>,
        )
        expect(claimsOn(frameless, SURFACE_BODY_NODE)).toContain("PADDING-0")
        expect(claimsOn(frameless, SURFACE_BODY_NODE)).not.toContain("PADDING-4")
        expect(scopedDeclarations(".starci-core-frameless-surface > .starci-core-surface-content"))
            .toContainEqual({ property: "padding", value: "0" })

        const joined = renderToStaticMarkup(
            <SurfaceCard ariaLabel="Joined card" composition="joined"><p>Body</p></SurfaceCard>,
        )
        expect(claimsOn(joined, SURFACE_BODY_NODE)).toEqual(["GAP-0", "PADDING-0"])

        const bounded = renderToStaticMarkup(
            <SurfaceCard ariaLabel="Bounded card"><p>Body</p></SurfaceCard>,
        )
        expect(claimsOn(bounded, SURFACE_BODY_NODE)).toEqual(["PADDING-4"])
        expect(declarationsFor(css, "starci-core-surface-content"))
            .toContainEqual({ property: "padding", value: "var(--starci-core-surface-inset, 1rem)" })
    })

    it("gives HorizontalScrollRegion one overflow answer and one scrolling axis", () => {
        const marker = "data-grammar-overflow"
        const always = renderToStaticMarkup(
            <HorizontalScrollRegion><div>Six fixed slots</div></HorizontalScrollRegion>,
        )
        expect(tagWith(always, marker)).toContain("data-grammar-overflow=\"always\"")
        expect(axisClaims(claimsOn(always, marker))).toEqual(["OVERFLOW-3"])

        const region = declarationsFor(css, "starci-core-horizontal-scroll-region")
        expect(region).toContainEqual({ property: "overflow-x", value: "auto" })
        expect(region).toContainEqual({ property: "overflow-y", value: "hidden" })

        const needed = renderToStaticMarkup(
            <HorizontalScrollRegion overflow="needed"><div>Six fixed slots</div></HorizontalScrollRegion>,
        )
        expect(tagWith(needed, marker)).toContain("data-grammar-overflow=\"needed\"")
        expect(axisClaims(claimsOn(needed, marker))).toEqual(["OVERFLOW-4"])
    })

    it("gives VerticalScrollRegion one overflow answer and one scrolling axis", () => {
        const marker = "data-grammar-scroll-region"
        const always = renderToStaticMarkup(
            <VerticalScrollRegion isScrollable><p>Conversation</p></VerticalScrollRegion>,
        )
        expect(tagWith(always, marker)).toContain("data-grammar-scroll-region=\"vertical\"")
        expect(tagWith(always, marker)).toContain("data-grammar-overflow=\"always\"")
        expect(axisClaims(claimsOn(always, marker))).toEqual(["OVERFLOW-3"])

        const region = scopedDeclarations("[data-grammar-scroll-region=\"vertical\"]")
        expect(region).toContainEqual({ property: "overflow-y", value: "auto" })
        expect(region).toContainEqual({ property: "overflow-x", value: "hidden" })

        const needed = renderToStaticMarkup(
            <VerticalScrollRegion isScrollable overflow="needed"><p>Conversation</p></VerticalScrollRegion>,
        )
        expect(tagWith(needed, marker)).toContain("data-grammar-overflow=\"needed\"")
        expect(axisClaims(claimsOn(needed, marker))).toEqual(["OVERFLOW-4"])
    })

    it("owns the singular legacy highlight boundary and suppresses it while pending", () => {
        const highlighted = renderToStaticMarkup(
            <SurfaceCard ariaLabel="Featured card" isHighlight><p>Body</p></SurfaceCard>,
        )
        const pending = renderToStaticMarkup(
            <SurfaceCard ariaLabel="Loading card" isHighlight state="pending"><p>Body</p></SurfaceCard>,
        )

        expect(highlighted).toContain("data-grammar-highlight=\"true\"")
        expect(highlighted).toContain("starci-core-surface-highlight-sweep")
        expect(pending).not.toContain("data-grammar-highlight")
    })

    it("makes SurfaceListCard rows vertically scrollable", () => {
        const markup = renderToStaticMarkup(
            <SurfaceListCard label="List" isScrollable>
                <StaticStateRow item={{ id: "row", label: "Row", description: "Detail", state: "affirmative" }} />
            </SurfaceListCard>,
        )
        expectVerticalScrollShadow(markup)
        expect(markup).toContain("starci-core-surface-list")
        expect(markup).toContain("starci-core-surface starci-core-list-shell")
        expect(markup).toContain("<h3")
        expect(markup).toContain("starci-core-owned-collection")
        expect(markup).toContain("starci-core-static-row")
        expect(markup).toContain("starci-core-static-row-copy")
    })

    it("makes SurfaceAccordionCard rows vertically scrollable", () => {
        const markup = renderToStaticMarkup(
            <SurfaceAccordionCard
                bodyRender="Body"
                isOpen
                isScrollable
                onOpenChange={vi.fn()}
                renderBody={(body) => body}
                renderSummary={(summary) => summary}
                summaryRender="Summary"
            />,
        )
        expectVerticalScrollShadow(markup)
        expect(markup).toContain("data-slot=\"accordion\"")
        expect(markup).toContain("data-slot=\"accordion-panel\"")
        expect(markup).toContain("accordion__panel")
        expect(markup).toMatch(/class="[^"]*starci-core-accordion-panel[^"]*"/)
        expect(markup).toMatch(/class="[^"]*starci-core-accordion-body[^"]*"/)
        expect(markup).not.toContain("border-t")
    })

    it("gives a bounded SurfaceAccordionCard one external label and the shared surface frame", () => {
        const markup = renderToStaticMarkup(
            <SurfaceAccordionCard
                depth="top"
                items={[
                    { id: "first", isOpen: false, summaryRender: "First", bodyRender: "First body" },
                    { id: "second", isOpen: false, summaryRender: "Second", bodyRender: "Second body" },
                ]}
                label="Before you subscribe"
                onItemOpenChange={vi.fn()}
                renderBody={(body) => body}
                renderSummary={(summary) => summary}
            />,
        )

        expect(markup).toContain("data-grammar-surface-label=\"true\"")
        expect(markup).toContain("<h3")
        expect(markup).toContain(">Before you subscribe</h3>")
        const labelId = markup.match(/<h3 id="([^"]+)"/)?.[1]
        expect(labelId).toBeDefined()
        expect(markup).toContain(`aria-labelledby="${labelId}"`)
        expect(markup).toMatch(/class="[^"]*starci-core-surface[^"]*"/)
        expect(markup).toContain("data-grammar-frame=\"bounded\"")
        expect(markup).toContain("data-grammar-surface=\"true\"")
        expect(markup).toContain("data-grammar-surface-depth=\"top\"")
    })

    it("keeps an unbounded SurfaceAccordionCard frameless and self-named", () => {
        const markup = renderToStaticMarkup(
            <SurfaceAccordionCard
                ariaLabel="Help topics"
                bodyRender="Body"
                isOpen={false}
                onOpenChange={vi.fn()}
                renderBody={(body) => body}
                renderSummary={(summary) => summary}
                summaryRender="Summary"
            />,
        )

        expect(markup).toContain("aria-label=\"Help topics\"")
        expect(markup).toContain("data-grammar-frame=\"frameless\"")
        expect(markup).toContain("starci-core-surface starci-core-frameless-surface")
        expect(markup).not.toContain("data-grammar-surface=\"true\"")
        expect(markup).not.toContain("data-grammar-surface-depth")
    })
})

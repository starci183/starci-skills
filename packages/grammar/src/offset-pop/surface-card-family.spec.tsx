/** @vitest-environment jsdom */
import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it } from "vitest"
import {
    PRESENTATION_STATES,
    StaticStateRow,
    SurfaceAccordionCard,
    SurfaceCard,
    SurfaceListCard,
    type PresentationState,
} from "../common/index.js"
import { OffsetPopGrammarRoot } from "./index.js"

const noop = () => undefined

/** Mount static family markup so the anatomy can be queried the way the family sheet selects it. */
const mount = (children: ReactNode) => {
    document.body.innerHTML = renderToStaticMarkup(<OffsetPopGrammarRoot>{children}</OffsetPopGrammarRoot>)
    const root = document.querySelector(".grammar-common-root[data-grammar-family=\"offset-pop\"]")
    expect(root).not.toBeNull()
    return root as Element
}

const all = (root: Element, selector: string) => [...root.querySelectorAll(selector)]

/** The node the family paints as a SurfaceCard's bounded surface. */
const BOUNDED_CONTENT = "[data-grammar-surface-card][data-slot=\"card\"] [data-grammar-frame=\"bounded\"][data-slot=\"card-content\"]"

afterEach(() => document.body.replaceChildren())

describe("Offset Pop SurfaceCard material anatomy", () => {
    it("renders the HeroUI v3 Card compound root, header, and content slots inside the family scope", () => {
        const root = mount(<SurfaceCard label="Progress"><p>42%</p></SurfaceCard>)
        const card = root.querySelector("section[data-slot=\"card\"]")
        expect(card?.getAttribute("data-grammar-surface-card")).toBe("true")
        expect(card?.getAttribute("data-grammar-surface-labelled")).toBe("true")

        const children = [...(card?.children ?? [])]
        expect(children.map((child) => child.getAttribute("data-slot"))).toEqual(["card-header", "card-content"])
        const [header, content] = children
        expect(header?.getAttribute("data-grammar-surface-label")).toBe("true")
        expect(content?.getAttribute("data-grammar-frame")).toBe("bounded")
        expect(content?.matches(BOUNDED_CONTENT)).toBe(true)
    })

    it("names the bounded surface by its external label", () => {
        const root = mount(<SurfaceCard label="Overview"><p>Content</p></SurfaceCard>)
        const heading = root.querySelector("[data-grammar-surface-label] h3")
        expect(heading?.textContent).toBe("Overview")
        expect(heading?.id).toBeTruthy()
        expect(root.querySelector(BOUNDED_CONTENT)?.getAttribute("aria-labelledby")).toBe(heading?.id)
    })

    it("gives a frameless surface none of the hooks the family draws a shell on", () => {
        const root = mount(<SurfaceCard ariaLabel="Frameless" frame="frameless"><p>Body</p></SurfaceCard>)
        const content = root.querySelector("[data-slot=\"card-content\"]")
        expect(content?.getAttribute("data-grammar-frame")).toBe("frameless")
        expect(content?.getAttribute("aria-label")).toBe("Frameless")
        expect(root.querySelector(BOUNDED_CONTENT)).toBeNull()
        expect(root.querySelector("[data-grammar-surface]")).toBeNull()
    })

    it("carries one depth per surface, so a nested surface recedes under its top parent", () => {
        const root = mount(
            <SurfaceCard label="Parent">
                <SurfaceCard ariaLabel="Child" depth="nested"><p>Nested</p></SurfaceCard>
            </SurfaceCard>,
        )
        const surfaces = all(root, BOUNDED_CONTENT)
        expect(surfaces.map((surface) => surface.getAttribute("data-grammar-surface-depth"))).toEqual(["top", "nested"])
        expect(surfaces[0]?.contains(surfaces[1] ?? null)).toBe(true)
        expect(surfaces[1]?.getAttribute("data-contract")).toContain("BOUNDARY-5")
        expect(surfaces[0]?.getAttribute("data-contract")).toContain("BOUNDARY-6")
    })

    it.each(PRESENTATION_STATES)("stamps the %s presentation state on the painted surface", (state: PresentationState) => {
        const root = mount(<SurfaceCard ariaLabel="Stateful" state={state}><p>Body</p></SurfaceCard>)
        const content = root.querySelector(BOUNDED_CONTENT)
        expect(content?.getAttribute("data-grammar-state")).toBe(state)
        expect(content?.getAttribute("data-grammar-treatment")).toBeTruthy()
    })

    it("refuses a state outside the Common presentation vocabulary", () => {
        expect(() => mount(<SurfaceCard ariaLabel="Bad" state={"celebrating" as PresentationState}><p>Body</p></SurfaceCard>))
            .toThrow(/Unknown presentation state/)
    })

    it("suppresses the singular highlight while pending", () => {
        const highlighted = mount(<SurfaceCard ariaLabel="Featured" isHighlight><p>Body</p></SurfaceCard>)
        expect(highlighted.querySelector("[data-grammar-highlight=\"true\"]")).not.toBeNull()
        const pending = mount(<SurfaceCard ariaLabel="Featured" isHighlight state="pending"><p>Body</p></SurfaceCard>)
        expect(pending.querySelector("[data-grammar-highlight]")).toBeNull()
    })
})

describe("Offset Pop whole-action surfaces", () => {
    it.each(["top", "nested"] as const)("puts a %s whole action inside the painted surface, after its content", (depth) => {
        const root = mount(
            <SurfaceCard label="Course" depth={depth} wholeAction={{ kind: "link", href: "/course", label: "Open course" }}>
                <p>Body</p>
            </SurfaceCard>,
        )
        const card = root.querySelector("[data-grammar-surface-card]")
        expect(card?.getAttribute("data-grammar-interaction")).toBe("whole-action")
        expect(card?.getAttribute("data-contract")).toBe("SURFACE-4")

        const surface = root.querySelector(BOUNDED_CONTENT)
        expect(surface?.getAttribute("data-grammar-surface-depth")).toBe(depth)
        const action = surface?.querySelector(":scope > [data-grammar-whole-action]")
        expect(action?.tagName).toBe("A")
        expect(action?.getAttribute("data-grammar-whole-action")).toBe("link")
        expect(action?.getAttribute("aria-label")).toBe("Open course")
        expect(surface?.lastElementChild).toBe(action)
        expect(all(root, "[data-grammar-whole-action]")).toHaveLength(1)
    })

    it("renders a press whole action as a real button", () => {
        const root = mount(
            <SurfaceCard label="Lesson" wholeAction={{ kind: "button", press: noop, label: "Start lesson" }}><p>Body</p></SurfaceCard>,
        )
        const action = root.querySelector(`${BOUNDED_CONTENT} > [data-grammar-whole-action="button"]`)
        expect(action?.tagName).toBe("BUTTON")
        expect(action?.getAttribute("type")).toBe("button")
        expect(action?.getAttribute("aria-label")).toBe("Start lesson")
    })

    it("stays static without a whole action", () => {
        const root = mount(<SurfaceCard label="Static"><p>Body</p></SurfaceCard>)
        expect(root.querySelector("[data-grammar-surface-card]")?.getAttribute("data-grammar-interaction")).toBe("static")
        expect(root.querySelector("[data-grammar-whole-action]")).toBeNull()
    })
})

describe("Offset Pop SurfaceListCard rows", () => {
    const everyStateRow = PRESENTATION_STATES.map((state) => (
        <StaticStateRow key={state} item={{ id: state, label: state, state }} />
    ))

    it.each(["top", "nested"] as const)("paints a %s list shell with the same depth on shell and label", (depth) => {
        const root = mount(<SurfaceListCard label="Rows" depth={depth}>{everyStateRow}</SurfaceListCard>)
        const shell = root.querySelector("[data-grammar-surface=\"true\"]")
        expect(shell?.getAttribute("data-grammar-surface-depth")).toBe(depth)
        expect(shell?.getAttribute("data-surface-context")).toBe(depth === "nested" ? "nested" : "page")
        expect(root.querySelector("[data-grammar-label-depth]")?.getAttribute("data-grammar-label-depth")).toBe(depth)
        expect(shell?.getAttribute("aria-labelledby")).toBe(root.querySelector("[data-grammar-surface-label] h3")?.id)
    })

    it("keeps each row a direct child of the collection, last row last", () => {
        const root = mount(<SurfaceListCard label="Rows">{everyStateRow}</SurfaceListCard>)
        const list = root.querySelector("[data-grammar-list=\"true\"]")
        const rows = [...(list?.children ?? [])]
        expect(rows).toHaveLength(PRESENTATION_STATES.length)
        for (const row of rows) expect(row.getAttribute("data-grammar-row")).toBe("true")
        expect(rows.map((row) => row.getAttribute("data-grammar-state"))).toEqual([...PRESENTATION_STATES])
        expect(list?.querySelector(":scope > [data-grammar-row]:last-child")).toBe(rows.at(-1))
    })

    it("draws the check mark only for an affirmative row", () => {
        const root = mount(<SurfaceListCard label="Rows">{everyStateRow}</SurfaceListCard>)
        const marked = all(root, "[data-grammar-state-mark]").map((mark) => mark.closest("[data-grammar-row]")?.getAttribute("data-grammar-state"))
        expect(marked).toEqual(["affirmative"])
        expect(root.querySelector("[data-grammar-state-mark]")?.getAttribute("aria-hidden")).toBe("true")
    })

    it("emits the collection's verdict slot from the Grammar row's own prop", () => {
        const root = mount(
            <SurfaceListCard label="Movement" isVerdict>
                <StaticStateRow item={{ id: "up", label: "Ada", verdict: "success" }} />
                <StaticStateRow item={{ id: "down", label: "Grace", verdict: "danger" }} />
                <StaticStateRow item={{ id: "flat", label: "Linus" }} />
            </SurfaceListCard>,
        )
        const collection = root.querySelector("[data-grammar-collection=\"verdict\"]")
        expect(collection).not.toBeNull()
        const rows = all(root, "li")
        expect(rows.map((row) => row.getAttribute("data-verdict"))).toEqual(["success", "danger", null])
    })

    it("leaves an application-owned row's own verdict attribute untouched", () => {
        const root = mount(
            <SurfaceListCard ariaLabel="Movement" isVerdict>
                <div data-verdict="success">Ada</div>
            </SurfaceListCard>,
        )
        expect(root.querySelector("[data-grammar-collection=\"verdict\"] > [data-verdict=\"success\"]")?.textContent).toBe("Ada")
    })
})

describe("Offset Pop SurfaceAccordionCard frame", () => {
    it("gives a bounded accordion the shared painted surface and one external label", () => {
        const root = mount(
            <SurfaceAccordionCard
                depth="top"
                label="Before you subscribe"
                items={[
                    { id: "first", isOpen: false, summaryRender: "First", bodyRender: "First body" },
                    { id: "second", isOpen: true, summaryRender: "Second", bodyRender: "Second body" },
                ]}
                onItemOpenChange={noop}
                renderBody={(body: string) => body}
                renderSummary={(summary: string) => summary}
            />,
        )
        const surfaces = all(root, "[data-grammar-surface=\"true\"]")
        expect(surfaces).toHaveLength(1)
        expect(surfaces[0]?.getAttribute("data-grammar-surface-depth")).toBe("top")
        expect(surfaces[0]?.getAttribute("data-grammar-frame")).toBe("bounded")
        const label = root.querySelector("[data-grammar-surface-label] h3")
        expect(label?.textContent).toBe("Before you subscribe")
        expect(root.querySelector(`[aria-labelledby="${label?.id}"]`)).not.toBeNull()
    })

    it("keeps an unbounded accordion frameless and self-named, with no painted surface", () => {
        const root = mount(
            <SurfaceAccordionCard
                ariaLabel="Help topics"
                bodyRender="Body"
                isOpen={false}
                onOpenChange={noop}
                renderBody={(body: string) => body}
                renderSummary={(summary: string) => summary}
                summaryRender="Summary"
            />,
        )
        expect(root.querySelector("[aria-label=\"Help topics\"]")).not.toBeNull()
        expect(root.querySelector("[data-grammar-frame=\"frameless\"]")).not.toBeNull()
        expect(root.querySelector("[data-grammar-surface]")).toBeNull()
        expect(root.querySelector("[data-grammar-surface-depth]")).toBeNull()
    })
})

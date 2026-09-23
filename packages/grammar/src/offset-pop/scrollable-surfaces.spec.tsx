/** @vitest-environment jsdom */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it } from "vitest"
import { cssRules } from "../__test__/styleClaims.js"
import {
    HorizontalScrollRegion,
    OtpInput,
    Rail,
    StaticStateRow,
    SurfaceAccordionCard,
    SurfaceCard,
    SurfaceListCard,
    VerticalScrollRegion,
} from "../common/index.js"
import { OffsetPopGrammarRoot } from "./index.js"

/** jsdom rewrites `import.meta.url` to an http URL, so the sheet is resolved from the package root. */
const cssPath = ["src/offset-pop/styles.css", "packages/grammar/src/offset-pop/styles.css"]
    .map((candidate) => resolve(process.cwd(), candidate))
    .find(existsSync) ?? ""
const css = readFileSync(cssPath, "utf8")

const noop = () => undefined

/** Split a selector list at its top-level commas; `:is(a, button)` stays whole. */
const selectorList = (selector: string): ReadonlyArray<string> => {
    const parts: Array<string> = []
    let depth = 0
    let start = 0
    for (let index = 0; index < selector.length; index += 1) {
        if (selector[index] === "(") depth += 1
        else if (selector[index] === ")") depth -= 1
        else if (selector[index] === "," && depth === 0) {
            parts.push(selector.slice(start, index).trim())
            start = index + 1
        }
    }
    parts.push(selector.slice(start).trim())
    return parts.filter(Boolean)
}

/** A selector's reach in some interaction state: pointer and focus states are dropped. */
const reach = (selector: string) => selector
    .replace(/:focus-within(?![\w-])/g, ":has(:is(a[href], button, input, select, textarea, [tabindex]))")
    .replace(/:(?:hover|active|focus-visible|focus)(?![\w-])/g, "")

const familyRules = cssRules(css).flatMap((rule) => {
    const properties = rule.body.split(";").map((declaration) => declaration.split(":")[0]?.trim() ?? "").filter(Boolean)
    return selectorList(rule.selector).map((selector) => ({ selector, properties }))
})

/** Family declarations of `pattern` that reach `element`, spelled for a failure message. */
const familyDeclarations = (element: Element, pattern: RegExp) => familyRules
    .filter((rule) => element.matches(reach(rule.selector)))
    .flatMap((rule) => rule.properties.filter((property) => pattern.test(property)).map((property) => `${property} in ${rule.selector}`))

const mount = (children: ReactNode) => {
    document.body.innerHTML = renderToStaticMarkup(<OffsetPopGrammarRoot>{children}</OffsetPopGrammarRoot>)
    return document.body.firstElementChild as Element
}

/** The rule ids one element promises. */
const claims = (element: Element | null | undefined) => (element?.getAttribute("data-contract") ?? "").split(" ").filter(Boolean)
/** The scrolling-axis answer (OVERFLOW-3 always, OVERFLOW-4 when needed); a region gives exactly one. */
const isAxisClaim = (id: string) => /^OVERFLOW-[34]$/.test(id)

/** The node a SurfaceCard's bounded surface is painted on. */
const BOUNDED_CONTENT = "[data-grammar-surface-card][data-slot=\"card\"] [data-grammar-frame=\"bounded\"][data-slot=\"card-content\"]"
const VERTICAL_REGION = "[data-grammar-scroll-region=\"vertical\"]"

const expectVerticalScrollShadow = (region: Element | null) => {
    expect(region).not.toBeNull()
    expect(region?.classList.contains("scroll-shadow--vertical")).toBe(true)
    expect(region?.getAttribute("data-orientation")).toBe("vertical")
}

afterEach(() => document.body.replaceChildren())

describe("scrollable Offset Pop surfaces", () => {
    it("scrolls SurfaceCard content inside the painted surface, not the surface itself", () => {
        const root = mount(<SurfaceCard ariaLabel="Card" isScrollable><p>Body</p></SurfaceCard>)
        const surface = root.querySelector(BOUNDED_CONTENT)
        expect(surface?.getAttribute("data-grammar-scroll")).toBe("contained")
        expect(surface?.matches(VERTICAL_REGION)).toBe(false)

        const region = surface?.querySelector(`:scope > ${VERTICAL_REGION}`) ?? null
        expectVerticalScrollShadow(region)
        expect(region?.getAttribute("data-grammar-surface-content")).toBe("true")
        expect(claims(region)).toContain("OVERFLOW-3")
        expect(root.querySelectorAll(VERTICAL_REGION)).toHaveLength(1)
    })

    it("keeps a page-scrolled SurfaceCard free of any scroll region", () => {
        const root = mount(<SurfaceCard ariaLabel="Card"><p>Body</p></SurfaceCard>)
        expect(root.querySelector(BOUNDED_CONTENT)?.getAttribute("data-grammar-scroll")).toBe("page")
        expect(root.querySelector(VERTICAL_REGION)).toBeNull()
    })

    it("makes SurfaceListCard rows the one contained scroll region inside the painted shell", () => {
        const root = mount(
            <SurfaceListCard label="List" isScrollable>
                <StaticStateRow item={{ id: "row", label: "Row", description: "Detail", state: "affirmative" }} />
            </SurfaceListCard>,
        )
        const shell = root.querySelector("[data-grammar-surface=\"true\"]")
        expect(shell?.getAttribute("data-grammar-scroll")).toBe("contained")
        const region = shell?.querySelector(`:scope > ${VERTICAL_REGION}`) ?? null
        expectVerticalScrollShadow(region)
        expect(region?.getAttribute("data-grammar-list")).toBe("true")
        expect(region?.querySelector(":scope > [data-grammar-row]")).not.toBeNull()
        expect(root.querySelectorAll(VERTICAL_REGION)).toHaveLength(1)
    })

    it("makes SurfaceAccordionCard panels vertically scrollable", () => {
        const root = mount(
            <SurfaceAccordionCard
                bodyRender="Body"
                isOpen
                isScrollable
                onOpenChange={noop}
                renderBody={(body: string) => body}
                renderSummary={(summary: string) => summary}
                summaryRender="Summary"
            />,
        )
        expectVerticalScrollShadow(root.querySelector(VERTICAL_REGION))
        expect(root.querySelector("[data-slot=\"accordion\"]")).not.toBeNull()
        expect(root.querySelector("[data-slot=\"accordion-panel\"]")).not.toBeNull()
    })

    it("gives HorizontalScrollRegion one overflow answer and one scrolling axis", () => {
        const always = mount(<HorizontalScrollRegion><div>Six fixed slots</div></HorizontalScrollRegion>)
        const region = always.querySelector("[data-grammar-overflow]")
        expect(region?.classList.contains("scroll-shadow--horizontal")).toBe(true)
        expect(region?.getAttribute("data-orientation")).toBe("horizontal")
        expect(region?.getAttribute("data-grammar-overflow")).toBe("always")
        expect(claims(region).filter(isAxisClaim)).toEqual(["OVERFLOW-3"])

        const needed = mount(<HorizontalScrollRegion overflow="needed"><div>Six fixed slots</div></HorizontalScrollRegion>)
        expect(claims(needed.querySelector("[data-grammar-overflow=\"needed\"]")).filter(isAxisClaim)).toEqual(["OVERFLOW-4"])
    })

    it("gives VerticalScrollRegion one overflow answer and one scrolling axis", () => {
        const always = mount(<VerticalScrollRegion isScrollable><p>Conversation</p></VerticalScrollRegion>)
        const region = always.querySelector(VERTICAL_REGION)
        expect(region?.getAttribute("data-grammar-overflow")).toBe("always")
        expect(claims(region).filter(isAxisClaim)).toEqual(["OVERFLOW-3"])

        const needed = mount(<VerticalScrollRegion isScrollable overflow="needed"><p>Conversation</p></VerticalScrollRegion>)
        expect(claims(needed.querySelector(VERTICAL_REGION)).filter(isAxisClaim)).toEqual(["OVERFLOW-4"])

        const off = mount(<VerticalScrollRegion isScrollable={false}><p>Conversation</p></VerticalScrollRegion>)
        expect(off.querySelector(VERTICAL_REGION)).toBeNull()
    })

    it("owns the conventional six-slot OTP control inside a horizontal region", () => {
        const root = mount(<OtpInput id="otp" name="otp" />)
        expect(root.querySelector(".scroll-shadow--horizontal")).not.toBeNull()
        expect(root.querySelectorAll("[data-slot=\"input-otp-slot\"]")).toHaveLength(6)
        const input = root.querySelector("input")
        expect(input?.getAttribute("autocomplete")).toBe("one-time-code")
        expect(input?.getAttribute("inputmode")).toBe("numeric")
    })

    it("keeps right-rail sticky lifecycle and inset hooks", () => {
        const root = mount(<Rail label="Project evidence" mode="sticky" inset="content" isLabelHidden>Facts</Rail>)
        const rail = root.querySelector("[data-grammar-rail]")
        expect(rail).not.toBeNull()
        expect(root.querySelector("[data-grammar-rail-mode=\"sticky\"]")).not.toBeNull()
        expect(root.querySelector("[data-grammar-rail-inset=\"content\"]")).not.toBeNull()
        expect(root.textContent).toContain("Project evidence")
    })
})

/** Every scrollable surface the family paints, with every scroll region Common can emit inside one. */
const SCROLLING_SURFACES = {
    SurfaceCard: <SurfaceCard label="Card" isScrollable><p>Body</p></SurfaceCard>,
    "SurfaceCard (nested)": <SurfaceCard ariaLabel="Card" depth="nested" scroll="contained"><p>Body</p></SurfaceCard>,
    SurfaceAccordionCard: (
        <SurfaceAccordionCard
            label="Questions"
            bodyRender="Body"
            isOpen
            isScrollable
            onOpenChange={noop}
            renderBody={(body: string) => body}
            renderSummary={(summary: string) => summary}
            summaryRender="Summary"
        />
    ),
    VerticalScrollRegion: <VerticalScrollRegion isScrollable><p>Conversation</p></VerticalScrollRegion>,
    HorizontalScrollRegion: <HorizontalScrollRegion overflow="needed"><div>Slots</div></HorizontalScrollRegion>,
    OtpInput: <OtpInput id="otp" name="otp" />,
} as const

const SCROLL_REGION = "[data-grammar-scroll-region], [data-grammar-overflow]"
const OVERFLOW = /^overflow/

describe("Offset Pop leaves every scroll region's overflow to Common", () => {
    it.each(Object.entries(SCROLLING_SURFACES))("takes no overflow from %s's scroll region", (_name, surface) => {
        const root = mount(surface)
        const regions = [...root.querySelectorAll(SCROLL_REGION)]
        expect(regions.length).toBeGreaterThan(0)
        for (const region of regions) expect(familyDeclarations(region, OVERFLOW)).toEqual([])
    })

    /*
     * Regression guard: a scrollable SurfaceListCard must keep scrolling.
     *
     * Common renders the list's collection AS its vertical scroll region, so one node carries both
     * `data-grammar-list="true"` and `data-grammar-scroll-region="vertical"`. The family clips a list
     * to its rounded shell, but `@layer starci-grammar-offset-pop` is ordered after
     * `starci-grammar-common`, so any family `overflow` reaching this node would beat Common's
     * `overflow-y: auto` whatever the specificity. Only a non-scrolling list may be clipped.
     */
    it("takes no overflow from a scrollable SurfaceListCard's collection", () => {
        const root = mount(
            <SurfaceListCard label="Rows" isScrollable>
                <StaticStateRow item={{ id: "a", label: "Row" }} />
            </SurfaceListCard>,
        )
        const region = root.querySelector(VERTICAL_REGION)
        expect(region).not.toBeNull()
        expect(familyDeclarations(region as Element, OVERFLOW)).toEqual([])
    })
})

describe("Offset Pop adds no second inset owner", () => {
    const PADDING = /^padding/

    it("keeps the bounded SurfaceCard's one inset on its content region", () => {
        const root = mount(<SurfaceCard label="Included"><p>Body</p></SurfaceCard>)
        const inset = [...root.querySelectorAll("[data-contract]")].filter((element) => claims(element).some((id) => /^PADDING-[1-9]/.test(id)))
        expect(inset).toHaveLength(1)
        expect(inset[0]?.getAttribute("data-grammar-surface-content")).toBe("true")
        expect(claims(inset[0])).toEqual(["PADDING-4"])
        expect(inset[0]?.parentElement?.matches(BOUNDED_CONTENT)).toBe(true)
    })

    it("drops the inset with the frame and with a joined composition", () => {
        const frameless = mount(<SurfaceCard ariaLabel="Frameless" frame="frameless"><p>Body</p></SurfaceCard>)
        expect(claims(frameless.querySelector("[data-grammar-surface-content]"))).toEqual(["PADDING-0"])

        const joined = mount(<SurfaceCard ariaLabel="Joined" composition="joined"><p>Body</p></SurfaceCard>)
        expect(claims(joined.querySelector("[data-grammar-surface-content]"))).toEqual(["GAP-0", "PADDING-0"])
    })

    it("keeps a list shell flush and gives the inset to each row", () => {
        const root = mount(
            <SurfaceListCard label="Rows">
                <StaticStateRow item={{ id: "a", label: "One" }} />
                <StaticStateRow item={{ id: "b", label: "Two" }} />
            </SurfaceListCard>,
        )
        expect(claims(root.querySelector("[data-grammar-surface=\"true\"]"))).toContain("PADDING-0")
        for (const row of root.querySelectorAll("[data-grammar-row]")) expect(claims(row)).toContain("PADDING-4")
    })

    it.each([
        ["SurfaceCard", <SurfaceCard key="card" label="Card" wholeAction={{ kind: "link", href: "/x", label: "Open" }}><p>Body</p></SurfaceCard>],
        ["SurfaceCard (nested, frameless)", <SurfaceCard key="nested" ariaLabel="Card" depth="nested" frame="frameless"><p>Body</p></SurfaceCard>],
        ["SurfaceListCard", <SurfaceListCard key="list" label="Rows" fact="2"><StaticStateRow item={{ id: "a", label: "One", state: "affirmative" }} /></SurfaceListCard>],
        ["SurfaceAccordionCard", <SurfaceAccordionCard key="accordion" label="Questions" bodyRender="Body" isOpen onOpenChange={noop} renderBody={(body: string) => body} renderSummary={(summary: string) => summary} summaryRender="Summary" />],
        ["Rail", <Rail key="rail" label="Details" inset="content">Facts</Rail>],
    ] as const)("declares no padding on any node of %s", (_name, surface) => {
        const root = mount(surface)
        const nodes = [root, ...root.querySelectorAll("*")]
        expect(nodes.length).toBeGreaterThan(3)
        for (const node of nodes) expect(familyDeclarations(node, PADDING)).toEqual([])
    })
})

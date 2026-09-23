/** @vitest-environment jsdom */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import type { ReactElement, ReactNode, SVGProps } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { installDomShims } from "../__test__/grammarRoots.js"
import { cssRules } from "../__test__/styleClaims.js"
import {
    Badge,
    Button,
    DataTable,
    Divider,
    EmptyNotice,
    Heading,
    HorizontalScrollRegion,
    Input,
    ListBox,
    NavigationFeatureNav,
    PageContainer,
    PRESENTATION_STATES,
    PrimaryRailLayout,
    Progress,
    Rail,
    SectionHeader,
    Select,
    Sidebar,
    StaticStateRow,
    SurfaceAccordionCard,
    SurfaceCard,
    SurfaceListCard,
    Text,
    TextAction,
    VerticalScrollRegion,
    WorkspaceShell,
} from "../common/index.js"
import { OffsetPopGrammarRoot } from "./index.js"

/** jsdom rewrites `import.meta.url` to an http URL, so the sheets are resolved from the package root. */
const sheet = (path: string) => {
    const found = [path, `packages/grammar/${path}`].map((candidate) => resolve(process.cwd(), candidate)).find(existsSync)
    return found === undefined ? "" : readFileSync(found, "utf8")
}
const css = sheet("src/offset-pop/styles.css")
const commonCss = sheet("src/common/styles.css")

const Glyph = (props: SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" {...props}><path d="M1 1h1" /></svg>
const noop = () => undefined

afterEach(() => {
    cleanup()
    document.body.replaceChildren()
})

/** Split a selector list at its top-level commas; `:is(a, button)` stays whole. */
const selectorList = (selector: string): ReadonlyArray<string> => {
    const parts: Array<string> = []
    let depth = 0
    let start = 0
    for (let index = 0; index < selector.length; index += 1) {
        const character = selector[index]
        if (character === "(") depth += 1
        else if (character === ")") depth -= 1
        else if (character === "," && depth === 0) {
            parts.push(selector.slice(start, index).trim())
            start = index + 1
        }
    }
    parts.push(selector.slice(start).trim())
    return parts.filter(Boolean)
}

/**
 * The static reach of a selector: the elements it could select in SOME interaction state.
 *
 * Pointer and focus pseudo-classes are the interaction, not the anatomy, so they are dropped -
 * except `:focus-within`, which can only ever hold on an element that contains something focusable.
 */
const FOCUSABLE = ":has(:is(a[href], button, input, select, textarea, [tabindex]))"
const reach = (selector: string) => selector
    .replace(/:focus-within(?![\w-])/g, FOCUSABLE)
    .replace(/:(?:hover|active|focus-visible|focus)(?![\w-])/g, "")

type FamilyRule = {
    readonly selector: string
    /** Declared property names, in source order. */
    readonly declarations: ReadonlyArray<string>
    /** The same declarations with their values. */
    readonly values: ReadonlyArray<{ readonly property: string; readonly value: string }>
}

/** Every leaf rule the family ships, one entry per selector in each selector list. */
const familyRules: ReadonlyArray<FamilyRule> = cssRules(css).flatMap((rule) => {
    const values = rule.body.split(";")
        .map((declaration) => declaration.split(":"))
        .filter((parts) => parts.length >= 2 && (parts[0] ?? "").trim() !== "")
        .map((parts) => ({ property: (parts[0] ?? "").trim(), value: parts.slice(1).join(":").trim() }))
    const declarations = values.map((declaration) => declaration.property)
    return selectorList(rule.selector).map((selector) => ({ selector, declarations, values }))
})

/** Every state a Common row can be in, so each state hook the family reads has a node to land on. */
const everyStateRow = PRESENTATION_STATES.map((state) => (
    <StaticStateRow key={state} item={{ id: state, label: state, description: `${state} detail`, state }} />
))

/** Mounts static Common markup under one family root per theme, the way a consumer's page would. */
const mountGallery = (gallery: ReactNode) => {
    document.body.innerHTML = [
        renderToStaticMarkup(<OffsetPopGrammarRoot>{gallery}</OffsetPopGrammarRoot>),
        renderToStaticMarkup(<OffsetPopGrammarRoot theme="light"><p>Light</p></OffsetPopGrammarRoot>),
        renderToStaticMarkup(<OffsetPopGrammarRoot theme="dark"><p>Dark</p></OffsetPopGrammarRoot>),
    ].join("")
}

/** The Common objects whose hooks the family stylesheet names. */
const HOOK_GALLERY = (
    <>
        <Heading level={1} scale="display">Display</Heading>
        <Text tone="muted">Muted</Text>
        <Text tone="accent">Accent</Text>
        <Badge tone="accent">New</Badge>
        <Button variant="primary" onPress={noop}>Continue</Button>
        <SurfaceCard label="Top" wholeAction={{ kind: "link", href: "/top", label: "Open top" }}>
            <SurfaceCard ariaLabel="Nested" depth="nested" wholeAction={{ kind: "button", press: noop, label: "Open nested" }}>
                <p>Nested body</p>
            </SurfaceCard>
        </SurfaceCard>
        <SurfaceListCard label="Rows">{everyStateRow}</SurfaceListCard>
        <SurfaceListCard label="Nested rows" depth="nested">{everyStateRow}</SurfaceListCard>
        <Rail label="Details">Rail content</Rail>
        <SectionHeader eyebrow="Eyebrow" title="Section" />
        <TextAction appearance="tab" href="/tab" isCurrent>Tab</TextAction>
        <NavigationFeatureNav
            identity={<span>Brand</span>}
            navigation={<a href="/learn">Learn</a>}
            navigationLabel="Primary"
            compactNavigationTrigger={<button type="button">Menu</button>}
            compactNavigationTriggerLabel="Menu"
        />
    </>
)

/** Every Common object that stamps a geometry claim, in the variants that change the claim. */
const GEOMETRY_GALLERY = (
    <>
        {HOOK_GALLERY}
        <PageContainer><SectionHeader title="Section" description="Detail" action={<span>Action</span>} /></PageContainer>
        <PrimaryRailLayout primary={<p>Primary</p>} rail={<p>Rail</p>} collapsedOrder="rail-first" />
        <WorkspaceShell header={<span>Header</span>} navigation={<span>Nav</span>} navigationLabel="Workspace" primary={<p>Body</p>} primaryLabel="Body" />
        <Sidebar label="Workspace" selectedKey="home" groups={[{ id: "main", label: "Main", items: [{ id: "home", label: "Home", source: Glyph }] }]} />
        <SurfaceCard ariaLabel="Scrolling" isScrollable><p>Body</p></SurfaceCard>
        <SurfaceCard ariaLabel="Frameless" frame="frameless"><p>Body</p></SurfaceCard>
        <SurfaceCard label="Joined" composition="joined" height="fill" measure="formCompact"><div>A</div><div>B</div></SurfaceCard>
        <SurfaceListCard label="Scrolling rows" isScrollable fact="7">{everyStateRow}</SurfaceListCard>
        <SurfaceListCard ariaLabel="Verdicts" isVerdict>
            <StaticStateRow item={{ id: "up", label: "Up", verdict: "success" }} />
        </SurfaceListCard>
        <SurfaceAccordionCard
            label="Questions"
            isOpen
            isScrollable
            onOpenChange={noop}
            renderBody={(body: string) => body}
            renderSummary={(summary: string) => summary}
            summaryRender="Summary"
            bodyRender="Body"
        />
        <HorizontalScrollRegion overflow="needed"><div>Slots</div></HorizontalScrollRegion>
        <VerticalScrollRegion isScrollable><p>Conversation</p></VerticalScrollRegion>
        <EmptyNotice message="Nothing yet" iconSource={Glyph} actionLabel="Add" />
        <Input id="email" name="email" label="Email" hint="Work address" />
        <Progress label="Completion" value={40} />
        <Divider label="or" />
        <TextAction appearance="route" href="/next" isCurrent>Next</TextAction>
    </>
)

/** The family rules that could select `element` in some interaction state. */
const rulesReaching = (element: Element) => familyRules.filter((rule) => element.matches(reach(rule.selector)))

/**
 * The family's interactive-row treatment: a ListBox option, a Select/ComboBox option and a selectable
 * DataTable row are each the pointer and focus target themselves, so their hover, focus and selected
 * paint is keyed on the vendor's own state attributes on the row, in the component sheets.
 */
const componentRules = (name: string) => cssRules(sheet(`src/offset-pop/${name}`)).flatMap((rule) => selectorList(rule.selector))
const INTERACTIVE_ROW = /\[data-component="ListBox"\] \[data-grammar-list-item\]|\[data-grammar-popover\] \[data-grammar-option\]|\[data-component="DataTable"\] \[data-grammar-table-row\]/
const interactiveRowSelectors = ["components-navigation.css", "components-forms.css"]
    .flatMap(componentRules)
    .filter((selector) => INTERACTIVE_ROW.test(selector))

describe("Shipped Offset Pop stylesheet structure", () => {
    it("reads both packaged stylesheets", () => {
        expect(css.length).toBeGreaterThan(1000)
        expect(commonCss.length).toBeGreaterThan(1000)
        expect(familyRules.length).toBeGreaterThan(25)
    })

    it("ships every family rule inside its own layer, which Common orders after itself", () => {
        const order = commonCss.match(/@layer ([^;{]+);/)?.[1]?.split(",").map((name) => name.trim()) ?? []
        expect(order[0]).toBe("starci-grammar-common")
        expect(order).toContain("starci-grammar-offset-pop")
        expect(order.indexOf("starci-grammar-offset-pop")).toBeGreaterThan(order.indexOf("starci-grammar-common"))

        const body = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@import[^;]+;/g, "").trim()
        expect(body.startsWith("@layer starci-grammar-offset-pop {")).toBe(true)
        expect(body.endsWith("}")).toBe(true)
        expect(body.match(/@layer /g)).toHaveLength(1)
    })

    it("scopes every selector to the family root", () => {
        for (const rule of familyRules) {
            expect(rule.selector, "an unscoped family rule would paint every family").toMatch(
                /^\.grammar-common-root\[data-grammar-family="offset-pop"\]/,
            )
        }
    })
})

describe("Shipped Offset Pop rules land on rendered Common hooks", () => {
    it("reaches a rendered Common node with every family selector", () => {
        mountGallery(HOOK_GALLERY)
        const unreached = familyRules
            .filter((rule) => document.querySelector(reach(rule.selector)) === null)
            .map((rule) => rule.selector)
        expect(unreached).toEqual([])
    })

    it("paints no Common node outside a family root", () => {
        document.body.innerHTML = renderToStaticMarkup(<div>{HOOK_GALLERY}</div>)
        for (const rule of familyRules) expect(document.querySelector(reach(rule.selector)), rule.selector).toBeNull()
    })

    /*
     * The row treatment used to be `[data-grammar-row]:has(:is(a, button):hover)` and
     * `[data-grammar-row]:focus-within`, which no Common row could reach: StaticStateRow (the only
     * `data-grammar-row` emitter) renders strings, and a ListBox option (`role="option"`) may not hold
     * a link or button. Both were deleted; the rows that ARE interactive carry the treatment below.
     * This renders them, drives each state for real (select, pointer hover, keyboard focus) and
     * proves every interactive-row selector the family ships lands on a live row.
     */
    it("reaches a rendered Common row with the family's interactive-row treatment", async () => {
        installDomShims()
        expect(familyRules.some((rule) => /\[data-grammar-row\](?::focus-within|:has\()/.test(rule.selector))).toBe(false)
        expect(interactiveRowSelectors.length).toBeGreaterThan(8)

        render(
            <OffsetPopGrammarRoot>
                <ListBox label="Members" items={[{ id: "ada", label: "Ada" }, { id: "grace", label: "Grace" }, { id: "alan", label: "Alan" }]} />
                <DataTable
                    label="People"
                    columns={[{ id: "name", label: "Name", isRowHeader: true }]}
                    rows={[{ id: "ada" }, { id: "grace" }]}
                    renderCell={(row) => row.id}
                    selectionMode="single"
                    defaultSelectedIds={["ada"]}
                    emptyContent="Nobody"
                />
                <Select label="Size" defaultValue="two" options={[{ id: "one", label: "One" }, { id: "two", label: "Two" }, { id: "three", label: "Three" }]} />
            </OffsetPopGrammarRoot>,
        )
        // Each state is read while it holds: the vendor ends one row's hover when the pointer enters another.
        const reached = new Set<string>()
        const record = () => {
            for (const selector of interactiveRowSelectors) if (document.querySelector(reach(selector)) !== null) reached.add(selector)
        }
        const hover = (target: Element) => {
            fireEvent.pointerOver(target, { pointerType: "mouse" })
            fireEvent.pointerEnter(target, { pointerType: "mouse" })
        }

        // ListBox: a press selects Ada, the arrow key moves a focus-visible ring to Grace, the pointer rests on Alan.
        const members = within(screen.getByRole("listbox", { name: "Members" }))
        const ada = members.getByRole("option", { name: "Ada" })
        act(() => ada.focus())
        fireEvent.click(ada)
        fireEvent.keyDown(ada, { key: "ArrowDown" })
        fireEvent.keyUp(ada, { key: "ArrowDown" })
        expect(document.activeElement).toBe(members.getByRole("option", { name: "Grace" }))
        hover(members.getByRole("option", { name: "Alan" }))
        record()

        // DataTable: the pointer rests on an unselected row of a selectable table.
        hover(screen.getByRole("row", { name: /grace/ }))
        record()

        // Select: open from the keyboard onto the selected option, then move focus to the next one.
        const trigger = screen.getByRole("button", { name: /Size/ })
        await act(async () => {
            fireEvent.keyDown(trigger, { key: "ArrowDown" })
            fireEvent.keyUp(trigger, { key: "ArrowDown" })
        })
        const sizes = await screen.findByRole("listbox", { name: /Size/ })
        record()
        const current = sizes.querySelector("[data-focused=\"true\"]")
        expect(current).not.toBeNull()
        if (current !== null) fireEvent.keyDown(current, { key: "ArrowDown" })
        record()

        const unreached = interactiveRowSelectors.filter((selector) => !reached.has(selector))
        expect(unreached).toEqual([])
    })
})

/**
 * A `data-contract` id is a promise the Common sheet pays. The family repaints tone, boundary and
 * surface - that is what a family is for - but a geometry promise is Common's, so no family rule that
 * reaches a claiming node may redeclare the property that claim is about.
 */
const GEOMETRY_CLAIMS = {
    PADDING: /^padding/,
    GAP: /^(?:gap|row-gap|column-gap)$/,
    MARGIN: /^margin/,
    MEASURE: /^(?:(?:min-|max-)?(?:width|inline-size))$/,
    OVERFLOW: /^overflow/,
} as const

const contradictions = (claim: keyof typeof GEOMETRY_CLAIMS) => {
    mountGallery(GEOMETRY_GALLERY)
    const claiming = [...document.querySelectorAll("[data-contract]")]
        .filter((element) => (element.getAttribute("data-contract") ?? "").split(" ").some((id) => id.startsWith(`${claim}-`)))
    expect(claiming.length, `the gallery stamps no ${claim} claim`).toBeGreaterThan(0)
    return claiming.flatMap((element) => rulesReaching(element).flatMap((rule) => rule.declarations
        .filter((property) => GEOMETRY_CLAIMS[claim].test(property))
        .map((property) => `${element.getAttribute("data-contract")} <- ${property} in ${rule.selector}`)))
}

describe("Shipped Offset Pop paint keeps every Common geometry claim", () => {
    it.each(["PADDING", "GAP", "MARGIN", "MEASURE"] as const)("redeclares no %s a Common node claims", (claim) => {
        expect(contradictions(claim)).toEqual([])
    })

    /*
     * Regression guard: a `SurfaceListCard isScrollable` renders its collection as the vertical scroll
     * region itself - `data-grammar-list` and `data-grammar-scroll-region="vertical"` on one node that
     * claims OVERFLOW-3. Common pays that claim with `overflow-y: auto`, and the family layer is ordered
     * after Common, so any family `overflow` reaching that node would win and stop the list scrolling.
     */
    it("redeclares no OVERFLOW a Common node claims", () => {
        expect(contradictions("OVERFLOW")).toEqual([])
    })
})

/**
 * Pink as a FILL is the decision accent; pink as TEXT has to stay readable on the family canvas, so
 * the family routes every accent-coloured text node to its text-safe token instead of `--accent`.
 */
const ACCENT_TEXT_NODES = {
    "Text (accent tone)": "[data-component=\"Text\"][data-tone=\"accent\"]",
    "SectionHeader eyebrow": "[data-grammar-section-header] .starci-core-section-eyebrow",
    "TextAction (current tab)": "[data-component=\"TextAction\"][data-appearance=\"tab\"][data-current=\"true\"]",
} as const

describe("Shipped Offset Pop accent text", () => {
    it.each(Object.entries(ACCENT_TEXT_NODES))("colours %s with --offset-pop-accent-text", (_name, selector) => {
        mountGallery(HOOK_GALLERY)
        const node = document.querySelector(`.grammar-common-root[data-grammar-family="offset-pop"] ${selector}`)
        expect(node, `the gallery renders no ${selector}`).not.toBeNull()
        const colours = rulesReaching(node as Element)
            .flatMap((rule) => rule.values.filter((declaration) => declaration.property === "color"))
            .map((declaration) => declaration.value)
        expect(colours.length).toBeGreaterThan(0)
        expect(new Set(colours)).toEqual(new Set(["var(--offset-pop-accent-text)"]))
    })

    it("never colours text with the fill accent", () => {
        const fillAsText = familyRules.flatMap((rule) => rule.values
            .filter((declaration) => declaration.property === "color" && /var\(--accent\)/.test(declaration.value))
            .map((declaration) => `${declaration.property}: ${declaration.value} in ${rule.selector}`))
        expect(fillAsText).toEqual([])
    })
})

const inFamily = (element: ReactElement) => render(<OffsetPopGrammarRoot>{element}</OffsetPopGrammarRoot>)

describe("Common interaction states under Offset Pop", () => {
    it("keeps Button press, pending and disabled ownership", () => {
        const press = vi.fn()
        const { rerender } = inFamily(<Button onPress={press}>Save</Button>)
        fireEvent.click(screen.getByRole("button", { name: "Save" }))
        expect(press).toHaveBeenCalledTimes(1)

        rerender(<OffsetPopGrammarRoot><Button onPress={press} isPending>Save</Button></OffsetPopGrammarRoot>)
        const pending = screen.getByRole("button", { name: "Save" })
        expect((pending as HTMLButtonElement).disabled).toBe(true)
        // Common announces busy on the label it keeps reachable, as Core's Button spec reads it.
        expect(pending.querySelector("[aria-busy=\"true\"]")?.textContent).toBe("Save")
        expect(pending.getAttribute("data-action-pending")).toBe("true")
        fireEvent.click(pending)
        expect(press).toHaveBeenCalledTimes(1)

        rerender(<OffsetPopGrammarRoot><Button onPress={press} isDisabled>Save</Button></OffsetPopGrammarRoot>)
        const disabled = screen.getByRole("button", { name: "Save" })
        expect((disabled as HTMLButtonElement).disabled).toBe(true)
        expect(disabled.getAttribute("data-action-pending")).toBe("false")
    })

    it("keeps a destination Button a link and withholds it while pending", () => {
        const { rerender } = inFamily(<Button href="/checkout">Buy</Button>)
        expect(screen.getByRole("link", { name: "Buy" }).getAttribute("href")).toBe("/checkout")
        rerender(<OffsetPopGrammarRoot><Button href="/checkout" isPending>Buy</Button></OffsetPopGrammarRoot>)
        const link = screen.getByRole("link", { name: "Buy" })
        expect(link.hasAttribute("href")).toBe(false)
        expect(link.getAttribute("aria-disabled")).toBe("true")
    })

    it("keeps TextAction button and link semantics, current page, and pending lock", () => {
        const press = vi.fn()
        inFamily(<>
            <TextAction onPress={press}>More</TextAction>
            <TextAction onPress={press} isPending>Saving</TextAction>
            <TextAction href="/courses" appearance="route" isCurrent>Courses</TextAction>
        </>)
        fireEvent.click(screen.getByRole("button", { name: "More" }))
        fireEvent.click(screen.getByRole("button", { name: "Saving" }))
        expect(press).toHaveBeenCalledTimes(1)
        expect(screen.getByRole("button", { name: "Saving" }).getAttribute("aria-busy")).toBe("true")
        expect(screen.getByRole("link", { name: "Courses" }).getAttribute("aria-current")).toBe("page")
    })

    it("keeps field labelling, error and disabled state", () => {
        inFamily(<Input id="pw" name="pw" label="Password" kind="newPassword" errorMessage="Too short" isError isDisabled isRequired />)
        const field = screen.getByLabelText(/Password/)
        expect(field.getAttribute("aria-invalid")).toBe("true")
        expect((field as HTMLInputElement).disabled).toBe(true)
        expect(screen.getByText("Too short")).toBeTruthy()
    })

    it("keeps measurement, separator and collection roles", () => {
        inFamily(<>
            <Progress label="Completion" value={42} />
            <Divider label="or" />
            <Sidebar label="Workspace" selectedKey="home" groups={[{ id: "main", items: [
                { id: "home", label: "Home", source: Glyph },
                { id: "locked", label: "Locked", isDisabled: true },
            ] }]} />
        </>)
        expect(screen.getByRole("progressbar", { name: "Completion" }).getAttribute("aria-valuenow")).toBe("42")
        expect(screen.getByRole("separator", { name: "or" })).toBeTruthy()
        expect(screen.getByRole("listbox", { name: "Workspace" })).toBeTruthy()
        expect(screen.getByRole("option", { name: "Locked" }).getAttribute("data-disabled")).toBe("true")
    })

    it("keeps a whole-action surface focusable, named and pressable", () => {
        const press = vi.fn()
        inFamily(<>
            <SurfaceCard label="Course" wholeAction={{ kind: "link", href: "/course", label: "Open course" }}><p>Body</p></SurfaceCard>
            <SurfaceCard label="Lesson" wholeAction={{ kind: "button", press, label: "Start lesson" }}><p>Body</p></SurfaceCard>
        </>)
        const link = screen.getByRole("link", { name: "Open course" })
        link.focus()
        expect(document.activeElement).toBe(link)
        expect(link.getAttribute("href")).toBe("/course")

        const button = screen.getByRole("button", { name: "Start lesson" })
        button.focus()
        expect(document.activeElement).toBe(button)
        fireEvent.click(button)
        expect(press).toHaveBeenCalledTimes(1)
    })

    it.each(["pending", "unavailable"] as const)("takes a %s whole-action surface out of the focus order", (state) => {
        const press = vi.fn()
        inFamily(<>
            <SurfaceCard label="Course" state={state} wholeAction={{ kind: "link", href: "/course", label: "Open course" }}><p>Body</p></SurfaceCard>
            <SurfaceCard label="Lesson" state={state} wholeAction={{ kind: "button", press, label: "Start lesson" }}><p>Body</p></SurfaceCard>
        </>)
        const link = screen.getByLabelText("Open course")
        expect(link.hasAttribute("href")).toBe(false)
        expect(link.getAttribute("aria-disabled")).toBe("true")
        expect(link.getAttribute("tabindex")).toBe("-1")

        const button = screen.getByRole("button", { name: "Start lesson" })
        expect((button as HTMLButtonElement).disabled).toBe(true)
        fireEvent.click(button)
        expect(press).not.toHaveBeenCalled()
    })
})

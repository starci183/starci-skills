import { renderToStaticMarkup } from "react-dom/server"
import { createElement, type ReactElement, type SVGProps } from "react"
import { describe, expect, it } from "vitest"
import {
    COMMON_GRAMMAR_COMPONENTS,
    type CommonGrammarComponentName,
    type GrammarRootProps,
} from "../common/index.js"
import { OffsetPopGrammarRoot, offsetPopGrammar } from "./index.js"

const SCOPE = "data-grammar-family=\"offset-pop\""
const CommonRoot = COMMON_GRAMMAR_COMPONENTS.GrammarRoot
const Glyph = (props: SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" {...props}><path d="M1 1h1" /></svg>
const noop = () => undefined

/**
 * One render per Common renderer, reached through the Offset Pop family registry.
 *
 * Typed as a complete record so adding a Common renderer without a render here fails the type check,
 * and checked against the registry at runtime so it fails the suite too.
 */
const C = offsetPopGrammar.components
const EVERY_COMMON_RENDERER: Readonly<Record<CommonGrammarComponentName, () => ReactElement>> = {
    Badge: () => <C.Badge tone="accent">New</C.Badge>,
    Button: () => <C.Button variant="primary" onPress={noop}>Continue</C.Button>,
    ChatWorkspace: () => <C.ChatWorkspace label="Tutor" conversation={<p>Hello</p>} conversationLabel="Conversation" composer={<textarea aria-label="Message" />} />,
    Divider: () => <C.Divider label="or" />,
    EmptyNotice: () => <C.EmptyNotice message="Nothing yet" description="Add one" iconSource={Glyph} actionLabel="Add" />,
    FencedCodeBlock: () => <C.FencedCodeBlock language="TypeScript" code="const a = 1" />,
    GrammarRoot: () => <C.GrammarRoot>Root</C.GrammarRoot>,
    Heading: () => <C.Heading level={1} scale="display">Title</C.Heading>,
    HorizontalScrollRegion: () => <C.HorizontalScrollRegion><div>Slots</div></C.HorizontalScrollRegion>,
    Icon: () => <C.Icon source={Glyph} usage="leading" />,
    IconButton: () => <C.IconButton source={Glyph} label="Search" />,
    IconTile: () => <C.IconTile source={Glyph} tone="accent" size="md" />,
    IncludedMark: () => <C.IncludedMark label="Included" />,
    Input: () => <C.Input id="email" name="email" label="Email" hint="Work address" />,
    Label: () => <C.Label>Weekly goals</C.Label>,
    LeadingNumber: () => <C.LeadingNumber position={3} />,
    MarkdownArticle: () => <C.MarkdownArticle measure="reading"><p>Body</p></C.MarkdownArticle>,
    MarkdownTableFrame: () => <C.MarkdownTableFrame><table><tbody><tr><td>Cell</td></tr></tbody></table></C.MarkdownTableFrame>,
    MediaFrame: () => <C.MediaFrame caption="Caption"><Glyph role="img" aria-label="Artwork" /></C.MediaFrame>,
    NavigationFeatureNav: () => (
        <C.NavigationFeatureNav
            identity={<span>Brand</span>}
            navigation={<a href="/learn">Learn</a>}
            navigationLabel="Primary"
            compactNavigationTrigger={<button type="button">Menu</button>}
            compactNavigationTriggerLabel="Menu"
        />
    ),
    OtpInput: () => <C.OtpInput id="otp" name="otp" />,
    PageContainer: () => <C.PageContainer>Page</C.PageContainer>,
    PressableField: () => <C.PressableField label="Search" placeholder="Search" source={Glyph} onPress={noop} />,
    PrimaryRailLayout: () => <C.PrimaryRailLayout primary={<p>Primary</p>} rail={<p>Rail</p>} />,
    Progress: () => <C.Progress label="Completion" value={40} />,
    Rail: () => <C.Rail label="Details">Rail content</C.Rail>,
    RankArtwork: () => <C.RankArtwork kind="first" />,
    SectionHeader: () => <C.SectionHeader title="Section" description="Detail" />,
    Sidebar: () => <C.Sidebar label="Workspace" selectedKey="home" groups={[{ id: "main", label: "Main", items: [{ id: "home", label: "Home", source: Glyph }] }]} />,
    StateMark: () => <C.StateMark state="affirmative" />,
    StaticStateRow: () => <ul><C.StaticStateRow item={{ id: "a", label: "Ready", state: "affirmative" }} /></ul>,
    Subnav: () => <C.Subnav label="Course" title="Lesson" menuIcon={<span />} openMenuLabel="Open" closeMenuLabel="Close" isMenuOpen={false} />,
    SurfaceAccordionCard: () => (
        <C.SurfaceAccordionCard
            label="Questions"
            isOpen
            onOpenChange={noop}
            renderBody={(body: string) => body}
            renderSummary={(summary: string) => summary}
            summaryRender="Summary"
            bodyRender="Body"
        />
    ),
    SurfaceCard: () => <C.SurfaceCard label="Overview"><p>Body</p></C.SurfaceCard>,
    SurfaceCopyGroup: () => <C.SurfaceCopyGroup><p>Copy</p></C.SurfaceCopyGroup>,
    SurfaceListCard: () => <C.SurfaceListCard label="States"><C.StaticStateRow item={{ id: "a", label: "Ready" }} /></C.SurfaceListCard>,
    Tabs: () => <C.Tabs label="Views" selectedKey="one" items={[{ id: "one", label: "One" }, { id: "two", label: "Two" }]} />,
    Text: () => <C.Text tone="muted">Supporting copy</C.Text>,
    TextAction: () => <C.TextAction appearance="route" href="/next" isCurrent>Next</C.TextAction>,
    Tooltip: () => <C.Tooltip content="Hint"><button type="button">Trigger</button></C.Tooltip>,
    VerticalScrollRegion: () => <C.VerticalScrollRegion isScrollable><p>Conversation</p></C.VerticalScrollRegion>,
    WorkspaceShell: () => <C.WorkspaceShell header={<span>Header</span>} navigation={<span>Nav</span>} navigationLabel="Workspace" primary={<p>Body</p>} primaryLabel="Body" />,
}

const underOffsetPop = (render: () => ReactElement, props: GrammarRootProps = {}) =>
    renderToStaticMarkup(<OffsetPopGrammarRoot {...props}>{render()}</OffsetPopGrammarRoot>)
const underCommon = (render: () => ReactElement, props: GrammarRootProps = {}) =>
    renderToStaticMarkup(<CommonRoot {...props}>{render()}</CommonRoot>)

/** The root's opening tag, read out of static markup. */
const rootTag = (markup: string) => markup.slice(0, markup.indexOf(">") + 1)

describe("Offset Pop family registry", () => {
    it("is a frozen sibling family with its own id and scope props", () => {
        expect(offsetPopGrammar.id).toBe("offset-pop")
        expect(offsetPopGrammar.scopeProps).toEqual({ "data-grammar-family": "offset-pop" })
        expect(Object.isFrozen(offsetPopGrammar)).toBe(true)
        expect(Object.isFrozen(offsetPopGrammar.components)).toBe(true)
        expect(Object.isFrozen(offsetPopGrammar.styles.scope)).toBe(true)
    })

    it("publishes exactly the Common renderer surface, with no family-only extensions", () => {
        expect(Object.keys(offsetPopGrammar.components).sort()).toEqual(Object.keys(COMMON_GRAMMAR_COMPONENTS).sort())
        expect(offsetPopGrammar.components).not.toHaveProperty("DashboardShell")
        expect(OffsetPopGrammarRoot).toBe(offsetPopGrammar.components.GrammarRoot)
    })

    it("covers every Common renderer in this suite's render table", () => {
        expect(Object.keys(EVERY_COMMON_RENDERER).sort()).toEqual(Object.keys(COMMON_GRAMMAR_COMPONENTS).sort())
    })
})

describe("Every Common renderer under OffsetPopGrammarRoot", () => {
    /*
     * The family's whole runtime promise: it installs a scope and changes nothing below it. So the
     * markup under the family root must be the Common markup byte for byte once the one scope
     * attribute is removed - every data-component, data-grammar-* hook, data-contract claim, role,
     * aria-* relationship, disabled flag and generated id included.
     */
    // GrammarRoot is the one renderer the family replaces; its own claims are in the scope block below.
    const inherited = Object.entries(EVERY_COMMON_RENDERER).filter(([name]) => name !== "GrammarRoot")

    it("inherits every Common renderer except the root by identity", () => {
        for (const [name] of inherited) {
            const key = name as CommonGrammarComponentName
            expect(offsetPopGrammar.components[key], name).toBe(COMMON_GRAMMAR_COMPONENTS[key])
        }
    })

    it.each(inherited)("mounts %s with Common anatomy unchanged", (_name, render) => {
        const family = underOffsetPop(render)
        const common = underCommon(render)

        expect(family.match(/data-grammar-family="[^"]*"/g)).toEqual([SCOPE])
        expect(rootTag(family)).toContain(SCOPE)
        expect(family.replace(` ${SCOPE}`, "")).toBe(common)
    })

    it("keeps each primitive's public data-component identity inside the scope", () => {
        for (const name of [
            "Badge", "Button", "Divider", "EmptyNotice", "Heading", "Icon", "IconButton", "IconTile",
            "Input", "PressableField", "Progress", "Sidebar", "Text", "TextAction",
        ] as const) {
            const markup = underOffsetPop(EVERY_COMMON_RENDERER[name])
            expect(markup, `${name} lost its data-component`).toContain(`data-component="${name}"`)
            expect(markup.indexOf(SCOPE)).toBeLessThan(markup.indexOf(`data-component="${name}"`))
        }
    })
})

describe("OffsetPopGrammarRoot scope and theme", () => {
    it.each(["light", "dark", "system"] as const)("puts the %s theme and the family scope on one element", (theme) => {
        const tag = rootTag(underOffsetPop(() => <p>Body</p>, { theme }))
        expect(tag).toContain(SCOPE)
        expect(tag).toContain(`data-grammar-theme="${theme}"`)
        expect(tag).toContain("class=\"grammar-common-root\"")
        expect(tag).toContain("data-grammar=\"common\"")
    })

    it("follows the reader by default", () => {
        expect(rootTag(underOffsetPop(() => <p>Body</p>))).toContain("data-grammar-theme=\"system\"")
    })

    it("passes consumer root props through the way Common does", () => {
        const props: GrammarRootProps = { id: "app", className: "shell", "aria-label": "App", style: { minHeight: "100%" }, theme: "dark" }
        const family = underOffsetPop(() => <p>Body</p>, props)
        expect(family.replace(` ${SCOPE}`, "")).toBe(underCommon(() => <p>Body</p>, props))
        expect(rootTag(family)).toContain("class=\"grammar-common-root shell\"")
    })

    it("cannot be re-scoped to another family by a consumer prop", () => {
        const markup = renderToStaticMarkup(createElement(OffsetPopGrammarRoot, { "data-grammar-family": "core" }, "Body"))
        expect(markup.match(/data-grammar-family="[^"]*"/g)).toEqual([SCOPE])
    })

    it("lets a nested root own its own theme without disturbing the outer scope", () => {
        const markup = renderToStaticMarkup(
            <OffsetPopGrammarRoot theme="light">
                <p>Outer</p>
                <OffsetPopGrammarRoot theme="dark"><p>Inner</p></OffsetPopGrammarRoot>
            </OffsetPopGrammarRoot>,
        )
        const roots = markup.match(/<div[^>]*class="grammar-common-root"[^>]*>/g) ?? []
        expect(roots).toHaveLength(2)
        expect(roots[0]).toContain("data-grammar-theme=\"light\"")
        expect(roots[1]).toContain("data-grammar-theme=\"dark\"")
        for (const root of roots) expect(root).toContain(SCOPE)
    })

    it("installs the family scope inside a neutral Common root", () => {
        const markup = renderToStaticMarkup(
            <CommonRoot theme="light">
                <OffsetPopGrammarRoot theme="dark"><p>Family</p></OffsetPopGrammarRoot>
            </CommonRoot>,
        )
        const roots = markup.match(/<div[^>]*class="grammar-common-root"[^>]*>/g) ?? []
        expect(roots).toHaveLength(2)
        expect(roots[0]).not.toContain("data-grammar-family")
        expect(roots[1]).toContain(SCOPE)
        expect(roots[1]).toContain("data-grammar-theme=\"dark\"")
    })
})

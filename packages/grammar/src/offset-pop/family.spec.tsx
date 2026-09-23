import { CalendarDate, Time } from "@internationalized/date"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement, type ReactElement, type SVGProps } from "react"
import { describe, expect, it } from "vitest"
import {
    COMMON_GRAMMAR_COMPONENTS,
    createToastQueue,
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
    Accordion: () => <C.Accordion label="Settings" items={[{ id: "a", title: "First", content: "Body" }, { id: "b", title: "Second", content: "More" }]} defaultExpandedIds={["a"]} />,
    Alert: () => <C.Alert title="Changes saved" description="Visible to everyone." />,
    AlertDialog: () => <C.AlertDialog title="Leave?" confirmLabel="Leave" cancelLabel="Stay" onConfirm={noop} trigger={<C.Button>Leave</C.Button>} />,
    Avatar: () => <C.Avatar name="Ada Lovelace" size="lg" />,
    AvatarGroup: () => <C.AvatarGroup label="Members" items={[{ id: "a", name: "Ada" }, { id: "b", name: "Grace" }, { id: "c", name: "Linus" }]} max={2} overflowLabel={(count) => `${count} more`} />,
    Badge: () => <C.Badge tone="accent">New</C.Badge>,
    BottomNav: () => <C.BottomNav label="Primary" currentId="home" items={[{ id: "home", label: "Home", icon: <Glyph />, href: "/" }, { id: "search", label: "Search", icon: <Glyph />, href: "/search" }]} />,
    Breadcrumbs: () => <C.Breadcrumbs label="Breadcrumb" items={[{ id: "home", label: "Home", href: "/" }, { id: "here", label: "Here" }]} />,
    Button: () => <C.Button variant="primary" onPress={noop}>Continue</C.Button>,
    ButtonGroup: () => <C.ButtonGroup label="Formatting"><C.Button>Bold</C.Button><C.Button>Italic</C.Button></C.ButtonGroup>,
    Calendar: () => <C.Calendar label="Date" defaultValue={new CalendarDate(2026, 1, 15)} previousLabel="Previous" nextLabel="Next" />,
    ChatWorkspace: () => <C.ChatWorkspace label="Tutor" conversation={<p>Hello</p>} conversationLabel="Conversation" composer={<textarea aria-label="Message" />} />,
    Checkbox: () => <C.Checkbox label="Accept" description="Required to continue" name="accept" value="yes" />,
    CheckboxGroup: () => <C.CheckboxGroup label="Channels" options={[{ value: "email", label: "Email" }, { value: "sms", label: "SMS" }]} defaultValue={["email"]} name="channels" />,
    CloseButton: () => <C.CloseButton label="Dismiss notice" onPress={noop} />,
    ComboBox: () => <C.ComboBox label="Fruit" options={[{ id: "apple", label: "Apple" }, { id: "banana", label: "Banana" }]} description="Type to filter" />,
    DataTable: () => (
        <C.DataTable
            label="Records"
            columns={[{ id: "name", label: "Name", isRowHeader: true }, { id: "count", label: "Count", align: "end" }]}
            rows={[{ id: "a", name: "Alpha", count: 1 }, { id: "b", name: "Beta", count: 2 }]}
            renderCell={(row, columnId) => columnId === "name" ? row.name : row.count}
            emptyContent="None"
        />
    ),
    DateField: () => <C.DateField label="Date" defaultValue={new CalendarDate(2026, 1, 15)} />,
    DatePicker: () => <C.DatePicker label="Start" defaultValue={new CalendarDate(2026, 1, 15)} />,
    DateRangePicker: () => <C.DateRangePicker label="Range" defaultValue={{ start: new CalendarDate(2026, 1, 15), end: new CalendarDate(2026, 1, 17) }} />,
    DescriptionList: () => <C.DescriptionList items={[{ id: "a", term: "Term", description: "Detail" }]} />,
    Dialog: () => <C.Dialog title="Details" closeLabel="Close" trigger={<C.Button>Open</C.Button>} />,
    Disclosure: () => <C.Disclosure title="More" headingLevel={2}>Hidden detail</C.Disclosure>,
    Divider: () => <C.Divider label="or" />,
    Drawer: () => <C.Drawer title="Filters" closeLabel="Close filters" trigger={<C.Button>Filters</C.Button>}>Body</C.Drawer>,
    DropdownMenu: () => <C.DropdownMenu trigger={<C.Button>More</C.Button>} entries={[{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }]} />,
    EmptyNotice: () => <C.EmptyNotice message="Nothing yet" description="Add one" iconSource={Glyph} actionLabel="Add" />,
    FencedCodeBlock: () => <C.FencedCodeBlock language="TypeScript" code="const a = 1" />,
    Field: () => <C.Field label="Nickname" description="Shown to others" name="nick">{(control) => <input {...control} />}</C.Field>,
    Fieldset: () => <C.Fieldset legend="Details" description="Optional"><C.Input id="first" name="first" label="First" /></C.Fieldset>,
    FileDropzone: () => <C.FileDropzone label="Attachments" prompt="Drop files or browse" accept=".pdf" name="files" />,
    Footer: () => <C.Footer label="Footer" brand={<span>Brand</span>} groups={[{ id: "g", label: "About", links: [{ id: "l", label: "Team", href: "/team" }] }]} legal={<small>Legal</small>} />,
    Form: () => <C.Form label="Feedback" onSubmit={noop}><C.Textarea label="Note" /><C.Button type="submit">Send</C.Button></C.Form>,
    GrammarRoot: () => <C.GrammarRoot>Root</C.GrammarRoot>,
    Heading: () => <C.Heading level={1} scale="display">Title</C.Heading>,
    HorizontalScrollRegion: () => <C.HorizontalScrollRegion><div>Slots</div></C.HorizontalScrollRegion>,
    Icon: () => <C.Icon source={Glyph} usage="leading" />,
    IconButton: () => <C.IconButton source={Glyph} label="Search" />,
    IconTile: () => <C.IconTile source={Glyph} tone="accent" size="md" />,
    Image: () => <C.Image src="/hero.png" alt="Mountain lake" aspect="wide" />,
    IncludedMark: () => <C.IncludedMark label="Included" />,
    Input: () => <C.Input id="email" name="email" label="Email" hint="Work address" />,
    Kbd: () => <C.Kbd keys={["command", "shift", "K"]} />,
    Label: () => <C.Label>Weekly goals</C.Label>,
    LeadingNumber: () => <C.LeadingNumber position={3} />,
    Link: () => <C.Link href="/docs">Docs</C.Link>,
    ListBox: () => <C.ListBox label="Members" selectionMode="single" defaultSelectedIds={["a"]} items={[{ id: "a", label: "Ada" }, { id: "b", label: "Grace" }]} />,
    MarkdownArticle: () => <C.MarkdownArticle measure="reading"><p>Body</p></C.MarkdownArticle>,
    MarkdownTableFrame: () => <C.MarkdownTableFrame><table><tbody><tr><td>Cell</td></tr></tbody></table></C.MarkdownTableFrame>,
    MediaFrame: () => <C.MediaFrame caption="Caption"><Glyph role="img" aria-label="Artwork" /></C.MediaFrame>,
    Meter: () => <C.Meter label="Storage used" value={3} maxValue={5} valueLabel="3 of 5" tone="cautionary" />,
    NavigationFeatureNav: () => (
        <C.NavigationFeatureNav
            identity={<span>Brand</span>}
            navigation={<a href="/learn">Learn</a>}
            navigationLabel="Primary"
            compactNavigationTrigger={<button type="button">Menu</button>}
            compactNavigationTriggerLabel="Menu"
        />
    ),
    NumberField: () => <C.NumberField label="Seats" defaultValue={2} minValue={1} maxValue={3} />,
    OtpInput: () => <C.OtpInput id="otp" name="otp" />,
    PageContainer: () => <C.PageContainer>Page</C.PageContainer>,
    Pagination: () => <C.Pagination label="Pages" page={2} pageCount={5} onPageChange={noop} previousLabel="Previous" nextLabel="Next" pageLabel={(page) => `Page ${page}`} />,
    Popover: () => <C.Popover title="Share link" trigger={<C.Button>Share</C.Button>}>Panel</C.Popover>,
    PressableField: () => <C.PressableField label="Search" placeholder="Search" source={Glyph} onPress={noop} />,
    PrimaryRailLayout: () => <C.PrimaryRailLayout primary={<p>Primary</p>} rail={<p>Rail</p>} />,
    Progress: () => <C.Progress label="Completion" value={40} />,
    ProgressCircle: () => <C.ProgressCircle label="Upload" value={42} size="sm" />,
    RadioGroup: () => <C.RadioGroup label="Size" options={[{ value: "s", label: "Small" }, { value: "m", label: "Medium" }]} defaultValue="s" />,
    Rail: () => <C.Rail label="Details">Rail content</C.Rail>,
    RankArtwork: () => <C.RankArtwork kind="first" />,
    Rating: () => <C.Rating label="Quality" defaultValue={3} valueLabel={(value, max) => `${value} of ${max}`} />,
    SearchField: () => <C.SearchField label="Search" isLabelHidden defaultValue="cats" clearLabel="Clear" />,
    SectionHeader: () => <C.SectionHeader title="Section" description="Detail" />,
    SegmentedControl: () => <C.SegmentedControl label="Range" options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }]} defaultValue="day" name="range" />,
    Select: () => <C.Select label="Size" options={[{ id: "one", label: "One" }, { id: "two", label: "Two" }]} defaultValue="one" />,
    Sidebar: () => <C.Sidebar label="Workspace" selectedKey="home" groups={[{ id: "main", label: "Main", items: [{ id: "home", label: "Home", source: Glyph }] }]} />,
    Skeleton: () => <C.Skeleton lines={3} />,
    Slider: () => <C.Slider label="Volume" defaultValue={40} step={10} />,
    Spinner: () => <C.Spinner label="Loading" size="lg" />,
    StateMark: () => <C.StateMark state="affirmative" />,
    StaticStateRow: () => <ul><C.StaticStateRow item={{ id: "a", label: "Ready", state: "affirmative" }} /></ul>,
    Stepper: () => <C.Stepper label="Progress" currentStepId="two" steps={[{ id: "one", label: "One", state: "complete" }, { id: "two", label: "Two" }, { id: "three", label: "Three" }]} />,
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
    Switch: () => <C.Switch label="Notifications" description="Sent daily" defaultSelected />,
    Tabs: () => <C.Tabs label="Views" selectedKey="one" items={[{ id: "one", label: "One" }, { id: "two", label: "Two" }]} />,
    TagGroup: () => <C.TagGroup label="Topics" items={[{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }]} />,
    Text: () => <C.Text tone="muted">Supporting copy</C.Text>,
    TextAction: () => <C.TextAction appearance="route" href="/next" isCurrent>Next</C.TextAction>,
    Textarea: () => <C.Textarea label="Bio" description="Short intro" maxLength={20} rows={3} />,
    TimeField: () => <C.TimeField label="Alarm" defaultValue={new Time(9, 30)} hourCycle={24} />,
    Timeline: () => <C.Timeline label="History" items={[{ id: "a", title: "Created", dateTime: "2026-01-15", timeLabel: "15 Jan", state: "affirmative" }, { id: "b", title: "Updated", isCurrent: true }]} />,
    Toast: () => <C.Toast toast={{ id: "toast-1", version: 0, title: "Saved", description: "All changes kept." }} dismissLabel="Dismiss" onDismiss={noop} />,
    Toaster: () => <C.Toaster label="Notifications" dismissLabel="Dismiss" queue={createToastQueue()} />,
    Tooltip: () => <C.Tooltip content="Hint"><button type="button">Trigger</button></C.Tooltip>,
    TopBar: () => <C.TopBar brand={<a href="/">Brand</a>} navigation={<a href="/docs">Docs</a>} actions={<button type="button">Search</button>} />,
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

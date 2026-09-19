/** @vitest-environment jsdom */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createElement, type ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { cssRules, unbackedClaims } from "../__test__/styleClaims.js"
import { MarkdownArticle, FencedCodeBlock, MarkdownTableFrame } from "./branch/MarkdownArticle/index.js"
import { Rail } from "./branch/Rail/index.js"
import { Subnav } from "./branch/Subnav/index.js"
import { SurfaceAccordionCard } from "./branch/SurfaceAccordionCard/index.js"
import { SurfaceCard } from "./branch/SurfaceCard/index.js"
import { SurfaceListCard } from "./branch/SurfaceListCard/index.js"
import { StaticStateRow } from "./composite/StaticStateRow/index.js"
import { EmptyNotice } from "./composite/EmptyNotice/index.js"
import { NavigationFeatureNav } from "./composition/NavigationFeatureNav/index.js"
import { PrimaryRailLayout } from "./composition/PrimaryRailLayout/index.js"
import { Button } from "./primitive/Button/index.js"
import { Divider } from "./primitive/Divider/index.js"
import { Icon } from "./primitive/Icon/index.js"
import { IconButton } from "./primitive/IconButton/index.js"
import { IconTile } from "./primitive/IconTile/index.js"
import { Input } from "./primitive/Input/index.js"
import { Progress } from "./primitive/Progress/index.js"
import { SectionHeader } from "./primitive/SectionHeader/index.js"
import { Text } from "./primitive/Text/index.js"
import { TextAction } from "./primitive/TextAction/index.js"

/** jsdom rewrites `import.meta.url` to an http URL, so the sheet is resolved from the package root. */
const stylesPath = ["src/common/styles.css", "packages/grammar/src/common/styles.css"]
    .map((candidate) => resolve(process.cwd(), candidate))
    .find((candidate) => existsSync(candidate)) ?? ""
const css = readFileSync(stylesPath, "utf8")

const Glyph = (props: Record<string, unknown>) => createElement("svg", props)

/** Every element in one render that makes a `data-contract` promise. */
const claimedElements = (render: () => ReactElement): ReadonlyArray<Element> => {
    const host = document.createElement("div")
    host.innerHTML = renderToStaticMarkup(render())
    return [...host.querySelectorAll("[data-contract]")]
}

/**
 * Each object 0.4.4 moved out of Tailwind utilities, with a render that exercises the states whose
 * geometry the sheet now has to draw.
 */
const CONVERTED_OBJECTS: ReadonlyArray<readonly [string, () => ReactElement]> = [
    ["MarkdownArticle", () => <MarkdownArticle measure="reading"><p>Body</p></MarkdownArticle>],
    ["FencedCodeBlock", () => <FencedCodeBlock language="TypeScript" code="const a = 1" />],
    ["MarkdownTableFrame", () => <MarkdownTableFrame><table><tbody><tr><td>Cell</td></tr></tbody></table></MarkdownTableFrame>],
    ["Rail", () => <Rail label="Evidence" mode="sticky" inset="content">Facts</Rail>],
    ["Rail (fill)", () => <Rail label="Evidence" height="fill" inset="none">Facts</Rail>],
    ["Subnav", () => <Subnav label="Course" title="Lesson" menuIcon={<span />} openMenuLabel="Open" closeMenuLabel="Close" isMenuOpen={false} />],
    ["SurfaceCard", () => <SurfaceCard label="Card"><p>Body</p></SurfaceCard>],
    ["SurfaceCard (joined, frameless, nested)", () => <SurfaceCard ariaLabel="Card" frame="frameless" composition="joined" depth="nested"><p>Body</p></SurfaceCard>],
    ["SurfaceListCard", () => <SurfaceListCard label="List" fact="3 items"><StaticStateRow item={{ id: "a", label: "Row", description: "Detail" }} /></SurfaceListCard>],
    ["SurfaceListCard (nested verdict)", () => <SurfaceListCard ariaLabel="List" depth="nested" fact="3" isVerdict><li>Row</li></SurfaceListCard>],
    ["SurfaceAccordionCard", () => (
        <SurfaceAccordionCard
            label="Sections"
            depth="top"
            isOpen
            onOpenChange={vi.fn()}
            renderBody={(body: string) => body}
            renderSummary={(summary: string) => summary}
            summaryRender="Summary"
            bodyRender="Body"
        />
    )],
    ["EmptyNotice", () => <EmptyNotice message="Nothing yet" description="Add one" iconSource={Glyph} actionLabel="Add" />],
    ["NavigationFeatureNav", () => (
        <NavigationFeatureNav
            identity={<span>StarCi</span>}
            navigation={<span>Destinations</span>}
            navigationLabel="Primary"
            compactNavigationTrigger={<span>Menu</span>}
            compactNavigationTriggerLabel="Menu"
            actions={<span>Sign in</span>}
            actionsLabel="Account"
        />
    )],
    ["PrimaryRailLayout", () => <PrimaryRailLayout primary={<p>Primary</p>} rail={<p>Rail</p>} collapsedOrder="rail-first" />],
    ["SectionHeader", () => <SectionHeader title="Section" description="Detail" action={<span>Action</span>} />],
    ["Divider", () => <Divider label="or" />],
    ["Icon", () => <Icon source={Glyph} usage="leading" />],
    ["IconButton", () => <IconButton source={Glyph} label="Collapse" />],
    ["IconTile (accent)", () => <IconTile source={Glyph} tone="accent" size="md" />],
    ["IconTile (neutral)", () => <IconTile source={Glyph} tone="neutral" size="sm" />],
    ["IconTile (success)", () => <IconTile source={Glyph} tone="success" size="sm" />],
    ["Input", () => <Input id="email" name="email" label="Email" hint="Work address" />],
    ["Input (password)", () => <Input id="secret" name="secret" label="Password" kind="password" revealLabel="Show" hideLabel="Hide" />],
    ["Input (resting)", () => <Input id="email" name="email" label="Email" isSkeleton />],
    ["Progress", () => <Progress label="Completion" value={40} />],
    ["Progress (resting)", () => <Progress label="Completion" isSkeleton />],
    ["Text", () => <Text size="sm" tone="muted" startContent={<span />}>Copy</Text>],
    ["Text (metric lead)", () => <Text size="metric-lead" tone="accent">42</Text>],
    ["Text (resting)", () => <Text size="md" isSkeleton />],
    ["TextAction (route, current)", () => <TextAction appearance="route" size="sm" href="/x" isCurrent>Route</TextAction>],
    ["TextAction (choice, current)", () => <TextAction appearance="choice" size="xs" isCurrent onPress={vi.fn()}>Choice</TextAction>],
    ["TextAction (section)", () => <TextAction appearance="section" size="md" onPress={vi.fn()}>Section</TextAction>],
    ["TextAction (tab)", () => <TextAction appearance="tab" size="sm" onPress={vi.fn()}>Tab</TextAction>],
    ["TextAction (muted)", () => <TextAction appearance="muted" href="/y">Muted</TextAction>],
    ["TextAction (disclosure)", () => <TextAction appearance="disclosure" onPress={vi.fn()}>More</TextAction>],
    ["Button (fill)", () => <Button width="fill" onPress={vi.fn()}>Subscribe</Button>],
]

describe("Shipped Core geometry keeps its data-contract claims", () => {
    it("reads the packaged stylesheet", () => {
        expect(stylesPath).not.toBe("")
        expect(css.length).toBeGreaterThan(1000)
    })

    it("makes enough claims for this check to mean something", () => {
        expect(CONVERTED_OBJECTS.flatMap(([, render]) => claimedElements(render)).length).toBeGreaterThan(30)
    })

    it.each(CONVERTED_OBJECTS)("backs every claim %s emits with a shipped rule", (_name, render) => {
        for (const claimed of claimedElements(render)) {
            const classes = [...claimed.classList].filter((token) => token.startsWith("starci-core-"))
            expect(classes, `claimed element without a Grammar class: ${claimed.outerHTML.slice(0, 140)}`).not.toEqual([])
            expect(
                unbackedClaims(css, claimed),
                `unbacked claim on .${classes.join(".")}: ${claimed.outerHTML.slice(0, 140)}`,
            ).toEqual([])
        }
    })
})

describe("Shipped Core geometry replaces the utilities it used to spell", () => {
    it("draws every converted object's own rule instead of a consumer's Tailwind build", () => {
        for (const selector of [
            ".starci-core-empty-notice",
            ".starci-core-divider",
            ".starci-core-divider-rule",
            ".starci-core-icon",
            ".starci-core-icon-skeleton",
            ".starci-core-icon-button",
            ".starci-core-icon-tile",
            ".starci-core-input",
            ".starci-core-input-control",
            ".starci-core-input-reveal",
            ".starci-core-progress",
            ".starci-core-text",
            ".starci-core-text-action",
            ".starci-core-surface-fact",
            ".starci-core-accordion-root",
            ".starci-core-accordion-body",
            ".starci-core-accordion-scroll-region",
        ]) expect(css, `missing shipped rule for ${selector}`).toContain(`${selector} {`)
    })

    it("sizes an app-owned glyph by usage, since an SVG has no intrinsic box", () => {
        expect(css).toMatch(/\.starci-core-icon\[data-usage="heading"\]\s*\{[\s\S]*?width: 1\.5rem;/)
        expect(css).toMatch(/\.starci-core-icon\[data-usage="leading"\]\s*\{[\s\S]*?width: 1\.25rem;/)
        expect(css).toMatch(/\.starci-core-icon\[data-usage="chip"\]\s*\{[\s\S]*?width: 1rem;/)
    })

    it("takes every corner from the theme radius ramp, never a HeroUI v2 radius name", () => {
        expect(css).toMatch(/\.starci-core-icon-tile\[data-size="sm"\]\s*\{[\s\S]*?border-radius: var\(--radius-lg, var\(--radius, 0\.5rem\)\);/)
        expect(css).toMatch(/\.starci-core-icon-tile\[data-size="md"\]\s*\{[\s\S]*?border-radius: var\(--radius-xl, calc\(var\(--radius, 0\.5rem\) \* 1\.5\)\);/)
        expect(css).toContain(".starci-core-text-action[data-appearance=\"section\"] {")
        for (const declaration of css.match(/border-radius:[^;]+;/g) ?? []) {
            expect(declaration, "a corner may not name a HeroUI v2 radius").not.toMatch(/--radius-(?:large|medium|small)|rounded-/)
        }
    })

    it("reserves room for the password reveal toggle instead of letting it sit on the value", () => {
        expect(css).toMatch(/\.starci-core-input-control\[data-reveal="true"\] \.starci-core-input-field\s*\{[\s\S]*?padding-inline-end: 2\.75rem !important;/)
        const markup = renderToStaticMarkup(
            <Input id="secret" name="secret" label="Password" kind="password" revealLabel="Show" hideLabel="Hide" />,
        )
        expect(markup).toContain("data-reveal=\"true\"")
        expect(markup).toContain("starci-core-input-field")
    })

    it("lets a filling action wrap its label instead of overflowing", () => {
        expect(css).toMatch(/\.starci-core-button\[data-width="fill"\]\s*\{[\s\S]*?width: 100% !important;[\s\S]*?white-space: normal !important;/)
        const markup = renderToStaticMarkup(<Button width="fill" onPress={vi.fn()}>Subscribe now</Button>)
        expect(markup).toContain("data-width=\"fill\"")
        expect(markup).toContain("button--full-width")
    })

    it("ships the three authored overflow answers for one line of copy", () => {
        expect(css).toMatch(/\.starci-core-text\[data-overflow="truncate"\]\s*\{[\s\S]*?text-overflow: ellipsis;/)
        expect(css).toMatch(/\.starci-core-text\[data-overflow="clamp-2"\]\s*\{[\s\S]*?line-clamp: 2;/)
        expect(css).toMatch(/\.starci-core-text\[data-overflow="wrap"\]\s*\{[\s\S]*?overflow-wrap: anywhere;/)
        expect(renderToStaticMarkup(<Text overflow="truncate">Long</Text>)).toContain("data-overflow=\"truncate\"")
    })

    it("lifts the rail above the primary content once the container collapses", () => {
        expect(css).toMatch(/@container starci-core-primary-rail \(max-width: 56rem\)[\s\S]*?data-grammar-layout-collapsed-order="rail-first"\] \.starci-core-rail-region\s*\{[\s\S]*?order: -1;/)
    })

    /**
     * `SectionHeader` stamps `data-contract="GAP-5"` on its root, but `declarationsFor` unions
     * declarations across every rule that targets the class - it would call the claim backed as
     * long as ANY rule resolves to 1.5rem, even if a narrower `@container` rule quietly overrides
     * it to something else. jsdom never evaluates a container query, so the union check is blind to
     * that override; only reading every rule that targets `.starci-core-section-header` catches it.
     *
     * `PrimaryRailLayout` and `WorkspaceShell` are the other two GAP-5 region roots in the family,
     * and both hold `var(--starci-core-region-gap)` across every collapse tier - only the grid
     * columns/areas change underneath them. A collapsed `SectionHeader` follows the same rule: it
     * may stack to a column, but it stays a region boundary, so its gap must stay GAP-5 too.
     */
    it("keeps the SectionHeader root at GAP-5 in every state, including the narrow-container collapse", () => {
        const rulesForRoot = cssRules(css).filter((rule) =>
            rule.selector.split(",").some((part) => part.trim().split(/\s+/).at(-1) === ".starci-core-section-header"),
        )
        // The default rule plus the `@container starci-core-primary-rail (max-width: 32rem)` collapse rule.
        expect(rulesForRoot.length).toBeGreaterThanOrEqual(2)

        for (const rule of rulesForRoot) {
            const gapDeclarations = rule.body
                .split(";")
                .map((declaration) => declaration.split(":"))
                .filter((parts) => parts.length >= 2 && parts[0]?.trim() === "gap")
            for (const [, ...rest] of gapDeclarations) {
                expect(
                    rest.join(":").trim(),
                    `.starci-core-section-header gap must resolve to GAP-5 (1.5rem) in every rule, including narrow collapse: { ${rule.body.trim()} }`,
                ).toMatch(/1\.5rem/)
            }
        }
    })

    it("renders no navigation landmark when the bar has no destinations", () => {
        const markup = renderToStaticMarkup(
            <NavigationFeatureNav
                identity={<span>StarCi</span>}
                compactNavigationTrigger={<span>Menu</span>}
                compactNavigationTriggerLabel="Menu"
            />,
        )
        expect(markup).not.toContain("<nav")
        expect(markup).toContain("data-grammar-navigation-feature-nav-destinations=\"absent\"")
        expect(css).toMatch(/data-grammar-navigation-feature-nav-destinations="absent"\] \.starci-core-navigation-feature-nav-primary\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto !important;/)
    })

    /**
     * The surface family draws ONE boundary and takes ONE inset inside it.
     *
     * `SurfaceCard` is the only member whose root is a HeroUI `Card`, and the vendor's `.card`
     * carries a 1rem padding. Unreset, it inset the card's visible surface and its label 16px
     * further than a `SurfaceListCard` or a `SurfaceAccordionCard` standing beside it, and stacked
     * a second inset under the content region's own `PADDING-4`. The two `<section>`-rooted members
     * never had it, which is why the claim is checked against all three renders at once.
     */
    it("resets the vendor inset on the card root and keeps the family's own inset inside it", () => {
        const cardStart = css.indexOf(".starci-core-surface-card {")
        expect(cardStart).toBeGreaterThanOrEqual(0)
        expect(css.slice(cardStart, css.indexOf("}", cardStart))).toContain("padding: 0 !important;")
        expect(css).toMatch(/\.starci-core-surface-content\s*\{[\s\S]*?padding: var\(--starci-core-surface-inset, 1rem\);/)

        const card = renderToStaticMarkup(<SurfaceCard label="Included"><p>Body</p></SurfaceCard>)
        expect(card).toMatch(/<section[^>]*class="[^"]*starci-core-surface-card[^"]*"[^>]*data-slot="card"|<section[^>]*data-slot="card"[^>]*class="[^"]*starci-core-surface-card/)
        expect(card).toContain("data-contract=\"PADDING-4\"")

        for (const markup of [
            renderToStaticMarkup(<SurfaceListCard label="Rows"><StaticStateRow item={{ id: "a", label: "One" }} /></SurfaceListCard>),
            renderToStaticMarkup(
                <SurfaceAccordionCard
                    bodyRender="Body"
                    isOpen={false}
                    label="Terms"
                    onOpenChange={vi.fn()}
                    renderBody={(body: string) => <p>{body}</p>}
                    renderSummary={(summary: string) => <span>{summary}</span>}
                    summaryRender="Summary"
                />,
            ),
        ]) {
            expect(markup, "a Grammar-rooted family member takes no vendor card slot").not.toContain("data-slot=\"card\"")
        }
    })

    it("keeps `!important` to the vendor parts it was introduced for", () => {
        for (const selector of [
            ".starci-core-surface-card",
            ".starci-core-accordion-trigger",
            ".starci-core-accordion-panel",
        ]) {
            const start = css.indexOf(`${selector} {`)
            expect(start, `missing shipped rule for ${selector}`).toBeGreaterThanOrEqual(0)
            expect(css.slice(start, css.indexOf("}", start))).toContain("!important")
        }
        expect(css).toMatch(/\.starci-core-subnav-toggle \{[\s\S]*?border-radius: 0 !important;/)
    })
})

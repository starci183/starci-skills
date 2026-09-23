// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it } from "vitest"
import { GRAMMAR_ROOT_CASES, expectInFamilyScope } from "../../../__test__/grammarRoots.js"
import { NavigationFeatureNav } from "../NavigationFeatureNav/index.js"
import { TopBar } from "../TopBar/index.js"
import { WorkspaceShell, resolveWorkspaceHeaderLandmark } from "./index.js"

afterEach(cleanup)

describe("Core WorkspaceShell", () => {
    it("owns header, sidebar, main and compact projections in one layout", () => {
        const markup = renderToStaticMarkup(<WorkspaceShell header={<span>Header</span>} compactHeader={<span>Compact header</span>} navigation={<span>Sidebar</span>} navigationLabel="Workspace" navigationTrack="intrinsic" navigationVisibility="wide" primary={<p>Body</p>} primaryLabel="Body" compactNavigation={<span>Tabs</span>} compactNavigationLabel="Views" />)
        expect(markup).toContain("data-grammar-workspace-shell=\"true\"")
        expect(markup).toContain("data-grammar-workspace-navigation-region=\"true\"")
        expect(markup).toContain("data-grammar-workspace-compact-header=\"true\"")
        expect(markup).toContain("data-grammar-workspace-compact-navigation=\"true\"")
        expect(markup.match(/<main/g)).toHaveLength(1)
    })

    it("allows a routed surface to retain the single main landmark", () => {
        const markup = renderToStaticMarkup(<WorkspaceShell mainLandmark="caller" primary={<main aria-label="Course">Course</main>} />)
        expect(markup.match(/<main/g)).toHaveLength(1)
        expect(markup).toContain("data-grammar-main-landmark=\"caller\"")
    })

    it("resolves the banner owner: explicit prop, then a Grammar app bar in the slot, else the shell", () => {
        expect(resolveWorkspaceHeaderLandmark(<span>Title</span>)).toBe("shell")
        expect(resolveWorkspaceHeaderLandmark(<TopBar brand="Brand" />)).toBe("slot")
        expect(resolveWorkspaceHeaderLandmark(<NavigationFeatureNav identity="Brand" compactNavigationTrigger={null} compactNavigationTriggerLabel="Menu" />)).toBe("slot")
        expect(resolveWorkspaceHeaderLandmark(<span>Title</span>, "slot")).toBe("slot")
        expect(resolveWorkspaceHeaderLandmark(<TopBar brand="Brand" />, "shell")).toBe("shell")
    })
})

describe.each(GRAMMAR_ROOT_CASES)("WorkspaceShell landmarks under $name", ({ Root, family }) => {
    it("is the one banner when the header slot holds plain content", () => {
        render(<Root><WorkspaceShell header={<strong>Studio</strong>} primary={<p>Body</p>} primaryLabel="Body" /></Root>)
        const banners = screen.getAllByRole("banner")
        expect(banners).toHaveLength(1)
        expect(banners[0]?.getAttribute("data-grammar-workspace-header-landmark")).toBe("shell")
        expectInFamilyScope(banners[0] ?? null, family)
    })

    it("yields the banner to a hosted TopBar, so there is exactly one and it is not nested", () => {
        const { container } = render(<Root><WorkspaceShell header={<TopBar brand="Studio" position="static" />} primary={<p>Body</p>} primaryLabel="Body" /></Root>)
        const banners = screen.getAllByRole("banner")
        expect(banners).toHaveLength(1)
        expect(banners[0]?.getAttribute("data-component")).toBe("TopBar")
        const wrapper = container.querySelector("[data-grammar-workspace-header=\"true\"]")
        expect(wrapper?.tagName).toBe("DIV")
        expect(wrapper?.getAttribute("data-grammar-workspace-header-landmark")).toBe("slot")
        expect(container.querySelectorAll("header header")).toHaveLength(0)
    })

    it("yields the banner to a hosted NavigationFeatureNav", () => {
        const { container } = render(<Root><WorkspaceShell
            header={<NavigationFeatureNav identity="Studio" navigation={<a href="#a">A</a>} navigationLabel="Primary" compactNavigationTrigger={<button type="button">Menu</button>} compactNavigationTriggerLabel="Open navigation" />}
            primary={<p>Body</p>}
            primaryLabel="Body"
        /></Root>)
        expect(screen.getAllByRole("banner")).toHaveLength(1)
        expect(container.querySelectorAll("header header")).toHaveLength(0)
    })

    it("yields to an app-owned bar when told to", () => {
        const { container } = render(<Root><WorkspaceShell headerLandmark="slot" header={<header aria-label="App">App bar</header>} primary={<p>Body</p>} primaryLabel="Body" /></Root>)
        expect(screen.getAllByRole("banner")).toHaveLength(1)
        expect(container.querySelectorAll("header header")).toHaveLength(0)
    })
})

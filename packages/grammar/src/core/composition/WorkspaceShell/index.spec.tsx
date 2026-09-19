import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { WorkspaceShell } from "./index.js"

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
})

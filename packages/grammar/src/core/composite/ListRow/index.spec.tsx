// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { installDomShims } from "../../../__test__/grammarRoots.js"
import { SurfaceListCard } from "../../branch/SurfaceListCard/index.js"
import { StaticStateRow } from "../StaticStateRow/index.js"
import { ListRow } from "./index.js"

beforeAll(installDomShims)
afterEach(cleanup)

const css = readFileSync(
    ["src/common/styles.css", "packages/grammar/src/common/styles.css"].map((c) => resolve(process.cwd(), c)).find((c) => existsSync(c)) ?? "",
    "utf8",
)

describe("Core ListRow", () => {
    it("is a list item of its SurfaceListCard and shares the static row's geometry", () => {
        render(
            <SurfaceListCard label="Accounts">
                <ListRow title="Main" description="Bank A · •••• 4321" />
                <StaticStateRow item={{ id: "s", label: "Static" }} />
            </SurfaceListCard>,
        )
        const list = screen.getByRole("list")
        const items = within(list).getAllByRole("listitem")
        expect(items).toHaveLength(2)
        const row = items[0]!
        expect(row.getAttribute("data-component")).toBe("ListRow")
        expect(row.className).toContain("starci-core-static-row")
        expect(row.className).toContain("starci-core-list-row")
        expect(row.getAttribute("data-contract")).toBe("GAP-3 PADDING-4 BOUNDARY-3")
    })

    it("renders only the parts it is given, in reading order: leading, title, badges, description, actions, detail", () => {
        render(
            <ul>
                <ListRow
                    leading={<span data-testid="mark" />}
                    title="Main"
                    badges={<span>Connected</span>}
                    description="Bank A"
                    actions={<button type="button">Continue</button>}
                >
                    <p>Detail about Main</p>
                </ListRow>
            </ul>,
        )
        const row = screen.getByRole("listitem")
        expect(row.getAttribute("data-grammar-leading")).toBe("true")
        expect(row.getAttribute("data-grammar-actions")).toBe("true")
        expect(row.textContent).toBe("MainConnectedBank AContinueDetail about Main")
        expect(row.querySelector(".starci-core-list-row-detail")?.textContent).toBe("Detail about Main")
    })

    it("leaves no wrapper for an absent part", () => {
        render(<ul><ListRow title="Plain" /></ul>)
        const row = screen.getByRole("listitem")
        expect(row.getAttribute("data-grammar-leading")).toBe("false")
        expect(row.getAttribute("data-grammar-actions")).toBe("false")
        for (const part of ["leading", "badges", "description", "actions", "detail"]) {
            expect(row.querySelector(`.starci-core-list-row-${part}`), part).toBeNull()
        }
    })

    it("exposes its state and verdict for the family", () => {
        render(<ul><ListRow title="Old" state="negative" verdict="danger" /></ul>)
        const row = screen.getByRole("listitem")
        expect(row.getAttribute("data-grammar-state")).toBe("negative")
        expect(row.getAttribute("data-verdict")).toBe("danger")
    })

    it("collapses by default, widens to three tracks in the surface query, and shares the separator", () => {
        // 0.9.4: collapsed actions keep their own width and wrap only when the copy's 12rem basis no longer fits.
        expect(css).toMatch(/\.starci-core-list-row-actions \{[\s\S]*?flex: 0 1 auto;/)
        expect(css).toMatch(/@container starci-core-surface \(min-width: 28\.001rem\) \{[\s\S]*?\.starci-core-list-row\[data-grammar-leading="true"\] \{\s*grid-template-columns: auto minmax\(0, 1fr\) auto;/)
        expect(css).toMatch(/\.starci-core-static-row \+ \.starci-core-static-row \{\s*border-top: 1px solid/)
    })
})

describe("SurfaceListCard label row with a fact and an end action", () => {
    it("keeps the fact beside the label and the action at the end", () => {
        render(
            <SurfaceListCard label="Bank feed" fact="3 accounts" labelEnd={<button type="button">Add</button>}>
                <ListRow title="Main" />
            </SurfaceListCard>,
        )
        const labelRow = screen.getByRole("heading", { name: "Bank feed" }).parentElement!
        expect(labelRow.getAttribute("data-grammar-label-end")).toBe("true")
        expect(labelRow.textContent).toBe("Bank feed3 accountsAdd")
        expect(screen.getByRole("button", { name: "Add" }).closest(".starci-core-surface-label-end")).not.toBeNull()
    })

    it("still renders a lone fact without an end slot", () => {
        render(<SurfaceListCard label="Checks" fact="4 items"><ListRow title="One" /></SurfaceListCard>)
        const labelRow = screen.getByRole("heading", { name: "Checks" }).parentElement!
        expect(labelRow.getAttribute("data-grammar-label-end")).toBe("false")
        expect(labelRow.querySelector(".starci-core-surface-label-end")).toBeNull()
    })
})

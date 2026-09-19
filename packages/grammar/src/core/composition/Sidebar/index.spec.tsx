/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Sidebar } from "./index.js"
import {
    sidebarClassName,
    sidebarFooterClassName,
    sidebarHeaderClassName,
    sidebarItemClassName,
    sidebarItemLabelClassName,
    sidebarItemTrailingClassName,
    sidebarListClassName,
    sidebarSectionClassName,
    sidebarSectionLabelClassName,
    sidebarToggleClassName,
} from "./classNames.js"

afterEach(cleanup)

const HomeGlyph = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />

describe("Core Sidebar", () => {
    it("renders one controlled grouped destination collection", () => {
        const action = vi.fn()
        render(<Sidebar label="Workspace" selectedKey="home" groups={[{ id: "main", label: "Main", items: [{ id: "home", label: "Home", source: HomeGlyph }, { id: "locked", label: "Locked", isDisabled: true }] }]} onAction={action} />)
        expect(screen.getByRole("listbox", { name: "Workspace" })).toBeTruthy()
        expect(screen.getByText("Main")).toBeTruthy()
        expect(screen.getByText("Home")).toBeTruthy()
        expect(screen.getByRole("option", { name: "Locked" }).getAttribute("data-disabled")).toBe("true")
    })

    it("keeps every group when a group is named after the destination it holds", () => {
        const groups = [
            { id: "home", items: [{ id: "home", label: "Home", source: HomeGlyph }] },
            { id: "path", label: "Your path", items: [{ id: "modules", label: "Modules", source: HomeGlyph }] },
        ]
        const { container, rerender } = render(<Sidebar label="Workspace" groups={groups} collapseLabel="Collapse" expandLabel="Expand" toggleSource={HomeGlyph} onCollapsedChange={() => {}} />)
        expect(container.querySelectorAll("[role=option]")).toHaveLength(2)
        expect(screen.getByText("Your path")).toBeTruthy()
        rerender(<Sidebar label="Workspace" groups={groups} isCollapsed collapseLabel="Collapse" expandLabel="Expand" toggleSource={HomeGlyph} onCollapsedChange={() => {}} />)
        expect(container.querySelectorAll("[role=option]")).toHaveLength(2)
    })

    it("owns collapse geometry while caller owns collapse state", () => {
        const change = vi.fn()
        render(<Sidebar label="Workspace" isCollapsed collapseLabel="Collapse" expandLabel="Expand" toggleSource={HomeGlyph} groups={[{ id: "main", items: [{ id: "home", label: "Home", source: HomeGlyph }] }]} onCollapsedChange={change} />)
        expect(screen.getByRole("button", { name: "Expand" })).toBeTruthy()
        expect(screen.queryByText("Home")).toBeNull()
        fireEvent.click(screen.getByRole("button", { name: "Expand" }))
        expect(change).toHaveBeenCalledWith(false)
    })

    /**
     * Geometry is a CLASS and a STATE, never a utility string.
     *
     * The rail width, the separator and the item shape are shipped CSS; the component's job is to
     * name the part and publish the state the sheet reads. Asserting the class names here is what
     * keeps a later edit from quietly re-inlining `w-64` and breaking every consumer that does not
     * scan this package with Tailwind.
     */
    it("names every part with a Grammar class and publishes its state on the root", () => {
        const { container } = render(<Sidebar label="Workspace" selectedKey="home" collapseLabel="Collapse" expandLabel="Expand" toggleSource={HomeGlyph} header={<span>Resume</span>} footer={<span>Sign out</span>} groups={[{ id: "main", label: "Main", items: [{ id: "home", label: "Home", source: HomeGlyph, trailing: <span>3</span> }] }]} onCollapsedChange={() => {}} />)
        const root = container.querySelector("[data-component='Sidebar']")
        expect(root?.className).toBe(sidebarClassName)
        expect(root?.getAttribute("data-presentation")).toBe("rail")
        expect(root?.getAttribute("data-collapsed")).toBe("false")
        expect(root?.getAttribute("data-tier")).toBe("composition")
        expect(root?.getAttribute("data-contract")).toBe("OVERFLOW-2 MEASURE-6")
        for (const className of [sidebarToggleClassName, sidebarHeaderClassName, sidebarFooterClassName, sidebarItemLabelClassName, sidebarItemTrailingClassName]) {
            expect(container.querySelector(`.${className}`), `missing ${className}`).toBeTruthy()
        }
        for (const className of [sidebarListClassName, sidebarSectionClassName, sidebarSectionLabelClassName, sidebarItemClassName]) {
            expect(container.querySelector(`.${className}`), `missing ${className}`).toBeTruthy()
        }
        expect(container.innerHTML).not.toContain("rounded-large")
        expect(container.innerHTML).not.toContain("w-64")
    })

    it("moves the drawer and collapsed projections onto root state, not onto new classes", () => {
        const groups = [{ id: "main", label: "Main", items: [{ id: "home", label: "Home", source: HomeGlyph }] }]
        const { container, rerender } = render(<Sidebar label="Workspace" presentation="drawer" groups={groups} />)
        const root = () => container.querySelector("[data-component='Sidebar']")
        expect(root()?.className).toBe(sidebarClassName)
        expect(root()?.getAttribute("data-presentation")).toBe("drawer")
        expect(root()?.getAttribute("data-contract")).toBe("OVERFLOW-2 MEASURE-2")
        rerender(<Sidebar label="Workspace" isCollapsed collapseLabel="Collapse" expandLabel="Expand" toggleSource={HomeGlyph} groups={groups} onCollapsedChange={() => {}} />)
        expect(root()?.className).toBe(sidebarClassName)
        expect(root()?.getAttribute("data-collapsed")).toBe("true")
        expect(container.querySelector(`.${sidebarListClassName}`)?.getAttribute("data-contract")).toBe("GAP-1 PADDING-2")
        expect(container.querySelector(`.${sidebarItemClassName}`)?.getAttribute("data-contract")).toBe("TONE-1 SURFACE-4")
        expect(container.querySelector(`.${sidebarSectionLabelClassName}`)?.hasAttribute("data-contract")).toBe(false)
        expect(screen.getByText("Main")).toBeTruthy()
    })
})

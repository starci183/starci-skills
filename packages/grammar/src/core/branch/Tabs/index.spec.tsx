// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { useState } from "react"
import { renderToString } from "react-dom/server"
import { afterAll, afterEach, describe, expect, it, vi } from "vitest"
import { Tabs } from "./index.js"

vi.stubGlobal("ResizeObserver", class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
})

afterEach(cleanup)

// jsdom has no Web Animations API; the real collection uses it for indicator moves.
const getAnimationsDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "getAnimations")
Object.defineProperty(Element.prototype, "getAnimations", { configurable: true, value: () => [] })
afterAll(() => {
    if (getAnimationsDescriptor) Object.defineProperty(Element.prototype, "getAnimations", getAnimationsDescriptor)
    else Reflect.deleteProperty(Element.prototype, "getAnimations")
})

describe("Core Tabs", () => {
    it("keeps the server and first client tree stable before HeroUI collection hydration", () => {
        const html = renderToString(<Tabs label="Workspace" selectedKey="content" items={[{ id: "content", label: "Task brief" }]} />)
        expect(html).toContain("data-grammar-tabs-client=\"pending\"")
        expect(html).not.toContain("data-slot=\"tabs\"")
    })

    it("owns horizontal overflow and keeps every peer destination accessible", () => {
        const onSelect = vi.fn()
        const { container } = render(<Tabs
            label="Dashboard"
            selectedKey="overview"
            items={[
                { id: "overview", label: "Overview", leading: <span aria-hidden="true">1</span> },
                { id: "community", label: "Community", leading: <span aria-hidden="true">2</span> },
            ]}
            onSelect={onSelect}
            panelId={(key) => `panel-${key}`}
        />)

        expect(container.querySelector("[data-grammar-tabs='true']")).not.toBeNull()
        expect(container.querySelector("[data-grammar-tabs-inset='none']")).not.toBeNull()
        expect(container.querySelector("[data-grammar-tabs-overflow='scroll']")?.getAttribute("class")).toContain("scroll-shadow--hide-scrollbar")
        expect(screen.getByRole("tab", { name: "Overview" }).getAttribute("class")).toContain("tabs__tab")
        expect(screen.getByRole("tab", { name: "Overview" }).getAttribute("aria-controls")).toBeTruthy()
        fireEvent.click(screen.getByRole("tab", { name: "Community" }))
        expect(onSelect).toHaveBeenCalledWith("community")
    })

    /*
     * The strip's stamp is the region's, so the strip's answer has to be the region's too. Tabs used
     * to pass `data-contract="OVERFLOW-4"` into a region that stamped `OVERFLOW-3` over it, and the
     * node then promised the axis always scrolls while it scrolls only when the destinations overflow.
     */
    it("claims the one overflow answer the peer strip actually renders", () => {
        const { container } = render(<Tabs label="Dashboard" selectedKey="overview" items={[
            { id: "overview", label: "Overview" },
            { id: "community", label: "Community" },
        ]} />)

        const strip = container.querySelector("[data-grammar-tabs-overflow='scroll']")
        expect(strip).not.toBeNull()
        const claims = (strip?.getAttribute("data-contract") ?? "").split(" ").filter(Boolean)
        expect(claims).toContain("OVERFLOW-4")
        expect(claims).not.toContain("OVERFLOW-3")
        expect(strip?.getAttribute("data-grammar-overflow")).toBe("needed")
    })

    it("exposes an explicit compact-label identity mode", () => {
        const { container } = render(<Tabs label="Workspace" selectedKey="content" labelVisibility="always" items={[{ id: "content", label: "Task brief" }]} />)
        expect(container.querySelector("[data-grammar-tab-labels='always']")).not.toBeNull()
        expect(screen.getByText("Task brief")).not.toBeNull()
    })

    it("owns the optional page inset instead of requiring an app wrapper", () => {
        const { container } = render(<Tabs inset="page" label="Workspace" selectedKey="content" items={[{ id: "content", label: "Task brief" }]} />)
        expect(container.querySelector("[data-grammar-tabs-inset='page']")).not.toBeNull()
    })
    it.each(["stable", "inline"] as const)("links real external panels on mount and selection with a %s callback", async (callbackMode) => {
        const items = [{ id: "overview", label: "Overview" }, { id: "community", label: "Community" }]
        const stablePanelId = (key: string) => `external-${key}`
        const onSelect = vi.fn()
        const Example = () => {
            const [selectedKey, setSelectedKey] = useState("overview")
            return <>
                <Tabs label="External panels" selectedKey={selectedKey} items={items}
                    panelId={callbackMode === "stable" ? stablePanelId : (key) => `external-${key}`}
                    onSelect={(key) => { onSelect(key); setSelectedKey(key) }} />
                {items.map((item) => <section key={item.id} id={stablePanelId(item.id)} role="tabpanel"
                    aria-label={item.label} hidden={selectedKey !== item.id}>{item.label} body</section>)}
            </>
        }
        const { container, unmount } = render(<Example />)
        const assertLinks = async (selectedLabel: string) => {
            await waitFor(() => {
                for (const item of items) {
                    const tab = screen.getByRole("tab", { name: item.label })
                    expect(tab.getAttribute("aria-controls")).toBe(stablePanelId(item.id))
                    const panel = document.getElementById(tab.getAttribute("aria-controls")!)
                    expect(panel?.getAttribute("role")).toBe("tabpanel")
                    expect(panel?.textContent).toBe(`${item.label} body`)
                }
                expect(screen.getByRole("tab", { name: selectedLabel }).getAttribute("aria-selected")).toBe("true")
                expect(screen.getByRole("tabpanel", { name: selectedLabel })).not.toBeNull()
            })
        }
        await assertLinks("Overview")
        fireEvent.click(screen.getByRole("tab", { name: "Community" }))
        await assertLinks("Community")
        expect(onSelect).toHaveBeenCalledTimes(1)
        expect(onSelect).toHaveBeenLastCalledWith("community")
        const community = screen.getByRole("tab", { name: "Community" })
        community.focus()
        fireEvent.keyDown(community, { key: "ArrowLeft" })
        await assertLinks("Overview")
        expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Overview" }))
        expect(onSelect).toHaveBeenCalledTimes(2)
        unmount()
        expect(container.childElementCount).toBe(0)
    })

    it("updates external targets when the callback and item collection change", async () => {
        const first = [{ id: "overview", label: "Overview" }]
        const next = [...first, { id: "community", label: "Community" }]
        const { rerender } = render(<Tabs label="Targets" selectedKey="overview" items={first} panelId={(key) => `old-${key}`} />)
        await waitFor(() => expect(screen.getByRole("tab", { name: "Overview" }).getAttribute("aria-controls")).toBe("old-overview"))
        rerender(<Tabs label="Targets" selectedKey="community" items={next} panelId={(key) => `new-${key}`} />)
        await waitFor(() => {
            expect(screen.getByRole("tab", { name: "Overview" }).getAttribute("aria-controls")).toBe("new-overview")
            expect(screen.getByRole("tab", { name: "Community" }).getAttribute("aria-controls")).toBe("new-community")
            expect(screen.getByRole("tab", { name: "Community" }).getAttribute("aria-selected")).toBe("true")
        })
    })

    it("leaves vendor relationships alone without panelId", async () => {
        const { rerender } = render(<Tabs label="Default panels" selectedKey="overview" items={[{ id: "overview", label: "Overview" }]} />)
        const tab = await screen.findByRole("tab", { name: "Overview" })
        const generated = tab.getAttribute("aria-controls")
        expect(generated).toBeTruthy()
        rerender(<Tabs label="Default panels" selectedKey="overview" items={[{ id: "overview", label: "Overview" }]} />)
        expect(screen.getByRole("tab", { name: "Overview" }).getAttribute("aria-controls")).toBe(generated)
    })

    it("restores the observed default relationship when external panels are removed", async () => {
        const items = [{ id: "overview", label: "Overview" }]
        const { rerender } = render(<Tabs label="Optional panels" selectedKey="overview" items={items} />)
        const tab = await screen.findByRole("tab", { name: "Overview" })
        const original = tab.getAttribute("aria-controls")
        expect(original).toBeTruthy()
        rerender(<Tabs label="Optional panels" selectedKey="overview" items={items} panelId={(key) => `external-${key}`} />)
        await waitFor(() => expect(tab.getAttribute("aria-controls")).toBe("external-overview"))
        rerender(<Tabs label="Optional panels" selectedKey="overview" items={items} />)
        await waitFor(() => expect(tab.getAttribute("aria-controls")).toBe(original))
    })

    it("maps reordered and replaced collection entries by item identity", async () => {
        const panelId = (key: string) => `external-${key}`
        const { rerender } = render(<Tabs label="Changing collection" selectedKey="overview"
            items={[{ id: "overview", label: "Overview" }, { id: "community", label: "Community" }]} panelId={panelId} />)
        await waitFor(() => expect(screen.getByRole("tab", { name: "Overview" }).getAttribute("aria-controls")).toBe("external-overview"))
        rerender(<Tabs label="Changing collection" selectedKey="settings"
            items={[{ id: "community", label: "Community" }, { id: "settings", label: "Settings" }]} panelId={panelId} />)
        await waitFor(() => {
            expect(screen.queryByRole("tab", { name: "Overview" })).toBeNull()
            expect(screen.getByRole("tab", { name: "Community" }).getAttribute("aria-controls")).toBe("external-community")
            expect(screen.getByRole("tab", { name: "Settings" }).getAttribute("aria-controls")).toBe("external-settings")
            expect(screen.getByRole("tab", { name: "Settings" }).getAttribute("aria-selected")).toBe("true")
        })
    })

    it("isolates identical item keys across instances and stops synchronization after unmount", async () => {
        const items = [{ id: "overview", label: "Overview" }]
        const { container, unmount } = render(<>
            <div data-testid="first"><Tabs label="First" selectedKey="overview" items={items} panelId={(key) => `first-${key}`} /></div>
            <div data-testid="second"><Tabs label="Second" selectedKey="overview" items={items} panelId={(key) => `second-${key}`} /></div>
        </>)
        const first = await within(screen.getByTestId("first")).findByRole("tab", { name: "Overview" })
        const second = await within(screen.getByTestId("second")).findByRole("tab", { name: "Overview" })
        await waitFor(() => {
            expect(first.getAttribute("aria-controls")).toBe("first-overview")
            expect(second.getAttribute("aria-controls")).toBe("second-overview")
        })
        let mutations = 0
        const observer = new MutationObserver((records) => { mutations += records.length })
        observer.observe(container, { subtree: true, attributes: true, attributeFilter: ["aria-controls"] })
        // No idle observer feedback loop after the public relationship settles.
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
        expect(mutations).toBe(0)
        observer.disconnect()
        unmount()
        first.setAttribute("aria-controls", "detached-target")
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
        expect(first.getAttribute("aria-controls")).toBe("detached-target")
    })

})

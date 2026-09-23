// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { GRAMMAR_ROOT_CASES, expectInFamilyScope } from "../../../__test__/overlayRoots.js"
import { Button } from "../../primitive/Button/index.js"
import { DropdownMenu, type DropdownMenuEntry } from "./index.js"

afterEach(cleanup)

const openMenu = (name: string) => act(() => {
    fireEvent.click(screen.getByRole("button", { name }))
})

const commandEntries = (onRename: () => void): readonly DropdownMenuEntry[] => [
    { id: "rename", label: "Rename", shortcut: ["command", "R"], onAction: onRename },
    { id: "duplicate", label: "Duplicate", description: "Copy with all settings" },
    {
        id: "move",
        label: "Move to",
        submenu: [
            { id: "move-archive", label: "Archive" },
            { id: "move-drafts", label: "Drafts" },
        ],
    },
    {
        kind: "section",
        id: "danger",
        label: "Danger zone",
        items: [{ id: "delete", label: "Delete", tone: "negative" }],
    },
]

describe.each(GRAMMAR_ROOT_CASES)("Common DropdownMenu under $name", ({ Root, family }) => {
    it("opens a menu named by its trigger, with items, sections and shortcuts, inside the family scope", async () => {
        const onRename = vi.fn()
        const onAction = vi.fn()
        render(
            <Root>
                <DropdownMenu trigger={<Button>Actions</Button>} entries={commandEntries(onRename)} onAction={onAction} />
            </Root>,
        )
        const trigger = screen.getByRole("button", { name: "Actions" })
        openMenu("Actions")

        const menu = await screen.findByRole("menu", { name: "Actions" })
        expect(menu.getAttribute("data-component")).toBe("DropdownMenu")
        expect(menu.closest("[data-grammar-overlay-surface=\"menu\"]")).toBeTruthy()
        expectInFamilyScope(menu, family)
        expect(trigger.getAttribute("aria-expanded")).toBe("true")

        const items = within(menu).getAllByRole("menuitem")
        expect(items.map((item) => item.getAttribute("aria-label"))).toEqual(["Rename", "Duplicate", "Move to", "Delete"])
        expect(items[0]?.querySelector("[data-component=\"Kbd\"]")).toBeTruthy()
        expect(items[1]?.getAttribute("aria-describedby")).toBeTruthy()
        expect(items[2]?.getAttribute("aria-haspopup")).toBe("menu")
        expect(items[3]?.getAttribute("data-grammar-tone")).toBe("negative")
        expect(within(menu).getByRole("group", { name: "Danger zone" })).toBeTruthy()

        act(() => { fireEvent.click(items[0] as HTMLElement) })
        expect(onRename).toHaveBeenCalledTimes(1)
        expect(onAction).toHaveBeenCalledWith("rename")
        await waitFor(() => expect(screen.queryByRole("menu")).toBeNull())
    })

    it("opens submenus into the same family scope from the keyboard", async () => {
        const onAction = vi.fn()
        render(<Root><DropdownMenu trigger={<Button>Actions</Button>} entries={commandEntries(() => undefined)} onAction={onAction} /></Root>)
        openMenu("Actions")
        const menu = await screen.findByRole("menu", { name: "Actions" })
        const moveItem = within(menu).getByRole("menuitem", { name: "Move to" })

        act(() => { moveItem.focus() })
        act(() => { fireEvent.keyDown(moveItem, { key: "ArrowRight" }) })
        const submenu = await screen.findByRole("menu", { name: "Move to" })
        expect(submenu.getAttribute("data-grammar-menu-depth")).toBe("submenu")
        expectInFamilyScope(submenu, family)
        // Submenus mount into the root popover's own group container (the same aria-hidden boundary).
        expect(menu.closest("[data-grammar-overlay-surface=\"menu\"]")?.parentElement?.contains(submenu)).toBe(true)

        act(() => { fireEvent.click(within(submenu).getByRole("menuitem", { name: "Archive" })) })
        expect(onAction).toHaveBeenCalledWith("move-archive")
    })

    it("dismisses on Escape and returns focus to the trigger", async () => {
        render(<Root><DropdownMenu trigger={<Button>More</Button>} entries={[{ id: "a", label: "Alpha" }]} /></Root>)
        const trigger = screen.getByRole("button", { name: "More" })
        act(() => trigger.focus())
        openMenu("More")
        const menu = await screen.findByRole("menu", { name: "More" })

        act(() => { fireEvent.keyDown(menu, { key: "Escape" }) })
        await waitFor(() => expect(screen.queryByRole("menu")).toBeNull())
        await waitFor(() => expect(document.activeElement).toBe(trigger))
    })
})

describe("Common DropdownMenu checkable sections", () => {
    const Sorting = ({ onChange }: { readonly onChange: (ids: readonly string[]) => void }) => {
        const [selected, setSelected] = useState<readonly string[]>(["name"])
        const [columns, setColumns] = useState<readonly string[]>(["size"])
        return (
            <DropdownMenu
                trigger={<Button>View</Button>}
                entries={[
                    {
                        kind: "section",
                        id: "sort",
                        label: "Sort by",
                        selection: { mode: "single", selectedIds: selected, onChange: (ids) => { setSelected(ids); onChange(ids) } },
                        items: [{ id: "name", label: "Name" }, { id: "date", label: "Date" }],
                    },
                    {
                        kind: "section",
                        id: "columns",
                        label: "Columns",
                        selection: { mode: "multiple", selectedIds: columns, onChange: setColumns },
                        items: [{ id: "size", label: "Size" }, { id: "owner", label: "Owner" }],
                    },
                ]}
            />
        )
    }

    it("exposes radio and checkbox menu items with their checked state", async () => {
        const onChange = vi.fn()
        render(<Sorting onChange={onChange} />)
        openMenu("View")
        const menu = await screen.findByRole("menu", { name: "View" })

        const radios = within(menu).getAllByRole("menuitemradio")
        expect(radios.map((item) => item.getAttribute("aria-checked"))).toEqual(["true", "false"])
        const checks = within(menu).getAllByRole("menuitemcheckbox")
        expect(checks.map((item) => item.getAttribute("aria-checked"))).toEqual(["true", "false"])

        act(() => { fireEvent.click(radios[1] as HTMLElement) })
        expect(onChange).toHaveBeenCalledWith(["date"])
    })
})

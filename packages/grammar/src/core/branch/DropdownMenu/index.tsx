import { Description as HeroDescription, Dropdown as HeroDropdown, Header as HeroHeader } from "@heroui/react"
import type { ReactNode } from "react"
import { overlayOpenProps, useOverlayContainer, type OverlayOpenState } from "../../overlayScope.js"
import { Icon, type IconSource } from "../../primitive/Icon/index.js"
import { Kbd } from "../../primitive/Kbd/index.js"

export type DropdownMenuItemTone = "neutral" | "negative"

/** One command, destination or (inside a selectable section) checkable choice. */
export type DropdownMenuItem = {
    readonly kind?: "item"
    readonly id: string
    readonly label: string
    readonly description?: string
    /** Shortcut chord drawn with `Kbd`, e.g. `["command", "K"]`. Display only: the app binds the keys. */
    readonly shortcut?: readonly string[]
    readonly iconSource?: IconSource
    /** `negative` marks a destructive command. */
    readonly tone?: DropdownMenuItemTone
    readonly isDisabled?: boolean
    /** A destination: the item renders a real link. */
    readonly href?: string
    readonly onAction?: () => void
    /** Nested entries open as a submenu (ArrowRight / Enter / hover open it, ArrowLeft / Escape close it). */
    readonly submenu?: readonly DropdownMenuEntry[]
}

/** Checkable items: `single` draws a dot (radio semantics), `multiple` a check (checkbox semantics). */
export type DropdownMenuSelection = {
    readonly mode: "single" | "multiple"
    readonly selectedIds: readonly string[]
    readonly onChange: (selectedIds: readonly string[]) => void
}

export type DropdownMenuSection = {
    readonly kind: "section"
    readonly id: string
    /** Visible group heading; also the group's accessible name. */
    readonly label?: string
    readonly items: readonly DropdownMenuItem[]
    readonly selection?: DropdownMenuSelection
}

export type DropdownMenuEntry = DropdownMenuItem | DropdownMenuSection

export type DropdownMenuPlacement = "bottom start" | "bottom end" | "top start" | "top end"

export type DropdownMenuProps = OverlayOpenState & {
    /**
     * A Common `Button`/`IconButton` (any React Aria pressable) that opens the menu. It also NAMES the
     * menu (`aria-labelledby`, the WAI-ARIA menu-button pattern), so give an icon trigger its label.
     */
    readonly trigger: ReactNode
    readonly entries: readonly DropdownMenuEntry[]
    /** Called with the id of any activated item (after the item's own `onAction`). */
    readonly onAction?: (id: string) => void
    readonly placement?: DropdownMenuPlacement
}

const isSection = (entry: DropdownMenuEntry): entry is DropdownMenuSection => entry.kind === "section"

const collectItems = (entries: readonly DropdownMenuEntry[], into = new Map<string, DropdownMenuItem>()) => {
    for (const entry of entries) {
        if (isSection(entry)) collectItems(entry.items, into)
        else {
            into.set(entry.id, entry)
            if (entry.submenu !== undefined) collectItems(entry.submenu, into)
        }
    }
    return into
}

/**
 * BRANCH - `DropdownMenu`: a trigger-owned `role="menu"` of commands, links, checkable choices and
 * submenus.
 *
 * React Aria owns the keyboard model (arrow keys, Home/End, typeahead, Enter/Space, ArrowRight into
 * a submenu, Escape and outside press dismiss, focus returns to the trigger). The menu and every
 * submenu portal into the nearest Grammar root so the family scope still applies.
 * Contract: menu FOCUS-2 FOCUS-5; popover LAYOUT-4 CORE-BOUNDARY-4 MOTION-2; item FOCUS-1 CTA-2 (ring,
 * link vs command); a selectable section CONTROL-STATE-3 (app-owned selectedIds).
 */
export const DropdownMenu = ({
    trigger,
    entries,
    onAction,
    placement = "bottom start",
    ...openState
}: DropdownMenuProps) => {
    const { anchor, container } = useOverlayContainer("DropdownMenu")
    const items = collectItems(entries)
    const handleAction = (key: string | number) => {
        const id = String(key)
        items.get(id)?.onAction?.()
        onAction?.(id)
    }

    const renderItem = (item: DropdownMenuItem, selectionMode?: DropdownMenuSelection["mode"]): ReactNode => {
        const tone = item.tone ?? "neutral"
        const content = (
            <>
                {selectionMode === undefined ? null : (
                    <HeroDropdown.ItemIndicator type={selectionMode === "single" ? "dot" : "checkmark"} className="starci-core-menu-indicator" />
                )}
                {item.iconSource === undefined ? null : <Icon source={item.iconSource} usage="leading" />}
                <span className="starci-core-menu-item-copy">
                    <span className="starci-core-menu-item-label">{item.label}</span>
                    {item.description === undefined ? null : (
                        <HeroDescription className="starci-core-menu-item-description">{item.description}</HeroDescription>
                    )}
                </span>
                {item.shortcut === undefined ? null : (
                    <span className="starci-core-menu-item-shortcut" data-grammar-menu-shortcut="true"><Kbd keys={item.shortcut} /></span>
                )}
                {item.submenu === undefined ? null : <HeroDropdown.SubmenuIndicator className="starci-core-menu-submenu-indicator" />}
            </>
        )
        const itemElement = (
            <HeroDropdown.Item
                key={item.id}
                id={item.id}
                textValue={item.label}
                aria-label={item.label}
                variant={tone === "negative" ? "danger" : "default"}
                isDisabled={item.isDisabled ?? false}
                {...(item.href === undefined ? {} : { href: item.href })}
                data-grammar-menu-item="true"
                data-contract="FOCUS-1 CTA-2"
                data-grammar-tone={tone}
                className="starci-core-menu-item"
            >
                {content}
            </HeroDropdown.Item>
        )
        if (item.submenu === undefined) return itemElement
        return (
            <HeroDropdown.SubmenuTrigger key={item.id}>
                {itemElement}
                {/*
                  * No portal container here on purpose: React Aria mounts a submenu popover into the
                  * root menu popover's own group container, which is already inside the Grammar root.
                  * Portalling it to the root instead would put it outside that aria-hidden boundary.
                  */}
                <HeroDropdown.Popover
                    data-grammar-overlay-surface="menu"
                    data-contract="LAYOUT-4 CORE-BOUNDARY-4 MOTION-2"
                    className="starci-core-menu-popover"
                >
                    <HeroDropdown.Menu
                        aria-label={item.label}
                        onAction={handleAction}
                        data-component="DropdownMenu"
                        data-grammar-menu-depth="submenu"
                        data-contract="FOCUS-2 FOCUS-5"
                        className="starci-core-menu"
                    >
                        {renderEntries(item.submenu)}
                    </HeroDropdown.Menu>
                </HeroDropdown.Popover>
            </HeroDropdown.SubmenuTrigger>
        )
    }

    const renderEntries = (list: readonly DropdownMenuEntry[]): ReactNode[] => list.map((entry) => {
        if (!isSection(entry)) return renderItem(entry)
        const selection = entry.selection
        return (
            <HeroDropdown.Section
                key={entry.id}
                id={entry.id}
                {...(entry.label === undefined ? {} : { "aria-label": entry.label })}
                {...(selection === undefined ? {} : {
                    selectionMode: selection.mode,
                    selectedKeys: new Set(selection.selectedIds),
                    onSelectionChange: (keys: "all" | Set<string | number>) => {
                        selection.onChange(keys === "all" ? entry.items.map((item) => item.id) : Array.from(keys, String))
                    },
                })}
                data-grammar-menu-section="true"
                data-contract={selection === undefined ? undefined : "CONTROL-STATE-3"}
                className="starci-core-menu-section"
            >
                {entry.label === undefined ? null : <HeroHeader className="starci-core-menu-section-label">{entry.label}</HeroHeader>}
                {entry.items.map((item) => renderItem(item, selection?.mode))}
            </HeroDropdown.Section>
        )
    })

    return (
        <HeroDropdown {...overlayOpenProps(openState)}>
            {trigger}
            {anchor}
            {container === null ? null : (
                <HeroDropdown.Popover
                    UNSTABLE_portalContainer={container}
                    placement={placement}
                    data-grammar-overlay-surface="menu"
                    data-contract="LAYOUT-4 CORE-BOUNDARY-4 MOTION-2"
                    className="starci-core-menu-popover"
                >
                    <HeroDropdown.Menu
                        onAction={handleAction}
                        data-tier="branch"
                        data-component="DropdownMenu"
                        data-grammar-menu-depth="root"
                        data-contract="FOCUS-2 FOCUS-5"
                        className="starci-core-menu"
                    >
                        {renderEntries(entries)}
                    </HeroDropdown.Menu>
                </HeroDropdown.Popover>
            )}
        </HeroDropdown>
    )
}

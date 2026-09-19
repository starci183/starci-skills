"use client"

import { Header, ListBox } from "@heroui/react"
import type { Key, ReactNode } from "react"
import { Icon, type IconSource } from "../../primitive/Icon/index.js"
import { IconButton } from "../../primitive/IconButton/index.js"
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

export type SidebarItem = {
    readonly id: string
    readonly label: string
    readonly source?: IconSource
    readonly trailing?: ReactNode
    readonly isDisabled?: boolean
}

export type SidebarGroup = {
    readonly id: string
    readonly label?: string
    readonly items: ReadonlyArray<SidebarItem>
}

export type SidebarProps = {
    readonly label: string
    readonly groups: ReadonlyArray<SidebarGroup>
    readonly selectedKey?: string
    readonly presentation?: "rail" | "drawer"
    readonly isCollapsed?: boolean
    readonly collapseLabel?: string
    readonly expandLabel?: string
    readonly toggleSource?: IconSource
    readonly header?: ReactNode
    readonly footer?: ReactNode
    readonly onAction?: (id: string) => void
    readonly onCollapsedChange?: (collapsed: boolean) => void
}

/**
 * Sections and items share ONE key namespace inside the collection.
 *
 * A caller naturally writes `{ id: "home", items: [{ id: "home" }] }` - the group that holds the
 * home destination, named after it. That duplicate key made the collection unresolvable: every
 * section after the first was dropped from the render, and a re-render (collapsing the rail) sent
 * reconciliation into a loop that never settled, which under Vitest reads as a worker that never
 * reports. Prefixing the section key keeps the caller's vocabulary free: a group id and an item id
 * may be the same word, because only the item id is ever a real collection key.
 */
const sectionKey = (id: string) => `sidebar-section:${id}`

const firstKey = (keys: "all" | Set<Key>): string | undefined => {
    if (keys === "all") return undefined
    const value = keys.values().next().value
    return value === undefined ? undefined : String(value)
}

/**
 * Shared grouped sidebar renderer; apps own route, permission, copy and persistence policy.
 *
 * Geometry is owned by `.starci-core-sidebar*` in the packaged stylesheet, and the collapsed and
 * drawer projections are read from `data-collapsed` and `data-presentation` on this root. Nothing
 * here depends on a consumer's Tailwind build scanning the package.
 */
export const Sidebar = ({
    label,
    groups,
    selectedKey,
    presentation = "rail",
    isCollapsed = false,
    collapseLabel,
    expandLabel,
    toggleSource,
    header,
    footer,
    onAction,
    onCollapsedChange,
}: SidebarProps) => {
    const collapsed = presentation === "rail" && isCollapsed
    const toggleLabel = collapsed ? expandLabel : collapseLabel
    const canToggle = presentation === "rail" && toggleSource !== undefined && toggleLabel !== undefined && onCollapsedChange !== undefined

    return (
        <div
            data-tier="composition"
            data-component="Sidebar"
            data-presentation={presentation}
            data-collapsed={collapsed ? "true" : "false"}
            className={sidebarClassName}
            data-contract={["OVERFLOW-2", presentation === "drawer" ? "MEASURE-2" : "MEASURE-6"].join(" ")}
        >
            {canToggle ? (
                <div className={sidebarToggleClassName} data-contract="PADDING-2">
                    <IconButton
                        source={toggleSource}
                        label={toggleLabel}
                        isActive={collapsed}
                        onPress={() => onCollapsedChange(!collapsed)}
                    />
                </div>
            ) : null}
            {collapsed || header == null ? null : <div className={sidebarHeaderClassName} data-contract="PADDING-3">{header}</div>}
            <ListBox
                aria-label={label}
                selectionMode="single"
                selectedKeys={selectedKey === undefined ? [] : [selectedKey]}
                onSelectionChange={(keys) => {
                    const key = firstKey(keys as "all" | Set<Key>)
                    if (key !== undefined) onAction?.(key)
                }}
                className={sidebarListClassName}
                data-contract={collapsed ? "GAP-1 PADDING-2" : "GAP-1 PADDING-3"}
            >
                {groups.map((group) => (
                    <ListBox.Section
                        key={group.id}
                        id={sectionKey(group.id)}
                        className={sidebarSectionClassName}
                        data-contract="GAP-1"
                    >
                        {group.label === undefined ? null : (
                            <Header
                                className={sidebarSectionLabelClassName}
                                {...(collapsed ? {} : { "data-contract": "PADDING-2 PADDING-1 PADDING-3 FONT-1 TONE-2" })}
                            >
                                {group.label}
                            </Header>
                        )}
                        {group.items.map((item) => (
                            <ListBox.Item
                                key={item.id}
                                id={item.id}
                                textValue={item.label}
                                className={sidebarItemClassName}
                                data-contract={collapsed ? "TONE-1 SURFACE-4" : "GAP-3 PADDING-3 PADDING-2 TONE-1 SURFACE-4"}
                                {...(collapsed ? { "aria-label": item.label } : {})}
                                {...(item.isDisabled === undefined ? {} : { isDisabled: item.isDisabled })}
                            >
                                {item.source === undefined ? null : <Icon source={item.source} usage="leading" />}
                                {collapsed ? null : <span className={sidebarItemLabelClassName} data-contract="FLOW-4 FONT-2">{item.label}</span>}
                                {collapsed || item.trailing == null ? null : <span className={sidebarItemTrailingClassName}>{item.trailing}</span>}
                            </ListBox.Item>
                        ))}
                    </ListBox.Section>
                ))}
            </ListBox>
            {collapsed || footer == null ? null : <div className={sidebarFooterClassName} data-contract="PADDING-3 PADDING-0">{footer}</div>}
        </div>
    )
}

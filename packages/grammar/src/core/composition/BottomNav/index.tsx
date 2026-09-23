"use client"

import type { CSSProperties, ReactNode } from "react"
import { moveFocusBetweenPeers } from "../../navigationKeys.js"
import { navigationClassName } from "../../navigationClassNames.js"

export type BottomNavItem = {
    readonly id: string
    readonly label: string
    /** App-owned glyph; decorative, the label names the destination. */
    readonly icon: ReactNode
    /** A real destination. Without it the item is a same-document button driven by `onSelect`. */
    readonly href?: string
    /** Small count or dot; pass `badgeLabel` so it is announced. */
    readonly badge?: ReactNode
    readonly badgeLabel?: string
    readonly isDisabled?: boolean
}

export type BottomNavProps = {
    /** Names the landmark, e.g. "Primary". */
    readonly label: string
    readonly items: ReadonlyArray<BottomNavItem>
    readonly currentId: string
    readonly onSelect?: (id: string) => void
    /** `fixed` pins the bar to the viewport bottom above the device safe area. */
    readonly position?: "fixed" | "static"
    /** `compact` hides the bar from 48rem up, where a sidebar or top bar takes over. */
    readonly visibility?: "compact" | "always"
    readonly className?: string
}

/**
 * The mobile tab bar: 3-5 primary destinations with icon + label, a 44px minimum target, the
 * device safe-area inset, and `aria-current="page"` plus `data-grammar-current` on the current
 * destination. Left/Right/Home/End move between items; every item also stays in the Tab order.
 */
export const BottomNav = ({ label, items, currentId, onSelect, position = "fixed", visibility = "compact", className }: BottomNavProps) => (
    <nav
        aria-label={label}
        className={navigationClassName("starci-core-bottom-nav", className)}
        data-component="BottomNav"
        data-tier="composition"
        data-grammar-bottom-nav-position={position}
        data-grammar-bottom-nav-visibility={visibility}
        style={{ "--starci-core-bottom-nav-count": String(Math.max(1, items.length)) } as CSSProperties}
    >
        <ul className="starci-core-bottom-nav-list" onKeyDown={(event) => { moveFocusBetweenPeers(event, "[data-grammar-bottom-nav-item]", "horizontal") }}>
            {items.map((item) => {
                const isCurrent = item.id === currentId
                const shared = {
                    "aria-current": isCurrent ? ("page" as const) : undefined,
                    className: "starci-core-bottom-nav-item",
                    "data-grammar-bottom-nav-item": "true",
                    "data-grammar-current": isCurrent ? "true" : "false",
                }
                const content = <>
                    <span aria-hidden="true" className="starci-core-bottom-nav-icon">
                        {item.icon}
                        {item.badge === undefined ? null : <span className="starci-core-bottom-nav-badge" data-grammar-bottom-nav-badge="true">{item.badge}</span>}
                    </span>
                    <span className="starci-core-bottom-nav-label">{item.label}</span>
                    {item.badgeLabel === undefined ? null : <span className="starci-core-nav-visually-hidden">{`, ${item.badgeLabel}`}</span>}
                </>
                return (
                    <li key={item.id} className="starci-core-bottom-nav-slot">
                        {item.href !== undefined && item.isDisabled !== true ? (
                            <a {...shared} href={item.href} onClick={() => onSelect?.(item.id)}>{content}</a>
                        ) : (
                            <button {...shared} disabled={item.isDisabled === true} onClick={() => onSelect?.(item.id)} type="button">{content}</button>
                        )}
                    </li>
                )
            })}
        </ul>
    </nav>
)

"use client"

import { Breadcrumbs as HeroBreadcrumbs } from "@heroui/react"
import type { ReactNode } from "react"
import { navigationClassName } from "../../navigationClassNames.js"

export type BreadcrumbItem = {
    readonly id: string
    readonly label: string
    /** Ancestors carry a destination; the last item is the current page and needs none. */
    readonly href?: string
    readonly leading?: ReactNode
}

export type BreadcrumbsProps = {
    /** Names the trail landmark, e.g. "Breadcrumb". */
    readonly label: string
    readonly items: ReadonlyArray<BreadcrumbItem>
    /** Decorative separator; defaults to the vendor chevron. */
    readonly separator?: ReactNode
    /** Same-document navigation for router-owned trails. */
    readonly onAction?: (id: string) => void
    readonly className?: string
}

/**
 * The hierarchical trail to the current page.
 *
 * The last item is the current page (`aria-current="page"`, not a link). At narrow widths the trail
 * keeps one line and scrolls instead of wrapping, and long ancestor labels truncate.
 */
export const Breadcrumbs = ({ label, items, separator, onAction, className }: BreadcrumbsProps) => (
    <nav
        aria-label={label}
        className={navigationClassName("starci-core-breadcrumbs", className)}
        data-component="Breadcrumbs"
        data-tier="composite"
    >
        <HeroBreadcrumbs
            className="starci-core-breadcrumbs-list"
            {...(separator === undefined ? {} : { separator })}
            {...(onAction === undefined ? {} : { onAction: (key: string | number) => onAction(String(key)) })}
        >
            {items.map((item, index) => {
                const isCurrent = index === items.length - 1
                return (
                    <HeroBreadcrumbs.Item
                        key={item.id}
                        id={item.id}
                        className="starci-core-breadcrumb"
                        {...(item.href === undefined || isCurrent ? {} : { href: item.href })}
                    >
                        <span
                            className="starci-core-breadcrumb-label"
                            data-grammar-breadcrumb="true"
                            data-grammar-current={isCurrent ? "true" : "false"}
                        >
                            {item.leading === undefined ? null : <span aria-hidden="true" className="starci-core-breadcrumb-leading">{item.leading}</span>}
                            {item.label}
                        </span>
                    </HeroBreadcrumbs.Item>
                )
            })}
        </HeroBreadcrumbs>
    </nav>
)

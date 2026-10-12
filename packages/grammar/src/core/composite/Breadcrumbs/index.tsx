"use client"

import { Breadcrumbs as HeroBreadcrumbs } from "@heroui/react"
import type { ReactNode } from "react"
import { navigationClassName } from "../../navigationClassNames.js"
import { Skeleton } from "../../primitive/Skeleton/index.js"

export type BreadcrumbItem = {
    readonly id: string
    readonly label: string
    /** Ancestors carry a destination; the last item is the current page and needs none. */
    readonly href?: string
    readonly leading?: ReactNode
    /**
     * A data-driven crumb (usually the current page) whose label is not known yet (knowledge STATE-8): it draws a short
     * Skeleton text line in place of `label` and `leading`, `aria-hidden`, and carries no link. The other crumbs stay real.
     */
    readonly isSkeleton?: true
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
 * Contract: nav LAYOUT-3 OVERFLOW-3 (owns its inline scroll), item ACTION-3 (link vs current), leading ICON-6.
 */
export const Breadcrumbs = ({ label, items, separator, onAction, className }: BreadcrumbsProps) => (
    <nav
        aria-label={label}
        className={navigationClassName("starci-core-breadcrumbs", className)}
        data-component="Breadcrumbs"
        data-contract="LAYOUT-3 OVERFLOW-3"
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
                        data-contract="ACTION-3"
                        {...(item.href === undefined || isCurrent ? {} : { href: item.href })}
                    >
                        {item.isSkeleton === true ? (
                            // A function child skips the vendor's link: a nameless (aria-hidden) link is an axe aria-command-name violation.
                            () => (
                                <span className="starci-core-breadcrumb-label" data-grammar-breadcrumb="true" data-grammar-current={isCurrent ? "true" : "false"}>
                                    <span aria-hidden="true" className="starci-core-breadcrumb-skeleton" data-grammar-skeleton="true"><Skeleton shape="text" /></span>
                                </span>
                            )
                        ) : (
                            <span
                                className="starci-core-breadcrumb-label"
                                data-grammar-breadcrumb="true"
                                data-grammar-current={isCurrent ? "true" : "false"}
                            >
                                {item.leading === undefined ? null : <span aria-hidden="true" className="starci-core-breadcrumb-leading" data-contract="ICON-6">{item.leading}</span>}
                                {item.label}
                            </span>
                        )}
                    </HeroBreadcrumbs.Item>
                )
            })}
        </HeroBreadcrumbs>
    </nav>
)

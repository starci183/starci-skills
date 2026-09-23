"use client"

import { useId, type ReactNode } from "react"
import { Link, type LinkKind } from "../../primitive/Link/index.js"
import { navigationClassName } from "../../navigationClassNames.js"

export type FooterLink = {
    readonly id: string
    readonly label: string
    readonly href: string
    readonly kind?: LinkKind
    readonly isCurrent?: boolean
}

export type FooterLinkGroup = {
    readonly id: string
    readonly label: string
    readonly links: ReadonlyArray<FooterLink>
}

export type FooterProps = {
    /** Names the footer's link landmark, e.g. "Footer". Required when `groups` are present. */
    readonly label?: string
    /** App-owned identity and short statement. */
    readonly brand?: ReactNode
    readonly groups?: ReadonlyArray<FooterLinkGroup>
    /** Legal line, copyright, locale switcher: the closing row. */
    readonly legal?: ReactNode
    /** App-owned assistive hint for external links, e.g. that they open a new tab. */
    readonly externalHint?: string
    readonly children?: ReactNode
    readonly className?: string
}

/**
 * The page footer (`<footer>`, the contentinfo landmark at page level): brand, grouped link
 * directories that reflow from columns to one column at narrow widths, free content and a legal
 * row. Links are Common `Link`s, so the current page keeps `aria-current="page"`.
 */
export const Footer = ({ label, brand, groups = [], legal, externalHint, children, className }: FooterProps) => {
    const idPrefix = useId()
    return (
        <footer
            className={navigationClassName("starci-core-footer", className)}
            data-component="Footer"
            data-tier="composition"
        >
            {brand === undefined && groups.length === 0 && children === undefined ? null : (
                <div className="starci-core-footer-main">
                    {brand === undefined ? null : <div className="starci-core-footer-brand" data-grammar-footer-brand="true">{brand}</div>}
                    {groups.length === 0 ? null : (
                        <nav aria-label={label} className="starci-core-footer-directory" data-grammar-footer-directory="true">
                            {groups.map((group) => {
                                const headingId = `${idPrefix}-${group.id}`
                                return (
                                    <div key={group.id} className="starci-core-footer-group" data-grammar-footer-group="true">
                                        <p className="starci-core-footer-group-label" id={headingId}>{group.label}</p>
                                        <ul aria-labelledby={headingId} className="starci-core-footer-links">
                                            {group.links.map((link) => (
                                                <li key={link.id}>
                                                    <Link
                                                        href={link.href}
                                                        isCurrent={link.isCurrent === true}
                                                        kind={link.kind ?? "internal"}
                                                        visited="uniform"
                                                        {...(externalHint === undefined ? {} : { externalHint })}
                                                    >
                                                        {link.label}
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )
                            })}
                        </nav>
                    )}
                    {children}
                </div>
            )}
            {legal === undefined ? null : <div className="starci-core-footer-legal" data-grammar-footer-legal="true">{legal}</div>}
        </footer>
    )
}

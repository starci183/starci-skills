"use client"

import { Link as HeroLink } from "@heroui/react"
import type { ReactNode } from "react"
import { navigationClassName } from "../../navigationClassNames.js"

export type LinkKind = "internal" | "external"

export type LinkProps = {
    readonly children: ReactNode
    readonly href: string
    /** `external` leaves the app in a new browsing context with `noopener noreferrer`. */
    readonly kind?: LinkKind
    /** Marks the destination the reader is on now (`aria-current="page"`). */
    readonly isCurrent?: boolean
    /** Visited destinations keep a distinct tint unless the surrounding list must stay uniform. */
    readonly visited?: "distinct" | "uniform"
    /** App-owned assistive text appended to an external link, e.g. that it opens a new tab. */
    readonly externalHint?: string
    /** App-owned glyph after an external label; decorative only. */
    readonly externalIcon?: ReactNode
    readonly isDisabled?: boolean
    /** Runs alongside navigation. It cannot cancel the destination. */
    readonly onFollow?: () => void
    readonly className?: string
}

/**
 * An inline destination in running text or a link list.
 *
 * It is always a real anchor (middle-click, copy-link and the `link` role come from the platform).
 * `TextAction` owns action-shaped links; `Link` owns prose and directory links, including the
 * visited and current destination states that action chrome does not draw.
 */
export const Link = ({
    children,
    href,
    kind = "internal",
    isCurrent = false,
    visited = "distinct",
    externalHint,
    externalIcon,
    isDisabled = false,
    onFollow,
    className,
}: LinkProps) => {
    const external = kind === "external"
    return (
        <HeroLink
            aria-current={isCurrent ? "page" : undefined}
            className={navigationClassName("starci-core-link", className)}
            data-component="Link"
            data-tier="atom"
            data-grammar-link-kind={kind}
            data-grammar-link-visited={visited}
            data-grammar-current={isCurrent ? "true" : "false"}
            isDisabled={isDisabled}
            {...(isDisabled ? { "aria-disabled": true } : { href })}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            {...(onFollow === undefined ? {} : { onPress: () => onFollow() })}
        >
            {children}
            {external && externalIcon !== undefined ? <span aria-hidden="true" className="starci-core-link-external-icon" data-grammar-link-external-icon="true">{externalIcon}</span> : null}
            {external && externalHint !== undefined ? <span className="starci-core-nav-visually-hidden">{` ${externalHint}`}</span> : null}
        </HeroLink>
    )
}

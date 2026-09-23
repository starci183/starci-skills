"use client"

import { Disclosure as HeroDisclosure } from "@heroui/react"
import { useState, type ReactNode } from "react"
import { navigationClassName } from "../../navigationClassNames.js"

export type DisclosureProps = {
    /** The always-visible trigger text. */
    readonly title: ReactNode
    readonly children: ReactNode
    /** Controlled expansion. Omit for uncontrolled use with `defaultExpanded`. */
    readonly isExpanded?: boolean
    readonly defaultExpanded?: boolean
    readonly onExpandedChange?: (isExpanded: boolean) => void
    readonly isDisabled?: boolean
    /** Heading level of the trigger's heading element. */
    readonly headingLevel?: 2 | 3 | 4 | 5 | 6
    readonly className?: string
}

/**
 * One show/hide section (the generic, unframed disclosure; `SurfaceAccordionCard` is the framed
 * card form). The trigger is a real button inside a heading with `aria-expanded`/`aria-controls`;
 * `data-grammar-disclosure-state` mirrors the open state for the stylesheet.
 */
export const Disclosure = ({
    title,
    children,
    isExpanded,
    defaultExpanded = false,
    onExpandedChange,
    isDisabled = false,
    headingLevel = 3,
    className,
}: DisclosureProps) => {
    const [uncontrolled, setUncontrolled] = useState(defaultExpanded)
    const expanded = isExpanded ?? uncontrolled
    return (
        <HeroDisclosure
            className={navigationClassName("starci-core-disclosure", className)}
            data-component="Disclosure"
            data-tier="branch"
            data-grammar-disclosure-state={expanded ? "open" : "closed"}
            isDisabled={isDisabled}
            isExpanded={expanded}
            onExpandedChange={(next: boolean) => {
                if (isExpanded === undefined) setUncontrolled(next)
                onExpandedChange?.(next)
            }}
        >
            <HeroDisclosure.Heading className="starci-core-disclosure-heading" level={headingLevel}>
                <HeroDisclosure.Trigger className="starci-core-disclosure-trigger" data-grammar-disclosure-trigger="true">
                    <span className="starci-core-disclosure-title">{title}</span>
                    <HeroDisclosure.Indicator className="starci-core-disclosure-indicator" />
                </HeroDisclosure.Trigger>
            </HeroDisclosure.Heading>
            <HeroDisclosure.Content className="starci-core-disclosure-panel" data-grammar-disclosure-panel="true">
                <HeroDisclosure.Body className="starci-core-disclosure-body">{children}</HeroDisclosure.Body>
            </HeroDisclosure.Content>
        </HeroDisclosure>
    )
}

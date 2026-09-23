"use client"

import { Accordion as HeroAccordion, type Key } from "@heroui/react"
import { useState, type ReactNode } from "react"
import { moveFocusBetweenPeers } from "../../navigationKeys.js"
import { navigationClassName } from "../../navigationClassNames.js"

export type AccordionItem = {
    readonly id: string
    readonly title: ReactNode
    readonly content: ReactNode
    readonly isDisabled?: boolean
}

export type AccordionProps = {
    /** Names the group of sections for assistive technology. */
    readonly label: string
    readonly items: ReadonlyArray<AccordionItem>
    /** Controlled open sections. Omit for uncontrolled use with `defaultExpandedIds`. */
    readonly expandedIds?: ReadonlyArray<string>
    readonly defaultExpandedIds?: ReadonlyArray<string>
    readonly onExpandedChange?: (ids: ReadonlyArray<string>) => void
    /** Single-open (default) closes the previous section when another opens. */
    readonly allowsMultipleExpanded?: boolean
    readonly headingLevel?: 2 | 3 | 4 | 5 | 6
    readonly className?: string
}

/*
 * Consumer hooks: `starci-core-generic-accordion-root`, `starci-core-generic-accordion-panel`,
 * `starci-core-generic-accordion-body` name HeroUI parts whose vendor paint Common leaves as it is.
 * No shipped sheet paints them; the Grammar name lets a consumer or family select those parts
 * without reaching for vendor class names.
 */

/**
 * A generic, unframed stack of disclosures (FAQ, settings groups). `SurfaceAccordionCard` stays
 * the framed card form. Up/Down/Home/End move between section triggers; each section exposes
 * `data-grammar-disclosure-state`.
 * Contract: group FOCUS-2 (peer keys), item STATE-7 (controlled open set), trigger FOCUS-1, indicator MOTION-2.
 */
export const Accordion = ({
    label,
    items,
    expandedIds,
    defaultExpandedIds = [],
    onExpandedChange,
    allowsMultipleExpanded = false,
    headingLevel = 3,
    className,
}: AccordionProps) => {
    const [uncontrolled, setUncontrolled] = useState<ReadonlyArray<string>>(defaultExpandedIds)
    const expanded = expandedIds ?? uncontrolled
    const expandedSet = new Set(expanded)
    return (
        <div
            aria-label={label}
            className={navigationClassName("starci-core-generic-accordion", className)}
            data-component="Accordion"
            data-tier="branch"
            data-contract="FOCUS-2"
            onKeyDown={(event) => { moveFocusBetweenPeers(event, "[data-grammar-accordion-trigger]", "vertical") }}
            role="group"
        >
            <HeroAccordion
                allowsMultipleExpanded={allowsMultipleExpanded}
                className="starci-core-generic-accordion-root"
                expandedKeys={expandedSet}
                onExpandedChange={(keys: Set<Key>) => {
                    const next = [...keys].map(String)
                    if (expandedIds === undefined) setUncontrolled(next)
                    onExpandedChange?.(next)
                }}
            >
                {items.map((item) => (
                    <HeroAccordion.Item
                        key={item.id}
                        id={item.id}
                        className="starci-core-generic-accordion-item"
                        data-contract="STATE-7"
                        data-grammar-disclosure-state={expandedSet.has(item.id) ? "open" : "closed"}
                        {...(item.isDisabled === undefined ? {} : { isDisabled: item.isDisabled })}
                    >
                        <HeroAccordion.Heading className="starci-core-generic-accordion-heading" level={headingLevel}>
                            <HeroAccordion.Trigger className="starci-core-generic-accordion-trigger" data-contract="FOCUS-1" data-grammar-accordion-trigger="true">
                                <span className="starci-core-generic-accordion-title">{item.title}</span>
                                <HeroAccordion.Indicator className="starci-core-generic-accordion-indicator" data-contract="MOTION-2" />
                            </HeroAccordion.Trigger>
                        </HeroAccordion.Heading>
                        <HeroAccordion.Panel className="starci-core-generic-accordion-panel">
                            <HeroAccordion.Body className="starci-core-generic-accordion-body">{item.content}</HeroAccordion.Body>
                        </HeroAccordion.Panel>
                    </HeroAccordion.Item>
                ))}
            </HeroAccordion>
        </div>
    )
}

"use client"

import { Tabs as HeroTabs } from "@heroui/react"
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { HorizontalScrollRegion } from "../../composite/HorizontalScrollRegion/index.js"
import {
    tabContentClassName,
    tabLabelClassName,
    tabsClassName,
    tabsFrameClassName,
    tabsScrollClassName,
} from "./classNames.js"

/** One stable peer destination rendered by the Core tab object. */
export type TabItem = {
    readonly id: string
    readonly label: string
    readonly leading?: ReactNode
}

/**
 * Business-neutral controlled peer tabs with one declared overflow owner.
 *
 * The strip's scroll owner is `HorizontalScrollRegion`, and that region stamps its own
 * `data-contract`: a `data-contract` passed into it was silently replaced and never reached the DOM.
 * The strip asks for its answer with the region's `overflow` prop instead, so the id the node carries
 * is the id the node renders - one axis, scrolling only where the destinations overflow.
 */
export type TabsProps = {
    readonly label: string
    readonly selectedKey: string
    readonly items: ReadonlyArray<TabItem>
    readonly onSelect?: (key: string) => void
    readonly panelId?: (key: string) => string
    /** Keep stable labels visible when icon-only navigation would make peer views ambiguous. */
    readonly labelVisibility?: "responsive" | "always"
    /** Page chrome owns whether the peer strip starts at the shared page inset. */
    readonly inset?: "page" | "none"
}

/** Render peer tabs through Core's selected, accessible and responsive treatment. */
export const Tabs = (props: TabsProps) => {
    const [isClientReady, setIsClientReady] = useState(false)
    const frameRef = useRef<HTMLDivElement>(null)
    useEffect(() => setIsClientReady(true), [])
    useLayoutEffect(() => {
        const frame = frameRef.current
        const panelId = props.panelId
        if (!isClientReady || frame === null || panelId === undefined) return

        // HeroUI's collection may mount or update after this layout effect. Observe
        // only the owned relationship, preserving the actual vendor value for cleanup.
        const relationships = new Map<HTMLElement, { original: string | null; applied: string }>()
        const syncPanelIds = () => {
            frame.querySelectorAll<HTMLElement>("[data-grammar-tab-id]").forEach((identity) => {
                const itemId = identity.dataset.grammarTabId
                const tab = identity.closest<HTMLElement>("[role='tab']")
                if (itemId === undefined || tab === null) return
                const current = tab.getAttribute("aria-controls")
                const previous = relationships.get(tab)
                const expected = panelId(itemId)
                const original = previous !== undefined && current === previous.applied ? previous.original : current
                relationships.set(tab, { original, applied: expected })
                if (current !== expected) tab.setAttribute("aria-controls", expected)
            })
        }
        const observer = new MutationObserver(syncPanelIds)
        observer.observe(frame, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-controls", "data-grammar-tab-id"] })
        syncPanelIds()
        return () => {
            observer.disconnect()
            relationships.forEach(({ original, applied }, tab) => {
                if (tab.getAttribute("aria-controls") !== applied) return
                if (original === null) tab.removeAttribute("aria-controls")
                else tab.setAttribute("aria-controls", original)
            })
        }
    }, [isClientReady, props.items, props.panelId, props.selectedKey])

    const inset = props.inset ?? "none"
    const frameContract = inset === "page" ? "PADDING-5" : undefined
    if (!isClientReady) return <div aria-hidden="true" className={tabsFrameClassName} data-contract={frameContract} data-grammar-tabs="true" data-grammar-tabs-client="pending" data-grammar-tabs-inset={inset} style={{ minHeight: "3rem" }} />

    return <div ref={frameRef} className={tabsFrameClassName} data-contract={frameContract} data-grammar-tabs="true" data-grammar-tabs-client="ready" data-grammar-tabs-inset={inset} data-grammar-tab-labels={props.labelVisibility ?? "responsive"}>
        <HorizontalScrollRegion className={tabsScrollClassName} overflow="needed" data-grammar-tabs-overflow="scroll" hideScrollBar>
            <HeroTabs
                variant="secondary"
                selectedKey={props.selectedKey}
                onSelectionChange={(key) => props.onSelect?.(String(key))}
                className={tabsClassName ?? ""}
                data-contract="FLOW-2"
            >
                <HeroTabs.ListContainer>
                    <HeroTabs.List aria-label={props.label}>
                        {props.items.map((item) => (
                            <HeroTabs.Tab
                                key={item.id}
                                id={item.id}
                                aria-label={item.label}
                                data-contract="PADDING-3"
                            >
                                <span className={tabContentClassName} data-contract="GAP-2" data-grammar-tab-id={item.id}>
                                    {item.leading}
                                    <span className={tabLabelClassName} style={props.labelVisibility === "always" ? { display: "inline" } : undefined}>{item.label}</span>
                                </span>
                                <HeroTabs.Indicator />
                            </HeroTabs.Tab>
                        ))}
                    </HeroTabs.List>
                </HeroTabs.ListContainer>
            </HeroTabs>
        </HorizontalScrollRegion>
    </div>
}

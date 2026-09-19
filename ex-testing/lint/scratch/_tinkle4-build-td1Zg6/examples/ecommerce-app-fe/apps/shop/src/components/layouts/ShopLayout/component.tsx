"use client"

import type { ComponentType } from "react"
import { GrammarRoot, TextAction } from "@starci/grammar/common"
import { DisplayControls } from "@fe-kit/theme/leaves/DisplayControls"
import { shopLayoutClassNames } from "./classNames"

/** One resolved section link: the prefixed href, its label and the current-route marker. */
export type ShopNavLink = {
    readonly href: string
    readonly label: string
    readonly isCurrent: boolean
}

/** The shop chrome's resolved inputs: every string, href and the theme answer already settled. */
export type ShopLayoutProps = {
    /** Whole-screen situations this surface settles; the chrome has no alternatives. */
    readonly state: "ready"
    /** The data payload for whatever state is showing. */
    readonly props: {
        /** The resolved theme GrammarRoot should paint (`system` until the reader has chosen). */
        readonly theme: "light" | "dark" | "system"
        readonly brand: string
        readonly navLabel: string
        readonly homeHref: string
        readonly links: ReadonlyArray<ShopNavLink>
    }
    /** What the surface reports upward; the chrome is read-only. */
    readonly on: Record<never, never>
    /** The routed page body, carried as a component so the frame can place it. */
    readonly body: ComponentType
}

/**
 * The authenticated-app chrome: Grammar's Common boundary carrying the brand theme, the top bar
 * with the wordmark, the section nav (`isCurrent` is TextAction's real current-marker) and the
 * display controls, then the routed page body.
 */
export const ShopLayoutBase = (props: ShopLayoutProps) => {
    const Body = props.body
    return (
        <GrammarRoot theme={props.props.theme} className={shopLayoutClassNames.frame}>
            <header className={shopLayoutClassNames.header}>
                <div className={shopLayoutClassNames.bar}>
                    <a href={props.props.homeHref} className={shopLayoutClassNames.wordmark}>
                        {props.props.brand}
                    </a>
                    <span className={shopLayoutClassNames.controls}>
                        <nav className={shopLayoutClassNames.nav} aria-label={props.props.navLabel}>
                            {props.props.links.map((link) => (
                                <TextAction
                                    key={link.href}
                                    href={link.href}
                                    appearance="route"
                                    isCurrent={link.isCurrent}
                                >
                                    {link.label}
                                </TextAction>
                            ))}
                        </nav>
                        <DisplayControls />
                    </span>
                </div>
            </header>
            <main className={shopLayoutClassNames.main}>
                <Body />
            </main>
        </GrammarRoot>
    )
}

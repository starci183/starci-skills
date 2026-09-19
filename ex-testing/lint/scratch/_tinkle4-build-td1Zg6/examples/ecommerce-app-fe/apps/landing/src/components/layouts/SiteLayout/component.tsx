"use client"

import type { ComponentType } from "react"
import { Button, GrammarRoot, TextAction } from "@starci/grammar/common"
import { DisplayControls } from "@fe-kit/theme/leaves/DisplayControls"
import { siteLayoutClassNames } from "./classNames"

/** The site chrome's resolved inputs: every string, href and the theme answer already settled. */
export type SiteLayoutProps = {
    /** Whole-screen situations this surface settles; the chrome has no alternatives. */
    readonly state: "ready"
    /** The data payload for whatever state is showing. */
    readonly props: {
        /** The resolved theme GrammarRoot should paint (`system` until the reader has chosen). */
        readonly theme: "light" | "dark" | "system"
        readonly brand: string
        readonly navLabel: string
        readonly catalogue: string
        readonly about: string
        readonly enterShop: string
        readonly tagline: string
        readonly shopCta: string
        readonly homeHref: string
        readonly catalogueHref: string
        readonly aboutHref: string
        /** The shop origin with the locale already joined. */
        readonly shopHref: string
    }
    /** What the surface reports upward; the chrome is read-only. */
    readonly on: Record<never, never>
    /** The routed page body, carried as a component so the frame can place it. */
    readonly body: ComponentType
}

/**
 * The document chrome every landing route mounts under: Grammar's Common boundary carrying the
 * brand theme, the top bar with the wordmark and section links, the routed body, then the footer
 * that repeats the hand-off to the shop so it is reachable from the foot of any page.
 */
export const SiteLayoutBase = (props: SiteLayoutProps) => {
    const Body = props.body
    return (
        <GrammarRoot theme={props.props.theme} className={siteLayoutClassNames.frame}>
            <header className={siteLayoutClassNames.header}>
                <div className={siteLayoutClassNames.bar}>
                    <span className={siteLayoutClassNames.wordmark}>
                        <TextAction href={props.props.homeHref}>
                            {props.props.brand}
                        </TextAction>
                    </span>
                    <nav className={siteLayoutClassNames.nav} aria-label={props.props.navLabel}>
                        <TextAction href={props.props.catalogueHref} appearance="muted">
                            {props.props.catalogue}
                        </TextAction>
                        <TextAction href={props.props.aboutHref} appearance="muted">
                            {props.props.about}
                        </TextAction>
                        <DisplayControls />
                        <Button href={props.props.shopHref} variant="primary" size="sm">
                            {props.props.enterShop}
                        </Button>
                    </nav>
                </div>
            </header>
            <main className={siteLayoutClassNames.main}>
                <Body />
            </main>
            <footer className={siteLayoutClassNames.footer}>
                <div className={siteLayoutClassNames.bar}>
                    <span>{props.props.tagline}</span>
                    <TextAction href={props.props.shopHref} appearance="route">
                        {props.props.shopCta}
                    </TextAction>
                </div>
            </footer>
        </GrammarRoot>
    )
}

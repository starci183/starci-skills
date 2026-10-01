import type { ReactNode } from "react"
import { Button, Footer, Text, TextAction } from "@starci/grammar/common"
import { DisplayControls, SiteShell } from "@ecommerce/ui"
import { siteLayoutClassNames } from "./classNames"

/** The site chrome's resolved inputs: every string and href already settled. */
export type SiteLayoutBaseProps = {
    /** Whole-screen situations this surface settles; the chrome has no alternatives. */
    readonly state: "ready"
    /** The data payload for whatever state is showing. */
    readonly props: {
        readonly brand: string
        /** The display controls' words, resolved here because the leaf that draws them resolves none. */
        readonly display: {
            readonly label: string
            readonly locale: string
            readonly toLight: string
            readonly toDark: string
            readonly localeNames: { readonly en: string; readonly vi: string }
        }
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
    /** The routed page body supplied by the router to this layout. */
    readonly children: ReactNode
}

/**
 * The document chrome every landing route mounts under: the shared shell carrying the wordmark and section
 * links, the routed body, then the footer that repeats the hand-off to the shop so it is reachable from
 * the foot of any page.
 */
export const SiteLayoutBase = (props: SiteLayoutBaseProps) => (
    <SiteShell
        brand={props.props.brand}
        homeHref={props.props.homeHref}
        navigation={
            <div role="navigation" aria-label={props.props.navLabel} className={siteLayoutClassNames.nav}>
                <TextAction href={props.props.catalogueHref} appearance="muted">
                    {props.props.catalogue}
                </TextAction>
                <TextAction href={props.props.aboutHref} appearance="muted">
                    {props.props.about}
                </TextAction>
            </div>
        }
        actions={
            <div className={siteLayoutClassNames.actions}>
                <DisplayControls {...props.props.display} />
                <Button href={props.props.shopHref} variant="primary" size="sm">
                    {props.props.enterShop}
                </Button>
            </div>
        }
        footer={
            <Footer
                brand={<Text as="span">{props.props.tagline}</Text>}
                legal={
                    <TextAction href={props.props.shopHref} appearance="route">
                        {props.props.shopCta}
                    </TextAction>
                }
            />
        }
    >
        {props.children}
    </SiteShell>
)

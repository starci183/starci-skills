import type { ReactNode } from "react"
import { DisplayControls, SiteShell } from "@ecommerce/ui"
import { ShopNav } from "../../../components/blocks/ShopNav"

/** The shop chrome's resolved inputs: the brand, its home link and the display controls' words already settled. */
export type ShopLayoutBaseProps = {
    /** Whole-screen situations this surface settles; the chrome has no alternatives. */
    readonly state: "ready"
    /** The data payload for whatever state is showing. */
    readonly props: {
        readonly brand: string
        readonly homeHref: string
        /** The display controls' words, resolved here because the leaf that draws them resolves none. */
        readonly display: {
            readonly label: string
            readonly locale: string
            readonly toLight: string
            readonly toDark: string
            readonly localeNames: { readonly en: string; readonly vi: string }
        }
    }
    /** What the surface reports upward; the chrome is read-only. */
    readonly on: Record<never, never>
    /** The routed page body supplied by the router to this layout. */
    readonly children: ReactNode
}

/**
 * The authenticated-app chrome: the shared shell carrying the wordmark, the section nav and the display
 * controls, then the routed page body in the shell's main landmark.
 */
export const ShopLayoutBase = (props: ShopLayoutBaseProps) => (
    <SiteShell
        brand={props.props.brand}
        homeHref={props.props.homeHref}
        navigation={<ShopNav />}
        actions={<DisplayControls {...props.props.display} />}
    >
        {props.children}
    </SiteShell>
)

/** Props for {@link ShopRootPageBase}. */
export type ShopRootPageBaseProps = {
    /** Whole-screen situations this surface settles; the root only ever redirects. */
    readonly state: "redirecting"
    /** The data payload for whatever state is showing; a redirect shows nothing. */
    readonly props: Record<never, never>
    /** What the surface reports upward; a redirect reports nothing. */
    readonly on: Record<never, never>
}

/**
 * Draw nothing: the `[lang]` root owns no UI. The connected half issues the redirect before this
 * twin ever paints; the twin exists so the page's one situation is a thing a reader can name.
 */
export const ShopRootPageBase = (props: ShopRootPageBaseProps) => {
    void props
    return null
}

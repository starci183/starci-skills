/** Props for {@link ShopRootRedirectBase}. */
export type ShopRootRedirectBaseProps = {
    /** Whole-screen situations this surface settles; the root only ever redirects. */
    readonly state: "redirecting"
    /** The data payload for whatever state is showing; a redirect shows nothing. */
    readonly props: Record<never, never>
    /** What the surface reports upward; a redirect reports nothing. */
    readonly on: Record<never, never>
}

/** Draw nothing: the connected half issues the redirect before this twin ever paints. */
export const ShopRootRedirectBase = (props: ShopRootRedirectBaseProps) => {
    void props
    return null
}

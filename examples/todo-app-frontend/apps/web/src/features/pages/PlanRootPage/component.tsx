/** Props for {@link PlanRootPageBase}. */
export type PlanRootPageProps = {
    /** Whole-screen situations this surface settles; the plan index only ever redirects. */
    readonly state: "redirecting"
    /** The data payload for whatever state is showing; a redirect shows nothing. */
    readonly props: Record<never, never>
    /** What the surface reports upward; a redirect reports nothing. */
    readonly on: Record<never, never>
}

/**
 * Draw nothing: the plan index owns no UI. The connected half issues the redirect to the usage
 * screen before this twin ever paints.
 */
export const PlanRootPageBase = (props: PlanRootPageProps) => {
    void props
    return null
}

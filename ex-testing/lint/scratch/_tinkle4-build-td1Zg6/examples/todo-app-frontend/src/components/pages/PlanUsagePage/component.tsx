import { PlanUsageScreen } from "@/components/plan/usage-screen"

/** Props for {@link PlanUsagePageBase}. */
export type PlanUsagePageProps = {
    /** Whole-screen situations this surface settles; the screen owns its own usage read. */
    readonly state: "ready"
    /** The data payload for whatever state is showing; the screen wants nothing from the route. */
    readonly props: Record<never, never>
    /** What the surface reports upward; the screen reports nothing. */
    readonly on: Record<never, never>
}

/** Draw the plan usage screen; the screen owns the usage read and the upgrade write. */
export const PlanUsagePageBase = (props: PlanUsagePageProps) => {
    void props
    return <PlanUsageScreen {...{}} />
}

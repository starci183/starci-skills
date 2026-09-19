import { PlanUsagePageBase } from "./component"

/** The public props of the plan usage route: the route hands it nothing. */
export type PlanUsagePageProps = Record<never, never>

/**
 * The plan usage route's connected half; the usage screen owns its own session gate, so the
 * page's whole situation space is "ready".
 */
export const PlanUsagePage = (props: PlanUsagePageProps) => {
    void props
    return <PlanUsagePageBase state="ready" props={{}} on={{}} />
}

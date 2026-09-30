import { PlanUsagePageBase } from "./component"

/**
 * The plan usage route's connected half; the usage screen owns its own session gate, so the
 * page's whole situation space is "ready".
 */
export const PlanUsagePage = () => {
    return <PlanUsagePageBase state="ready" props={{}} on={{}} />
}

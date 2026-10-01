import useSWR from "swr"
import useSWRMutation from "swr/mutation"
import { useSessionToken } from "@/hooks/auth"
import { readPlanUsage, startPlanCheckout } from "@/modules/plan"

/**
 * ui.plan.usage's world state: the planUsage query and the upgradePlan mutation. Both keys carry the
 * viewer's own token so one signed-in person never reads another person's cached rows, and both resolve
 * to `null` - disabling the request - the moment there is no session to read with. `signedIn` says
 * whether that session exists.
 */
export const usePlanUsage = () => {
    const token = useSessionToken()
    const usageQuery = useSWR(token ? (["plan-usage", token] as const) : null, ([, activeToken]) =>
        readPlanUsage(activeToken),
    )
    const upgrade = useSWRMutation(token ? (["plan-upgrade", token] as const) : null, ([, activeToken]) =>
        startPlanCheckout(activeToken),
    )
    return { signedIn: Boolean(token), usageQuery, upgrade }
}

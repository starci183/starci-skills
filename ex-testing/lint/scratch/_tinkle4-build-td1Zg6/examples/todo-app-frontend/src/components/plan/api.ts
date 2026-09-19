import { graphql, type Result } from "@/modules/api/graphql"

/**
 * The plan feature's GraphQL surface (fr.plan.usage.view, fr.plan.upgrade), reached through the app's
 * one existing fetcher in modules/api/graphql.ts. It lives beside its consumers because this lane's
 * write ceiling covers only src/app/plan and src/components/plan; modules/api stays untouched.
 */

/** The one shape plan usage takes on the wire (fr.plan.usage.view). */
export interface PlanUsage {
  readonly plan: string;
  readonly cap: number | null;
  readonly activeCount: number;
}

/** The one shape a started checkout takes on the wire (fr.plan.upgrade). */
export interface PlanCheckout {
  readonly subscriptionId: string;
  readonly paymentIntentId: string;
  readonly checkoutUrl: string;
  readonly status: string;
}

/** Mirrors modules/api/tasks.ts: every failed GraphQL Result becomes a thrown Error at this one seam,
 * so a useSWR/useSWRMutation caller sees the rejection it already expects. */
const unwrap = <T>(result: Result<T>): T => {
    if (!result.ok) {
        throw new Error(result.reason, result.code ? { cause: new Error(result.code) } : undefined)
    }
    return result.data
}

const PLAN_USAGE_DOCUMENT = "query { planUsage { plan cap activeCount } }"

/** Reads the viewer's effective plan and active-task count; a missing or expired token surfaces as a
 * transport refusal. */
export const readPlanUsage = async (token: string): Promise<PlanUsage> => {
    return unwrap(await graphql<PlanUsage>(PLAN_USAGE_DOCUMENT, undefined, token))
}

const UPGRADE_PLAN_DOCUMENT = "mutation { upgradePlan { subscriptionId paymentIntentId checkoutUrl status } }"

/** Starts checkout for the paid plan (fr.plan.upgrade) and returns the gateway URL to follow. The
 * response is never a paid state: the subscription turns active only once the gateway's webhook
 * confirms the intent (sds.plan.subscription-lifecycle), so no caller may render paid from this. */
export const startPlanCheckout = async (token: string): Promise<PlanCheckout> => {
    return unwrap(await graphql<PlanCheckout>(UPGRADE_PLAN_DOCUMENT, undefined, token))
}

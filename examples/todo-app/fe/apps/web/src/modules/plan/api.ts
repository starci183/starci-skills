import { isRecord, parseOutcome, request, unwrap } from "@/modules/api"

/**
 * The plan feature's GraphQL surface (fr.plan.usage.view, fr.plan.upgrade), reached through the app's
 * one transport client.
 */

/** The one shape plan usage takes on the wire (fr.plan.usage.view). */
interface PlanUsage {
    readonly plan: string
    readonly cap: number | null
    readonly activeCount: number
}

/** The one shape a started checkout takes on the wire (fr.plan.upgrade). */
interface PlanCheckout {
    readonly subscriptionId: string
    readonly paymentIntentId: string
    readonly checkoutUrl: string
    readonly status: string
}

/** The plan usage of a payload, or `null` when the payload is not that shape. */
const toPlanUsage = (data: unknown): PlanUsage | null =>
    isRecord(data) && typeof data.plan === "string" && typeof data.activeCount === "number"
        ? { plan: data.plan, cap: typeof data.cap === "number" ? data.cap : null, activeCount: data.activeCount }
        : null

/** The started checkout of a payload, or `null` when the payload is not that shape. */
const toPlanCheckout = (data: unknown): PlanCheckout | null =>
    isRecord(data) &&
    typeof data.subscriptionId === "string" &&
    typeof data.paymentIntentId === "string" &&
    typeof data.checkoutUrl === "string" &&
    typeof data.status === "string"
        ? {
              subscriptionId: data.subscriptionId,
              paymentIntentId: data.paymentIntentId,
              checkoutUrl: data.checkoutUrl,
              status: data.status,
          }
        : null

/**
 * Reads the viewer's effective plan and active-task count; a missing or expired token surfaces as a
 * thrown refusal.
 */
export const readPlanUsage = async (token: string): Promise<PlanUsage> =>
    unwrap(parseOutcome(await request({ operation: "PlanUsage", token }), toPlanUsage))

/**
 * Starts checkout for the paid plan (fr.plan.upgrade) and returns the gateway URL to follow. The
 * response is never a paid state: the subscription turns active only once the gateway's webhook
 * confirms the intent (sds.plan.subscription-lifecycle), so no caller may render paid from this.
 */
export const startPlanCheckout = async (token: string): Promise<PlanCheckout> =>
    unwrap(parseOutcome(await request({ operation: "UpgradePlan", token }), toPlanCheckout))

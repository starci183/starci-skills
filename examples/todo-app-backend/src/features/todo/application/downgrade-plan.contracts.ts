/** Downgrading the plan of the caller takes no input. */
export type DowngradePlanRequest = Readonly<Record<string, never>>

/** The subscription after the downgrade. */
export interface DowngradePlanResult {
    /** The subscription of the caller. */
    readonly subscriptionId: string
    /** The plan the subscription holds afterwards. */
    readonly plan: string
    /** The subscription status afterwards. */
    readonly status: string
}

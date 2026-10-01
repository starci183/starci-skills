/** Reading the plan usage of the caller takes no input. */
export type PlanUsageRequest = Readonly<Record<string, never>>

/** The plan of the caller against the active tasks the caller holds. */
export interface PlanUsageResult {
    /** The effective plan: free or paid. */
    readonly plan: string
    /** How many active tasks the plan allows, null on the paid plan. */
    readonly cap: number | null
    /** How many active tasks the caller holds now. */
    readonly activeCount: number
}

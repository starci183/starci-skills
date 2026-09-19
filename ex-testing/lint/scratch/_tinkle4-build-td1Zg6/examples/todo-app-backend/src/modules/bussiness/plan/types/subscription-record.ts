/** sds.plan.subscription-lifecycle's five states. Lapsed is not terminal in storage: see t-revert-on-read. */
export type SubscriptionStatus = "free" | "pending" | "active" | "past-due" | "lapsed";

/** data.plan.subscription: personId is bound at creation and never rewritten; status is authored by
 * sds.plan.subscription-lifecycle's transitions only. */
export class SubscriptionRecord {
    constructor(
    readonly id: string,
    readonly personId: string,
    public plan: string,
    public status: SubscriptionStatus,
    public periodEnd: Date | null,
    public gatewayCustomerId: string | null,
    ) {}
}

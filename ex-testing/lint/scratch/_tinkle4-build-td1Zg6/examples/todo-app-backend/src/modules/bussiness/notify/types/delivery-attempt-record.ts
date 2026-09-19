/** Type alias naming the delivery state set delivery-attempt-record switches on; a new member is added here once, not scattered as literals. */
export type DeliveryState = "queued" | "sending" | "delivered" | "bounced" | "suppressed";
/** Type alias naming the failure class set delivery-attempt-record switches on; a new member is added here once, not scattered as literals. */
export type FailureClass = "transient" | "permanent-bounce" | "retries-exhausted" | "unsubscribed";

/** Contract naming the delivery history entry shape bussiness/notify/types code and its consumers share; a second site never retypes it inline. */
export interface DeliveryHistoryEntry {
  readonly state: DeliveryState;
  readonly at: string;
  readonly failureClass?: FailureClass;
}

/** data.notify.delivery-attempt, read out of NotifyDeliveryAttemptEntity. */
export class DeliveryAttemptRecord {
    constructor(
    readonly notificationId: string,
    public state: DeliveryState,
    public attempt: number,
    public failureClass: FailureClass | null,
    public startedAt: Date | null,
    public endedAt: Date | null,
    public history: Array<DeliveryHistoryEntry>,
    ) {}
}

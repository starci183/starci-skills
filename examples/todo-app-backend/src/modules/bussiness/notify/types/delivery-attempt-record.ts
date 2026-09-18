export type DeliveryState = 'queued' | 'sending' | 'delivered' | 'bounced' | 'suppressed';
export type FailureClass = 'transient' | 'permanent-bounce' | 'retries-exhausted' | 'unsubscribed';

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
    public history: DeliveryHistoryEntry[],
  ) {}
}

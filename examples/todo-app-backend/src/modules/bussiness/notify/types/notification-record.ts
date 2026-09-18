/** data.notify.notification, read out of NotifyNotificationEntity. */
export class NotificationRecord {
  constructor(
    readonly id: string,
    readonly kind: string,
    readonly recipientId: string,
    readonly payload: Record<string, unknown>,
    public digestGroupId: string | null,
    readonly createdAt: Date,
  ) {}
}

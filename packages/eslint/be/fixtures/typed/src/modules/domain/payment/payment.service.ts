/** Fixture: a domain service with an intake method and a second method (a webhook calls exactly one). */
export class PaymentService {
    async acceptNotification(_notification: object): Promise<void> {}

    /** Fixture: verifies the connection's provider secret and records the notification in the same intake. */
    async acceptVerifiedNotification(_notification: object): Promise<void> {}

    async refund(_id: string): Promise<void> {}
}

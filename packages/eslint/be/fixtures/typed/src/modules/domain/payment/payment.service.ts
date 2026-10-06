/** Fixture: a domain service with an intake method and a second method (a webhook calls exactly one). */
export class PaymentService {
    async acceptNotification(_notification: object): Promise<void> { /* the fixture needs the shape, not a body */ }
    async refund(_id: string): Promise<void> { /* the fixture needs the shape, not a body */ }
}

/** Fixture: stub so the door fixture resolves; inbox-key cases override this file's content. */
export class DeliveryService {
    async receive(_delivery: never): Promise<void> {}
}

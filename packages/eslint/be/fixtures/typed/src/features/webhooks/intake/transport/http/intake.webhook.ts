import { DeliveryService } from "@modules/domain/intake/delivery.service"

/** Fixture: a webhook door whose one domain intake call is DeliveryService.receive (reaches the inbox-key rule). */
export class IntakeWebhook {
    constructor(private readonly deliveries: DeliveryService) {}

    async handle(body: never): Promise<void> {
        await this.deliveries.receive(body)
    }
}

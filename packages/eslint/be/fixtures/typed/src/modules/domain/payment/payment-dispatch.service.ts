/** Fixture: inspect only the domain intake implementation actually called by the webhook door. */
import { CommandBus as DispatchBus, QueryBus } from "@nestjs/cqrs"

export class PaymentDispatchService {
    constructor(private readonly commands: DispatchBus, private readonly queries: QueryBus) {}

    async recordDelivery(_notification: object): Promise<void> {}

    async dispatchNotification(notification: object): Promise<void> {
        await this.commands.execute(notification)
    }

    async dispatchAliasedNotification(notification: object): Promise<void> {
        const receiver = this.commands
        await receiver.execute(notification)
    }

    async dispatchQueryNotification(notification: object): Promise<void> {
        await this.queries.execute(notification)
    }

    async dispatchComputedNotification(notification: object): Promise<void> {
        await this.commands["execute"](notification)
    }

    dispatchOverloadedNotification(notification: object): Promise<void>
    async dispatchOverloadedNotification(notification: object): Promise<void> {
        await this.commands.execute(notification)
    }

    dispatchArrowNotification = async (notification: object): Promise<void> => {
        await this.commands.execute(notification)
    }

    async dispatchCallbackNotification(notification: object): Promise<void> {
        await Promise.resolve().then(() => this.commands.execute(notification))
    }
}

/** The called body belongs to the inherited implementation, not to this empty subclass. */
export class InheritedPaymentDispatchService extends PaymentDispatchService {}

/** A renamed type cannot conceal inheritance from the CQRS bus. */
export class ProviderDispatchBus extends DispatchBus {}

export type ProviderQueryBus = import("@nestjs/cqrs").QueryBus

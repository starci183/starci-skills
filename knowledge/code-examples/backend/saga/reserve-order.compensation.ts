// Imports of the host (resolve them to its aliases): ../../application/cancel-order.command, @modules/platform/cqrs, @nestjs/common, @nestjs/cqrs.
@Injectable()
/** The compensation of the reserve-order step: cancels the order and releases the stock of its lines. */
export class ReserveOrderCompensation {
    /** The step this compensation undoes. */
    readonly step = "reserve-order"

    /** The event that tells the saga to run this compensation (the contract `be/contracts/billing/events.json`, which says it compensates `order.placed`). */
    readonly event = "billing.invoice-rejected"

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Dispatches the one command of the compensation. */
    async run(orderId: string): Promise<void> {
        await this.commandBus.execute(new CancelOrderCommand({ request: { orderId } }))
    }
}

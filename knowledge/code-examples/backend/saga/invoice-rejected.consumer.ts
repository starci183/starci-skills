// Imports of the host (resolve them to its aliases): ../../application/compensate-place-order.command, @modules/domain/order, @modules/integrations/messaging, @modules/platform/cqrs, @nestjs/common, @nestjs/cqrs.
@Injectable()
/** Consumer of `billing.invoice-rejected`, the failure event of the place-order saga: hands each delivery to the compensate command. */
export class InvoiceRejectedConsumer implements MessageConsumer<RejectedInvoiceNotice> {
    readonly queue = REJECTED_INVOICE_QUEUE

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Dispatches one compensate command; the saga takes the delivery through the inbox, so a redelivery is a no-op. */
    async handle(message: ConsumedMessage<RejectedInvoiceNotice>): Promise<void> {
        await this.commandBus.execute(
            new CompensatePlaceOrderCommand({
                request: { orderId: message.payload.orderId, eventId: message.eventId },
            }),
        )
    }
}

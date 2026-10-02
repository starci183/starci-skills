import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectEventConsumerRegistry } from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { PlaceOrderModule } from "../../place-order.module"
import { InvoiceIssuedConsumer } from "./billing-invoice-issued.consumer"
import { InvoiceRejectedConsumer } from "./billing-invoice-rejected.consumer"

@Module({ imports: [PlaceOrderModule], providers: [InvoiceIssuedConsumer, InvoiceRejectedConsumer] })
/** The message transport of the place-order saga: registers its consumers with the messaging capability. */
export class PlaceOrderMessageModule implements OnModuleInit {
    constructor(
        @InjectEventConsumerRegistry() private readonly registry: EventConsumerRegistry,
        private readonly invoiceIssuedConsumer: InvoiceIssuedConsumer,
        private readonly invoiceRejectedConsumer: InvoiceRejectedConsumer,
    ) {}

    /** Hands every consumer to the registry. */
    onModuleInit(): void {
        this.registry.add(this.invoiceIssuedConsumer)
        this.registry.add(this.invoiceRejectedConsumer)
    }
}

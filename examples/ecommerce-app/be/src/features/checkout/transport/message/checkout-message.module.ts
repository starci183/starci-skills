import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectEventConsumerRegistry } from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { CheckoutModule } from "../../checkout.module"
import { InvoiceIssuedConsumer } from "./invoice-issued.consumer"
import { InvoiceRejectedConsumer } from "./invoice-rejected.consumer"

@Module({ imports: [CheckoutModule], providers: [InvoiceIssuedConsumer, InvoiceRejectedConsumer] })
/** The message transport of the checkout feature: registers its consumers with the messaging capability. */
export class CheckoutMessageModule implements OnModuleInit {
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

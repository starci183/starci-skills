import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectEventConsumerRegistry } from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { InvoicingModule } from "../../invoicing.module"
import { OrderPlacedConsumer } from "./order-placed.consumer"

@Module({ imports: [InvoicingModule], providers: [OrderPlacedConsumer] })
/** The message transport of the invoicing feature: registers its consumers with the messaging capability; only a worker composes it. */
export class InvoicingMessageModule implements OnModuleInit {
    constructor(
        @InjectEventConsumerRegistry() private readonly registry: EventConsumerRegistry,
        private readonly orderPlacedConsumer: OrderPlacedConsumer,
    ) {}

    /** Hands every consumer to the registry. */
    onModuleInit(): void {
        this.registry.add(this.orderPlacedConsumer)
    }
}

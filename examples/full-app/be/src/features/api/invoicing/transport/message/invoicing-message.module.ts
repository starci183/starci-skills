import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectEventConsumerRegistry } from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { InvoicingModule } from "../../invoicing.module"
import { ConfigurableModuleClass } from "./invoicing-message.module-definition"
import { OrderPlacedConsumer } from "./order-placed.consumer"

@Module({ imports: [InvoicingModule.register({})], providers: [OrderPlacedConsumer] })
/** The message transport of the invoicing feature: registers its consumers with the messaging capability; only a worker composes it. */
export class InvoicingMessageModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectEventConsumerRegistry() private readonly registry: EventConsumerRegistry,
        private readonly orderPlacedConsumer: OrderPlacedConsumer,
    ) {
        super()
    }

    /** Hands every consumer to the registry. */
    onModuleInit(): void {
        this.registry.add(this.orderPlacedConsumer)
    }
}

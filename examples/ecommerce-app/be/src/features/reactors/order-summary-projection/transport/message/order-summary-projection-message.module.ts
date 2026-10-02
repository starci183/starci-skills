import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectEventConsumerRegistry } from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { OrderSummaryProjectionModule } from "../../order-summary-projection.module"
import { OrderPlacedConsumer } from "./order-placed.consumer"
import { OrderPaidConsumer } from "./order-paid.consumer"
import { OrderExpiredConsumer } from "./order-expired.consumer"

@Module({
    imports: [OrderSummaryProjectionModule],
    providers: [OrderPlacedConsumer, OrderPaidConsumer, OrderExpiredConsumer],
})
/** The message transport of the order-summary-projection reactor: registers its consumers with the event bus; an api or worker app composes it. */
export class OrderSummaryProjectionMessageModule implements OnModuleInit {
    constructor(
        @InjectEventConsumerRegistry() private readonly registry: EventConsumerRegistry,
        private readonly orderPlacedConsumer: OrderPlacedConsumer,
        private readonly orderPaidConsumer: OrderPaidConsumer,
        private readonly orderExpiredConsumer: OrderExpiredConsumer,
    ) {}

    /** Hands every consumer to the registry. */
    onModuleInit(): void {
        this.registry.add(this.orderPlacedConsumer)
        this.registry.add(this.orderPaidConsumer)
        this.registry.add(this.orderExpiredConsumer)
    }
}

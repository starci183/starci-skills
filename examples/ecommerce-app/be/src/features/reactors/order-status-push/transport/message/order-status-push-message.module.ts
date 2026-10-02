import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectEventConsumerRegistry } from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { OrderStatusPushModule } from "../../order-status-push.module"
import { OrderPaidConsumer } from "./order-paid.consumer"
import { OrderExpiredConsumer } from "./order-expired.consumer"

@Module({ imports: [OrderStatusPushModule], providers: [OrderPaidConsumer, OrderExpiredConsumer] })
/** The message transport of the order-status-push reactor: registers its consumers with the event bus; an api or worker app composes it. */
export class OrderStatusPushMessageModule implements OnModuleInit {
    constructor(
        @InjectEventConsumerRegistry() private readonly registry: EventConsumerRegistry,
        private readonly orderPaidConsumer: OrderPaidConsumer,
        private readonly orderExpiredConsumer: OrderExpiredConsumer,
    ) {}

    /** Hands every consumer to the registry. */
    onModuleInit(): void {
        this.registry.add(this.orderPaidConsumer)
        this.registry.add(this.orderExpiredConsumer)
    }
}

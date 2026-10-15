import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectEventConsumerRegistry } from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { OrderStatusPushModule } from "../../order-status-push.module"
import { OrderPaidConsumer } from "./order-paid.consumer"
import { OrderExpiredConsumer } from "./order-expired.consumer"
import { ConfigurableModuleClass } from "./order-status-push-message.module-definition"

@Module({ imports: [OrderStatusPushModule.register({})], providers: [OrderPaidConsumer, OrderExpiredConsumer] })
/** The message transport of the order-status-push reactor: registers its consumers with the event bus; an api or worker app composes it. */
export class OrderStatusPushMessageModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectEventConsumerRegistry() private readonly registry: EventConsumerRegistry,
        private readonly orderPaidConsumer: OrderPaidConsumer,
        private readonly orderExpiredConsumer: OrderExpiredConsumer,
    ) {
        super()
    }

    /** Hands every consumer to the registry. */
    onModuleInit(): void {
        this.registry.add(this.orderPaidConsumer)
        this.registry.add(this.orderExpiredConsumer)
    }
}

import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectEventConsumerRegistry } from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { OrderPaidLoyaltyModule } from "../../order-paid-loyalty.module"
import { OrderPaidConsumer } from "./order-paid.consumer"

@Module({ imports: [OrderPaidLoyaltyModule], providers: [OrderPaidConsumer] })
/** The message transport of the order-paid-loyalty reactor: registers its consumers with the event bus; an api or worker app composes it. */
export class OrderPaidLoyaltyMessageModule implements OnModuleInit {
    constructor(
        @InjectEventConsumerRegistry() private readonly registry: EventConsumerRegistry,
        private readonly orderPaidConsumer: OrderPaidConsumer,
    ) {}

    /** Hands every consumer to the registry. */
    onModuleInit(): void {
        this.registry.add(this.orderPaidConsumer)
    }
}

import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectEventConsumerRegistry } from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { OrderPaidLoyaltyModule } from "../../order-paid-loyalty.module"
import { ConfigurableModuleClass } from "./order-paid-loyalty-message.module-definition"
import { OrderPaidConsumer } from "./order-paid.consumer"

@Module({ imports: [OrderPaidLoyaltyModule.register({})], providers: [OrderPaidConsumer] })
/** The message transport of the order-paid-loyalty reactor: registers its consumers with the event bus; an api or worker app composes it. */
export class OrderPaidLoyaltyMessageModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectEventConsumerRegistry() private readonly registry: EventConsumerRegistry,
        private readonly orderPaidConsumer: OrderPaidConsumer,
    ) {
        super()
    }

    /** Hands every consumer to the registry. */
    onModuleInit(): void {
        this.registry.add(this.orderPaidConsumer)
    }
}

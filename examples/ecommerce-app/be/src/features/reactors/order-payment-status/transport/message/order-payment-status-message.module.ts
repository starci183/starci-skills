import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectEventConsumerRegistry } from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { OrderPaymentStatusModule } from "../../order-payment-status.module"
import { BillingPaymentConfirmedConsumer } from "./billing-payment-confirmed.consumer"
import { ConfigurableModuleClass } from "./order-payment-status-message.module-definition"

@Module({ imports: [OrderPaymentStatusModule.register({})], providers: [BillingPaymentConfirmedConsumer] })
/** The message transport of the order-payment-status reactor: registers its consumers with the event bus; an api or worker app composes it. */
export class OrderPaymentStatusMessageModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectEventConsumerRegistry() private readonly registry: EventConsumerRegistry,
        private readonly paymentConfirmedConsumer: BillingPaymentConfirmedConsumer,
    ) {
        super()
    }

    /** Hands every consumer to the registry. */
    onModuleInit(): void {
        this.registry.add(this.paymentConfirmedConsumer)
    }
}

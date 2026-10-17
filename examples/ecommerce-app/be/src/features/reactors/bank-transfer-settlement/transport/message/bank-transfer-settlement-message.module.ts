import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectEventConsumerRegistry } from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { BankTransferSettlementModule } from "../../bank-transfer-settlement.module"
import { BankTransferReceivedConsumer } from "./billing-bank-transfer-received.consumer"
import { ConfigurableModuleClass } from "./bank-transfer-settlement-message.module-definition"

@Module({ imports: [BankTransferSettlementModule.register({})], providers: [BankTransferReceivedConsumer] })
/** The message transport of the bank-transfer-settlement reactor: registers its consumers with the event bus; a worker or api app composes it. */
export class BankTransferSettlementMessageModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectEventConsumerRegistry() private readonly registry: EventConsumerRegistry,
        private readonly bankTransferReceivedConsumer: BankTransferReceivedConsumer,
    ) {
        super()
    }

    /** Hands every consumer to the registry. */
    onModuleInit(): void {
        this.registry.add(this.bankTransferReceivedConsumer)
    }
}

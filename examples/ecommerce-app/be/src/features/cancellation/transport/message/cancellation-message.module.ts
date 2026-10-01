import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectConsumerRegistry } from "@modules/integrations/messaging"
import type { ConsumerRegistry } from "@modules/integrations/messaging"
import { CancellationModule } from "../../cancellation.module"
import { InvoiceRejectedConsumer } from "./invoice-rejected.consumer"

@Module({ imports: [CancellationModule], providers: [InvoiceRejectedConsumer] })
/** The message transport of the cancellation feature: registers its consumers with the messaging capability; only a worker composes it. */
export class CancellationMessageModule implements OnModuleInit {
    constructor(
        @InjectConsumerRegistry() private readonly registry: ConsumerRegistry,
        private readonly invoiceRejectedConsumer: InvoiceRejectedConsumer,
    ) {}

    /** Hands every consumer to the registry. */
    onModuleInit(): void {
        this.registry.add(this.invoiceRejectedConsumer)
    }
}

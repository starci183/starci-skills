import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { ExpireOrdersModule } from "../../expire-orders.module"
import { ConfigurableModuleClass } from "./expire-orders-queue.module-definition"
import { ExpireOrdersProcessor } from "./expire-orders.processor"

@Module({ imports: [ExpireOrdersModule.register({})], providers: [ExpireOrdersProcessor] })
/** The queue transport of the expire-orders job: registers its processor with the job runner, which an api or worker app composes; the scheduler of the order-expiry queue starts it. */
export class ExpireOrdersQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: ExpireOrdersProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}

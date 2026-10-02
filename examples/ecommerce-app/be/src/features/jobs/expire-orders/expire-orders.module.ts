import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { ExpireOverdueHandler } from "./application/expire-overdue.handler"
import { ExpireOrdersProcessor } from "./expire-orders.processor"
import { ExpireOverdueStep } from "./steps/expire-overdue.step"

@Module({ providers: [ExpireOrdersProcessor, ExpireOverdueStep, ExpireOverdueHandler] })
/** The expire-orders job: registers its processor with the job runner, which an api or worker app composes; the scheduler of the order-expiry queue starts it. */
export class ExpireOrdersModule implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: ExpireOrdersProcessor,
    ) {}

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}

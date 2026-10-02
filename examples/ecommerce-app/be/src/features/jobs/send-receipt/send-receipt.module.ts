import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { SendReceiptProcessor } from "./send-receipt.processor"
import { StoreReceiptStep } from "./steps/store-receipt.step"

@Module({ providers: [SendReceiptProcessor, StoreReceiptStep] })
/** The send-receipt job: registers its processor with the job runner, which an api or worker app composes; a paid order enqueues it. */
export class SendReceiptModule implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: SendReceiptProcessor,
    ) {}

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}

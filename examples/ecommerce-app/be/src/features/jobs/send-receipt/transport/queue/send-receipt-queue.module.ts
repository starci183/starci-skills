import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { SendReceiptModule } from "../../send-receipt.module"
import { SendReceiptProcessor } from "./send-receipt.processor"

@Module({ imports: [SendReceiptModule], providers: [SendReceiptProcessor] })
/** The queue transport of the send-receipt job: registers its processor with the job runner, which an api or worker app composes; a paid order enqueues it. */
export class SendReceiptQueueModule implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: SendReceiptProcessor,
    ) {}

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}

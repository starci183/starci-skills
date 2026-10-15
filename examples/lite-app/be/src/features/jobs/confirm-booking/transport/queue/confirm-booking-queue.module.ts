import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { ConfirmBookingModule } from "../../confirm-booking.module"
import { ConfigurableModuleClass } from "./confirm-booking-queue.module-definition"
import { ConfirmBookingProcessor } from "./confirm-booking.processor"

@Module({ imports: [ConfirmBookingModule.register({})], providers: [ConfirmBookingProcessor] })
/** The queue transport of the confirm-booking job: registers its processor with the job runner, which an api or worker app composes; a new booking enqueues it. */
export class ConfirmBookingQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: ConfirmBookingProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}

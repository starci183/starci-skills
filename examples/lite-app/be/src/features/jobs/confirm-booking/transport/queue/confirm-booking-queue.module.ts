import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { ConfirmBookingModule } from "../../confirm-booking.module"
import { ConfirmBookingProcessor } from "./confirm-booking.processor"

@Module({ imports: [ConfirmBookingModule], providers: [ConfirmBookingProcessor] })
/** The queue transport of the confirm-booking job: registers its processor with the job runner, which an api or worker app composes; a new booking enqueues it. */
export class ConfirmBookingQueueModule implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: ConfirmBookingProcessor,
    ) {}

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}

import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectQueueWorkerRegistry } from "@modules/platform/queue"
import type { QueueWorkerRegistry } from "@modules/platform/queue"
import { ConfirmBookingModule } from "../../confirm-booking.module"
import { ConfirmBookingProcessor } from "./confirm-booking.processor"

@Module({ imports: [ConfirmBookingModule], providers: [ConfirmBookingProcessor] })
/** The queue transport of the confirm-booking job: registers its processor with the queue workers of the app; a new booking enqueues it. */
export class ConfirmBookingQueueModule implements OnModuleInit {
    constructor(
        @InjectQueueWorkerRegistry() private readonly registry: QueueWorkerRegistry,
        private readonly processor: ConfirmBookingProcessor,
    ) {}

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}

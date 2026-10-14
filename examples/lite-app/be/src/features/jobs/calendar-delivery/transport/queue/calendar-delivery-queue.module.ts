import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { CalendarDeliveryJobModule } from "../../calendar-delivery.module"
import { CalendarDeliveryProcessor } from "./calendar-delivery.processor"

@Module({ imports: [CalendarDeliveryJobModule], providers: [CalendarDeliveryProcessor] })
/** Registers the calendar receipt processor with the composed fenced job runner. */
export class CalendarDeliveryQueueModule implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: CalendarDeliveryProcessor,
    ) {}

    /** Subscribes the processor to the calendar receipt queue. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}

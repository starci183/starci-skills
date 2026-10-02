import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { @@Job@@Processor } from "./@@job@@.processor"
import { @@Step@@Step } from "./steps/@@step@@.step"

@Module({ providers: [@@Job@@Processor, @@Step@@Step] })
/** The @@job@@ job: its processor and steps; a worker or api app imports it, and the processor subscribes to its queue when the module starts. */
export class @@Job@@Module implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly @@jobCamel@@Processor: @@Job@@Processor,
    ) {}

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.@@jobCamel@@Processor)
    }
}

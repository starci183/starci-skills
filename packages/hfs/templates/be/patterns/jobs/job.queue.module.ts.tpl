import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { @@Job@@Module } from "../../@@job@@.module"
import { ConfigurableModuleClass } from "./@@job@@-queue.module-definition"
import { @@Job@@Processor } from "./@@job@@.processor"

@Module({ imports: [@@Job@@Module.register({})], providers: [@@Job@@Processor] })
/** The queue transport of the @@job@@ job: its processor, which a worker or api app composes and which subscribes to its queue when the module starts. */
export class @@Job@@QueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly @@jobCamel@@Processor: @@Job@@Processor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.@@jobCamel@@Processor)
    }
}

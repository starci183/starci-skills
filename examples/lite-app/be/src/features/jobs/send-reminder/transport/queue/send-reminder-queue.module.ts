import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { JobProcessorRegistry } from "@modules/platform/jobs"
import { SendReminderModule } from "../../send-reminder.module"
import { ConfigurableModuleClass } from "./send-reminder-queue.module-definition"
import { SendReminderProcessor } from "./send-reminder.processor"

@Module({ imports: [SendReminderModule.register({})], providers: [SendReminderProcessor] })
/**
 * The queue transport of the send-reminder job: registers its processor with the job runner, which an api or worker app
 * composes; a new booking enqueues it and the pg_cron tick replays it for whatever was missed.
 */
export class SendReminderQueueModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: SendReminderProcessor,
    ) {
        super()
    }

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}

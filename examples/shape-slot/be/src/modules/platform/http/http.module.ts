import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { DeadlineSchedulerService } from "./deadline-scheduler.service"
import { DEADLINE_SCHEDULER } from "./http.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./http.module-definition"

@Module({})
/** Supplies the response deadline timer to required-dependency probes. */
export class HttpModule extends ConfigurableModuleClass {
    /** Registers the timer once in each app's composition root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: DEADLINE_SCHEDULER, useClass: DeadlineSchedulerService }],
            exports: [DEADLINE_SCHEDULER],
        }
    }
}

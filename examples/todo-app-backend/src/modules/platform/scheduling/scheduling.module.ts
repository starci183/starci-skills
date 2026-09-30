import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { JobRunnerService } from "./job-runner.service"
import { JOB_REGISTRY } from "./scheduling.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./scheduling.module-definition"

@Module({})
/** The scheduling capability: the registry schedule transport modules add their jobs to, and the tick loop that runs them. */
export class SchedulingModule extends ConfigurableModuleClass {
    /** Registers the capability once per app; only worker apps do. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                JobRunnerService,
                { provide: JOB_REGISTRY, useExisting: JobRunnerService },
            ],
            exports: [JOB_REGISTRY],
        }
    }
}

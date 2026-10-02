import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { JOB_CLAIMS, JOB_PROCESSOR_REGISTRY, JOBS_MANAGER } from "./jobs.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./jobs.module-definition"
import { JobClaimService } from "./job-claim.service"
import { JobRunnerService } from "./job-runner.service"

@Module({})
/** The fenced jobs of a service: the claim service that owns the job row and the runner that subscribes processors to their queues. Needs the queue capability registered in the same app. */
export class JobsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app that runs jobs. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: JOBS_MANAGER, useExisting: options.connection },
                JobClaimService,
                JobRunnerService,
                { provide: JOB_CLAIMS, useExisting: JobClaimService },
                { provide: JOB_PROCESSOR_REGISTRY, useExisting: JobRunnerService },
            ],
            exports: [JOB_CLAIMS, JOB_PROCESSOR_REGISTRY],
        }
    }
}

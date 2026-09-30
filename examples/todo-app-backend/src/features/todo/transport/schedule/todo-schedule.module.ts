import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectJobRegistry } from "@modules/platform/scheduling"
import type { JobRegistry } from "@modules/platform/scheduling"
import { TodoModule } from "../../todo.module"
import { RecurGenerationJob } from "./recur-generation.job"
import { SessionPurgeJob } from "./session-purge.job"

@Module({
    imports: [TodoModule],
    providers: [RecurGenerationJob, SessionPurgeJob],
})
/** The schedule transport of the todo feature: registers its jobs with the scheduling capability; only the worker composes it. */
export class TodoScheduleModule implements OnModuleInit {
    constructor(
        @InjectJobRegistry() private readonly registry: JobRegistry,
        private readonly recurGenerationJob: RecurGenerationJob,
        private readonly sessionPurgeJob: SessionPurgeJob,
    ) {}

    /** Hands every job to the registry. */
    onModuleInit(): void {
        this.registry.add(this.recurGenerationJob)
        this.registry.add(this.sessionPurgeJob)
    }
}

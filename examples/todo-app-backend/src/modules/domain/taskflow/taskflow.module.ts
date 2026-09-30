import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { PlanUsageService } from "./plan-usage.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./taskflow.module-definition"
import { TaskflowService } from "./taskflow.service"

@Module({})
/** The taskflow capability: the scenarios that need several capabilities at once (create, complete and reopen a task, the plan usage). It owns no table. The doors live in the todo feature. */
export class TaskflowModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), TaskflowService, PlanUsageService],
            exports: [TaskflowService, PlanUsageService],
        }
    }
}

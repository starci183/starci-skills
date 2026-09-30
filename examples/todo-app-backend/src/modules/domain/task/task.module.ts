import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./task.module-definition"
import { TaskService } from "./task.service"

@Module({})
/** The task capability: the task rows and the rules on them. The delete, list and count operations are orchestrated here; the doors live in the todo feature. */
export class TaskModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), TaskService], exports: [TaskService] }
    }
}

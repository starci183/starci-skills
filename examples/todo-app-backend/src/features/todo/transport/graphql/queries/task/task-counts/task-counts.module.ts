import {
    Module 
} from "@nestjs/common"
import {
    CqrsModule 
} from "@nestjs/cqrs"
import {
    ConfigurableModuleClass 
} from "./task-counts.module-definition"
import {
    TaskCountsResolver 
} from "./task-counts.resolver"

@Module({
    imports: [CqrsModule],
    providers: [TaskCountsResolver],
})
/** taskCounts' module: mounts TaskCountsResolver; the query handler is discovered app-wide through CqrsModule. */
export class TaskCountsSingleQueryModule extends ConfigurableModuleClass {}

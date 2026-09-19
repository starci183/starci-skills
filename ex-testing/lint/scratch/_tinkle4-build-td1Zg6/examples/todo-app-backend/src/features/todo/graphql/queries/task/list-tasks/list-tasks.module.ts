import {
    Module 
} from "@nestjs/common"
import {
    CqrsModule 
} from "@nestjs/cqrs"
import {
    ConfigurableModuleClass 
} from "./list-tasks.module-definition"
import {
    ListTasksResolver 
} from "./list-tasks.resolver"

@Module({
    imports: [CqrsModule],
    providers: [ListTasksResolver],
})
/** tasks' module: mounts ListTasksResolver; the query handler is discovered app-wide through CqrsModule. */
export class ListTasksSingleQueryModule extends ConfigurableModuleClass {}

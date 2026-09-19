import {
    Module 
} from "@nestjs/common"
import {
    CqrsModule 
} from "@nestjs/cqrs"
import {
    ConfigurableModuleClass 
} from "./delete-task.module-definition"
import {
    DeleteTaskResolver 
} from "./delete-task.resolver"

@Module({
    imports: [CqrsModule],
    providers: [DeleteTaskResolver],
})
/** deleteTask's module: mounts DeleteTaskResolver; the command handler is discovered app-wide through CqrsModule. */
export class DeleteTaskSingleMutationModule extends ConfigurableModuleClass {}

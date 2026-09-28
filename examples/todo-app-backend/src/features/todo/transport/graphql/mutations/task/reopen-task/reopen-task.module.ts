import {
    Module 
} from "@nestjs/common"
import {
    CqrsModule 
} from "@nestjs/cqrs"
import {
    ConfigurableModuleClass 
} from "./reopen-task.module-definition"
import {
    ReopenTaskResolver 
} from "./reopen-task.resolver"

@Module({
    imports: [CqrsModule],
    providers: [ReopenTaskResolver],
})
/** reopenTask's module: mounts ReopenTaskResolver; the command handler is discovered app-wide through CqrsModule. */
export class ReopenTaskSingleMutationModule extends ConfigurableModuleClass {}

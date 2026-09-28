import {
    Module 
} from "@nestjs/common"
import {
    CqrsModule 
} from "@nestjs/cqrs"
import {
    ConfigurableModuleClass 
} from "./make-recurring.module-definition"
import {
    MakeRecurringResolver 
} from "./make-recurring.resolver"

/** SessionService is not imported here: SessionModule is registered globally from app.module.ts (see
 * create-task.module.ts's identical comment on the same convention). */
@Module({
    imports: [CqrsModule],
    providers: [MakeRecurringResolver],
})
/** makeRecurring's module: mounts MakeRecurringResolver; the command handler is discovered app-wide through CqrsModule. */
export class MakeRecurringSingleMutationModule extends ConfigurableModuleClass {}

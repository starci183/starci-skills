import {
    Module 
} from "@nestjs/common"
import {
    CqrsModule 
} from "@nestjs/cqrs"
import {
    ConfigurableModuleClass 
} from "./end-recurrence.module-definition"
import {
    EndRecurrenceResolver 
} from "./end-recurrence.resolver"

@Module({
    imports: [CqrsModule],
    providers: [EndRecurrenceResolver],
})
/** endRecurrence's module: mounts EndRecurrenceResolver; the command handler is discovered app-wide through CqrsModule. */
export class EndRecurrenceSingleMutationModule extends ConfigurableModuleClass {}

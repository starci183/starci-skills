import {
    Module 
} from "@nestjs/common"
import {
    CqrsModule 
} from "@nestjs/cqrs"
import {
    ConfigurableModuleClass 
} from "./edit-recurrence.module-definition"
import {
    EditRecurrenceResolver 
} from "./edit-recurrence.resolver"

@Module({
    imports: [CqrsModule],
    providers: [EditRecurrenceResolver],
})
/** editRecurrence's module: mounts EditRecurrenceResolver; the command handler is discovered app-wide through CqrsModule. */
export class EditRecurrenceSingleMutationModule extends ConfigurableModuleClass {}

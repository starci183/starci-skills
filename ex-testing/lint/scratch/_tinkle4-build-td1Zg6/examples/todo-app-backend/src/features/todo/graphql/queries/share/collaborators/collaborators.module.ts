import {
    Module 
} from "@nestjs/common"
import {
    CqrsModule 
} from "@nestjs/cqrs"
import {
    ConfigurableModuleClass 
} from "./collaborators.module-definition"
import {
    CollaboratorsResolver 
} from "./collaborators.resolver"

@Module({
    imports: [CqrsModule],
    providers: [CollaboratorsResolver],
})
/** collaborators' module: mounts CollaboratorsResolver; the query handler is discovered app-wide through CqrsModule. */
export class CollaboratorsSingleQueryModule extends ConfigurableModuleClass {}

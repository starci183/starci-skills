import {
    Module 
} from "@nestjs/common"
import {
    CqrsModule 
} from "@nestjs/cqrs"
import {
    ConfigurableModuleClass 
} from "./revoke-collaborator.module-definition"
import {
    RevokeCollaboratorResolver 
} from "./revoke-collaborator.resolver"

@Module({
    imports: [CqrsModule],
    providers: [RevokeCollaboratorResolver],
})
/** revokeCollaborator's module: mounts RevokeCollaboratorResolver; the command handler is discovered app-wide through CqrsModule. */
export class RevokeCollaboratorSingleMutationModule extends ConfigurableModuleClass {}

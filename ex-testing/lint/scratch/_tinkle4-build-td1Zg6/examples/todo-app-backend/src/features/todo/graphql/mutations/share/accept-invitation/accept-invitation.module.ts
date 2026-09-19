import {
    Module 
} from "@nestjs/common"
import {
    CqrsModule 
} from "@nestjs/cqrs"
import {
    ConfigurableModuleClass 
} from "./accept-invitation.module-definition"
import {
    AcceptInvitationResolver 
} from "./accept-invitation.resolver"

@Module({
    imports: [CqrsModule],
    providers: [AcceptInvitationResolver],
})
/** acceptInvitation's module: mounts AcceptInvitationResolver; the command handler is discovered app-wide through CqrsModule. */
export class AcceptInvitationSingleMutationModule extends ConfigurableModuleClass {}

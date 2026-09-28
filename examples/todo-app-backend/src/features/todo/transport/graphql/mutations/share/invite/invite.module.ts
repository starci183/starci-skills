import {
    Module 
} from "@nestjs/common"
import {
    CqrsModule 
} from "@nestjs/cqrs"
import {
    ConfigurableModuleClass 
} from "./invite.module-definition"
import {
    InviteResolver 
} from "./invite.resolver"

/** SessionService comes from the app-wide global SessionModule registration (see
 * create-task.module.ts's own comment) - not imported here. */
@Module({
    imports: [CqrsModule],
    providers: [InviteResolver],
})
/** invite's module: mounts InviteResolver; the command handler is discovered app-wide through CqrsModule. */
export class InviteSingleMutationModule extends ConfigurableModuleClass {}

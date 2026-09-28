import {
    Module 
} from "@nestjs/common"
import {
    CqrsModule 
} from "@nestjs/cqrs"
import {
    ConfigurableModuleClass 
} from "./sign-out.module-definition"
import {
    SignOutResolver 
} from "./sign-out.resolver"

@Module({
    imports: [CqrsModule],
    providers: [SignOutResolver],
})
/** signOut's module: mounts SignOutResolver; the command handler is discovered app-wide through CqrsModule. */
export class SignOutSingleMutationModule extends ConfigurableModuleClass {}

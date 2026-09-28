import {
    Module 
} from "@nestjs/common"
import {
    ConfigurableModuleClass 
} from "./sign-in.module-definition"
import {
    SignInResolver 
} from "./sign-in.resolver"

/** Module for the signIn mutation. Import-free on purpose: AccountService and SessionService
 * resolve app-wide from the composition root's global registrations, the same way the retired
 * REST door reached them. */
@Module({
    providers: [SignInResolver],
})
/** signIn's module: mounts SignInResolver; the account and session capabilities are composed at the app root, not imported here. */
export class SignInSingleMutationModule extends ConfigurableModuleClass {}

import {
    Module 
} from "@nestjs/common"
import {
    ConfigurableModuleClass 
} from "./register.module-definition"
import {
    RegisterResolver 
} from "./register.resolver"

/** Module for the register mutation. Import-free on purpose: AccountService resolves app-wide
 * from the composition root's global registration, the same way the retired REST door reached it. */
@Module({
    providers: [RegisterResolver],
})
/** register's module: mounts RegisterResolver; the account capability is composed at the app root, not imported here. */
export class RegisterSingleMutationModule extends ConfigurableModuleClass {}

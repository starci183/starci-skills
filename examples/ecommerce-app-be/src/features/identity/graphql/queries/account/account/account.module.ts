import {
    Module 
} from "@nestjs/common"
import {
    ConfigurableModuleClass 
} from "./account.module-definition"
import {
    AccountResolver 
} from "./account.resolver"

/** Module for the account query. Import-free on purpose: AccountService and the
 * contract.checkout.order-for-identity client resolve app-wide from the composition root's
 * global registrations, the same way the retired REST door reached them. */
@Module({
    providers: [AccountResolver],
})
/** account's module: mounts AccountResolver; the account capability and the order integration client are composed at the app root, not imported here. */
export class AccountSingleQueryModule extends ConfigurableModuleClass {}
